package com.InovaSkill.CaderninhoDigital.ai.openrouter;

import com.InovaSkill.CaderninhoDigital.ai.contract.PlanoOrquestracao;
import com.InovaSkill.CaderninhoDigital.ai.gateway.MensagemModelo;
import com.InovaSkill.CaderninhoDigital.ai.gateway.MetadadosModelo;
import com.InovaSkill.CaderninhoDigital.ai.gateway.ModeloGateway;
import com.InovaSkill.CaderninhoDigital.ai.gateway.RespostaModelo;
import com.InovaSkill.CaderninhoDigital.ai.gateway.SolicitacaoModelo;
import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import com.InovaSkill.CaderninhoDigital.ai.privacy.PoliticaDadosIa;
import com.InovaSkill.CaderninhoDigital.exception.CodigoErroOrquestrador;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URI;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.CancellationException;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import jakarta.validation.Validator;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class OpenRouterModeloGateway implements ModeloGateway {
    private final AiOrchestratorProperties properties;
    private final ObjectMapper objectMapper;
    private final ObjectMapper contractMapper;
    private final OpenRouterTransport transport;
    private final Validator validator;
    private final PoliticaDadosIa politicaDados;

    public OpenRouterModeloGateway(
            AiOrchestratorProperties properties,
            ObjectMapper objectMapper,
            @Qualifier("aiContractObjectMapper") ObjectMapper contractMapper,
            OpenRouterTransport transport,
            Validator validator,
            PoliticaDadosIa politicaDados
    ) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.contractMapper = contractMapper;
        this.transport = transport;
        this.validator = validator;
        this.politicaDados = politicaDados;
    }

    @Override
    public RespostaModelo<PlanoOrquestracao> gerarPlano(SolicitacaoModelo solicitacao) {
        return gerarEstruturado(solicitacao, PlanoOrquestracao.class);
    }

    @Override
    public RespostaModelo<String> gerarRespostaFinal(SolicitacaoModelo solicitacao) {
        ParsedResponse response = executar(solicitacao, false);
        return new RespostaModelo<>(response.content(), response.metadata());
    }

    @Override
    public <T> RespostaModelo<T> gerarEstruturado(SolicitacaoModelo solicitacao, Class<T> tipoResposta) {
        ParsedResponse response = executar(solicitacao, true);
        try {
            T parsed = contractMapper.readValue(removerCercaMarkdown(response.content()), tipoResposta);
            if (!validator.validate(parsed).isEmpty()) {
                throw erro(CodigoErroOrquestrador.PLANO_INVALIDO, HttpStatus.BAD_GATEWAY,
                        "O provedor retornou uma resposta estruturada incompleta");
            }
            return new RespostaModelo<>(parsed, response.metadata());
        } catch (OrquestradorException exception) {
            throw exception;
        } catch (Exception exception) {
            throw erro(CodigoErroOrquestrador.PLANO_INVALIDO, HttpStatus.BAD_GATEWAY,
                    "O provedor retornou uma resposta estruturada inválida");
        }
    }

    private ParsedResponse executar(SolicitacaoModelo solicitacao, boolean jsonEstruturado) {
        politicaDados.validarSolicitacaoModelo(solicitacao);
        validarConfiguracao();
        long inicio = System.nanoTime();
        ObjectNode body = criarBody(solicitacao, jsonEstruturado);
        OpenRouterHttpRequest request = new OpenRouterHttpRequest(
                URI.create(properties.getProvider().getUrl()),
                Map.of("Authorization", "Bearer " + properties.getProvider().getKey(),
                        "Content-Type", "application/json"),
                serializar(body),
                Duration.ofMillis(properties.getLimits().getReadTimeoutMs()));
        CompletableFuture<OpenRouterHttpResponse> future = transport.enviar(request);
        OpenRouterHttpResponse response;
        try {
            response = future.get(tempoLimiteMillis(), TimeUnit.MILLISECONDS);
        } catch (TimeoutException exception) {
            future.cancel(true);
            throw erro(CodigoErroOrquestrador.TIMEOUT, HttpStatus.GATEWAY_TIMEOUT,
                    "O provedor excedeu o tempo limite");
        } catch (CancellationException exception) {
            throw erro(CodigoErroOrquestrador.TIMEOUT, HttpStatus.GATEWAY_TIMEOUT,
                    "A chamada ao provedor foi cancelada");
        } catch (InterruptedException exception) {
            future.cancel(true);
            Thread.currentThread().interrupt();
            throw erro(CodigoErroOrquestrador.TIMEOUT, HttpStatus.GATEWAY_TIMEOUT,
                    "A chamada ao provedor foi interrompida");
        } catch (ExecutionException exception) {
            if (causadoPorTimeout(exception)) {
                throw erro(CodigoErroOrquestrador.TIMEOUT, HttpStatus.GATEWAY_TIMEOUT,
                        "O provedor excedeu o tempo limite");
            }
            throw erro(CodigoErroOrquestrador.PROVEDOR_INDISPONIVEL, HttpStatus.SERVICE_UNAVAILABLE,
                    "Não foi possível acessar o provedor");
        }
        classificarStatus(response.statusCode());
        return interpretarResposta(response.body(), inicio);
    }

    private ObjectNode criarBody(SolicitacaoModelo solicitacao, boolean jsonEstruturado) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("model", properties.getProvider().getModel());
        body.put("max_tokens", properties.getLimits().getMaxOutputTokens());
        ArrayNode messages = body.putArray("messages");
        for (MensagemModelo mensagem : solicitacao.mensagens()) {
            ObjectNode item = messages.addObject();
            item.put("role", mensagem.papel().providerValue());
            item.put("content", mensagem.conteudo());
        }
        if (jsonEstruturado) {
            body.putObject("response_format").put("type", "json_object");
        }
        return body;
    }

    private ParsedResponse interpretarResposta(String rawBody, long inicio) {
        if (rawBody == null || rawBody.isBlank()) {
            throw erro(CodigoErroOrquestrador.PROVEDOR_INDISPONIVEL, HttpStatus.BAD_GATEWAY,
                    "O provedor retornou uma resposta vazia");
        }
        try {
            JsonNode root = objectMapper.readTree(rawBody);
            String content = root.path("choices").path(0).path("message").path("content").asText(null);
            if (content == null || content.isBlank()) {
                throw erro(CodigoErroOrquestrador.PROVEDOR_INDISPONIVEL, HttpStatus.BAD_GATEWAY,
                        "O provedor retornou uma resposta incompleta");
            }
            String requestedModel = properties.getProvider().getModel();
            String effectiveModel = textoOuNulo(root.get("model"));
            JsonNode usage = root.path("usage");
            MetadadosModelo metadata = new MetadadosModelo(
                    requestedModel,
                    effectiveModel,
                    inteiroOuNulo(usage.get("prompt_tokens")),
                    inteiroOuNulo(usage.get("completion_tokens")),
                    inteiroOuNulo(usage.get("total_tokens")),
                    Duration.ofNanos(System.nanoTime() - inicio).toMillis(),
                    effectiveModel != null && !requestedModel.equals(effectiveModel));
            return new ParsedResponse(content.trim(), metadata);
        } catch (OrquestradorException exception) {
            throw exception;
        } catch (Exception exception) {
            throw erro(CodigoErroOrquestrador.PROVEDOR_INDISPONIVEL, HttpStatus.BAD_GATEWAY,
                    "O provedor retornou uma resposta inválida");
        }
    }

    private void classificarStatus(int status) {
        if (status >= 200 && status < 300) return;
        if (status == 400) {
            throw erro(CodigoErroOrquestrador.ARGUMENTOS_INVALIDOS, HttpStatus.BAD_GATEWAY,
                    "O provedor rejeitou a solicitação");
        }
        if (status == 401 || status == 403) {
            throw erro(CodigoErroOrquestrador.PROVEDOR_INDISPONIVEL, HttpStatus.SERVICE_UNAVAILABLE,
                    "O provedor não autorizou a integração");
        }
        if (status == 429) {
            throw erro(CodigoErroOrquestrador.LIMITE_EXCEDIDO, HttpStatus.TOO_MANY_REQUESTS,
                    "O limite temporário do provedor foi atingido");
        }
        throw erro(CodigoErroOrquestrador.PROVEDOR_INDISPONIVEL, HttpStatus.SERVICE_UNAVAILABLE,
                "O provedor está temporariamente indisponível");
    }

    private void validarConfiguracao() {
        if (properties.getProvider().getKey() == null || properties.getProvider().getKey().isBlank()) {
            throw erro(CodigoErroOrquestrador.PROVEDOR_INDISPONIVEL, HttpStatus.SERVICE_UNAVAILABLE,
                    "A integração com o provedor não está configurada");
        }
    }

    private long tempoLimiteMillis() {
        long readTimeout = properties.getLimits().getReadTimeoutMs();
        long budget = properties.getLimits().getRequestBudgetMillis();
        return budget > 0 ? Math.min(readTimeout, budget) : readTimeout;
    }

    private boolean causadoPorTimeout(Throwable throwable) {
        Throwable atual = throwable;
        while (atual != null) {
            if (atual instanceof HttpTimeoutException || atual instanceof TimeoutException) return true;
            atual = atual.getCause();
        }
        return false;
    }

    private String serializar(ObjectNode body) {
        try {
            return objectMapper.writeValueAsString(body);
        } catch (Exception exception) {
            throw erro(CodigoErroOrquestrador.ERRO_INTERNO, HttpStatus.INTERNAL_SERVER_ERROR,
                    "Não foi possível preparar a solicitação ao provedor");
        }
    }

    private Integer inteiroOuNulo(JsonNode node) {
        return node != null && node.isIntegralNumber() ? node.intValue() : null;
    }

    private String textoOuNulo(JsonNode node) {
        return node != null && node.isTextual() && !node.asText().isBlank() ? node.asText() : null;
    }

    private String removerCercaMarkdown(String content) {
        return content.replace("```json", "").replace("```", "").trim();
    }

    private OrquestradorException erro(CodigoErroOrquestrador codigo, HttpStatus status, String mensagem) {
        return new OrquestradorException(codigo, status, mensagem);
    }

    private record ParsedResponse(String content, MetadadosModelo metadata) {}
}
