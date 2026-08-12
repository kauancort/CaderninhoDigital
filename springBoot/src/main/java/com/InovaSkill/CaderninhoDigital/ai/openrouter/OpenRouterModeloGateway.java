package com.InovaSkill.CaderninhoDigital.ai.openrouter;

import com.InovaSkill.CaderninhoDigital.ai.contract.PlanoOrquestracao;
import com.InovaSkill.CaderninhoDigital.ai.gateway.MensagemModelo;
import com.InovaSkill.CaderninhoDigital.ai.gateway.MetadadosModelo;
import com.InovaSkill.CaderninhoDigital.ai.gateway.ModeloGateway;
import com.InovaSkill.CaderninhoDigital.ai.gateway.RespostaModelo;
import com.InovaSkill.CaderninhoDigital.ai.gateway.SolicitacaoModelo;
import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import com.InovaSkill.CaderninhoDigital.ai.privacy.PoliticaDadosIa;
import com.InovaSkill.CaderninhoDigital.ai.search.ExtracaoOfertasMercado;
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
import java.util.List;
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
        ParsedResponse response = executar(solicitacao, false, null,
                Duration.ofMillis(properties.getLimits().getReadTimeoutMs()));
        return new RespostaModelo<>(response.content(), response.metadata());
    }

    @Override
    public <T> RespostaModelo<T> gerarEstruturado(SolicitacaoModelo solicitacao, Class<T> tipoResposta) {
        return gerarEstruturado(solicitacao, tipoResposta,
                Duration.ofMillis(properties.getLimits().getReadTimeoutMs()));
    }

    @Override
    public <T> RespostaModelo<T> gerarEstruturado(SolicitacaoModelo solicitacao, Class<T> tipoResposta,
            Duration timeout) {
        ParsedResponse response = executar(solicitacao, true, tipoResposta, timeout);
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

    private ParsedResponse executar(SolicitacaoModelo solicitacao, boolean jsonEstruturado, Class<?> tipoResposta,
            Duration timeout) {
        politicaDados.validarSolicitacaoModelo(solicitacao);
        validarConfiguracao();
        long inicio = System.nanoTime();
        ObjectNode body = criarBody(solicitacao, jsonEstruturado, tipoResposta);
        OpenRouterHttpRequest request = new OpenRouterHttpRequest(
                URI.create(properties.getProvider().getUrl()),
                Map.of("Authorization", "Bearer " + properties.getProvider().getKey(),
                        "Content-Type", "application/json"),
                serializar(body),
                timeout);
        OpenRouterHttpResponse response = null;
        int tentativa = 0;
        do {
            response = enviarUmaVez(request);
            if (!statusTransitorio(response.statusCode()) || tentativa >= properties.getLimits().getTransientRetries()) break;
            tentativa++;
        } while (true);
        classificarStatus(response.statusCode());
        return interpretarResposta(response.body(), inicio);
    }

    private OpenRouterHttpResponse enviarUmaVez(OpenRouterHttpRequest request) {
        CompletableFuture<OpenRouterHttpResponse> future = transport.enviar(request);
        try {
            return future.get(request.timeout().toMillis(), TimeUnit.MILLISECONDS);
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
    }

    private boolean statusTransitorio(int status) {
        return status == 500 || status == 502 || status == 503 || status == 504;
    }

    private ObjectNode criarBody(SolicitacaoModelo solicitacao, boolean jsonEstruturado, Class<?> tipoResposta) {
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
            ObjectNode format = body.putObject("response_format");
            format.put("type", "json_schema");
            ObjectNode jsonSchema = format.putObject("json_schema");
            jsonSchema.put("name", tipoResposta == ExtracaoOfertasMercado.class
                    ? "extracao_ofertas_mercado" : "plano_orquestracao");
            jsonSchema.put("strict", true);
            jsonSchema.set("schema", tipoResposta == ExtracaoOfertasMercado.class
                    ? criarSchemaExtracaoOfertas() : criarSchemaPlano());
        }
        return body;
    }

    private ObjectNode criarSchemaPlano() {
        ObjectNode schema = objetoFechado();
        ObjectNode properties = schema.putObject("properties");
        properties.set("schemaVersion", enumTexto(List.of(propertiesProviderSchemaVersion())));
        properties.set("intencao", enumTexto(List.of(
                "CONSULTAR_ESTOQUE", "CONSULTAR_VENDAS", "CONSULTAR_GASTOS",
                "CONSULTAR_RECEBIVEIS", "ANALISAR_CUSTO_PRODUTO",
                "ANALISAR_COMPRAS_INSUMO", "COMPARAR_VENDAS_GASTOS",
                "COMPARAR_VENDAS_PERIODOS", "COMPARAR_PRECO_MERCADO", "DESCONHECIDA")));
        ObjectNode chamadas = properties.putObject("chamadas");
        chamadas.put("type", "array");
        chamadas.put("minItems", 1);
        chamadas.put("maxItems", 2);
        ArrayNode alternativas = chamadas.putObject("items").putArray("anyOf");
        alternativas.add(schemaChamada("RESUMO_ESTOQUE", "SEM_FILTRO", List.of()));
        alternativas.add(schemaChamada("RESUMO_VENDAS", "PERIODO", List.of("inicio", "fim")));
        alternativas.add(schemaChamada("RESUMO_GASTOS", "PERIODO", List.of("inicio", "fim")));
        alternativas.add(schemaChamada("RESUMO_RECEBIVEIS", "PERIODO", List.of("inicio", "fim")));
        alternativas.add(schemaChamada("ANALISE_CUSTO_PRODUTO", "PRODUTO", List.of("produtoId")));
        alternativas.add(schemaChamadaCompraInsumo());
        if (this.properties.getFeatures().isSearch()) alternativas.add(schemaChamadaComparacaoMercado());
        properties.set("modoResposta", enumTexto(
                List.of("TEXTO_SIMPLES", "TEXTO_COM_DADOS", "ANALITICA")));
        obrigatorios(schema, "schemaVersion", "intencao", "chamadas", "modoResposta");
        return schema;
    }

    private ObjectNode criarSchemaExtracaoOfertas() {
        ObjectNode schema = objetoFechado();
        ObjectNode properties = schema.putObject("properties");
        ObjectNode ofertas = properties.putObject("ofertas");
        ofertas.put("type", "array");
        ofertas.put("maxItems", 15);
        ObjectNode oferta = objetoFechado();
        ObjectNode campos = oferta.putObject("properties");
        campos.set("fonteId", textoLimitado(40, false));
        campos.set("produto", textoLimitado(120, false));
        campos.set("precoAnunciado", numeroPositivo(false));
        campos.set("tipoPreco", enumTexto(List.of("UNITARIO", "TOTAL_EMBALAGEM")));
        campos.set("unidadePreco", enumOuNulo(List.of("KG", "G", "L", "ML", "UNIDADE")));
        campos.set("quantidadeEmbalagem", numeroPositivo(true));
        campos.set("unidadeEmbalagem", enumOuNulo(List.of("KG", "G", "L", "ML", "UNIDADE")));
        campos.set("pedidoMinimo", numeroPositivo(true));
        campos.set("unidadePedidoMinimo", enumOuNulo(List.of("KG", "G", "L", "ML", "UNIDADE")));
        campos.set("frete", numeroPositivo(true));
        ObjectNode validade = objectMapper.createObjectNode();
        ArrayNode tiposValidade = validade.putArray("type"); tiposValidade.add("string"); tiposValidade.add("null");
        validade.put("format", "date"); campos.set("validade", validade);
        campos.set("localizacao", textoLimitado(120, true));
        campos.set("evidenciaPreco", textoLimitado(240, false));
        campos.set("evidenciaPedidoMinimo", textoLimitado(240, true));
        campos.set("confianca", enumTexto(List.of("ALTA", "MEDIA", "BAIXA")));
        obrigatorios(oferta, "fonteId", "produto", "precoAnunciado", "tipoPreco", "unidadePreco",
                "quantidadeEmbalagem", "unidadeEmbalagem", "pedidoMinimo", "unidadePedidoMinimo",
                "frete", "validade", "localizacao", "evidenciaPreco", "evidenciaPedidoMinimo", "confianca");
        ofertas.set("items", oferta);
        obrigatorios(schema, "ofertas");
        return schema;
    }

    private ObjectNode numeroPositivo(boolean aceitaNulo) {
        ObjectNode node = objectMapper.createObjectNode();
        if (aceitaNulo) {
            ArrayNode tipos = node.putArray("type");
            tipos.add("number"); tipos.add("null");
        } else node.put("type", "number");
        node.put("exclusiveMinimum", 0);
        return node;
    }

    private ObjectNode textoLimitado(int maximo, boolean aceitaNulo) {
        ObjectNode node = objectMapper.createObjectNode();
        if (aceitaNulo) {
            ArrayNode tipos = node.putArray("type");
            tipos.add("string"); tipos.add("null");
        } else node.put("type", "string");
        node.put("maxLength", maximo);
        if (!aceitaNulo) node.put("minLength", 1);
        return node;
    }

    private ObjectNode enumOuNulo(List<String> valores) {
        ObjectNode node = objectMapper.createObjectNode();
        ArrayNode tipos = node.putArray("type");
        tipos.add("string"); tipos.add("null");
        ArrayNode valoresNode = node.putArray("enum");
        valores.forEach(valoresNode::add); valoresNode.addNull();
        return node;
    }

    private ObjectNode schemaChamada(String ferramenta, String tipo, List<String> campos) {
        ObjectNode chamada = objetoFechado();
        ObjectNode propriedades = chamada.putObject("properties");
        propriedades.set("ferramenta", enumTexto(List.of(ferramenta)));
        ObjectNode argumentos = objetoFechado();
        ObjectNode argumentosProperties = argumentos.putObject("properties");
        argumentosProperties.set("tipo", enumTexto(List.of(tipo)));
        for (String campo : campos) {
            ObjectNode propriedade = argumentosProperties.putObject(campo);
            if (campo.endsWith("Id")) {
                propriedade.put("type", "integer");
                propriedade.put("minimum", 1);
            } else {
                propriedade.put("type", "string");
                propriedade.put("format", "date");
            }
        }
        List<String> requeridos = new java.util.ArrayList<>();
        requeridos.add("tipo");
        requeridos.addAll(campos);
        obrigatorios(argumentos, requeridos.toArray(String[]::new));
        propriedades.set("argumentos", argumentos);
        obrigatorios(chamada, "ferramenta", "argumentos");
        return chamada;
    }

    private ObjectNode schemaChamadaCompraInsumo() {
        ObjectNode chamada = schemaChamada("ANALISE_COMPRAS_INSUMO", "COMPRA_INSUMO",
                List.of("materiaPrimaId", "inicio", "fim"));
        ObjectNode id = (ObjectNode) chamada.path("properties").path("argumentos")
                .path("properties").path("materiaPrimaId");
        ArrayNode tipos = id.putArray("type");
        tipos.add("integer"); tipos.add("null");
        return chamada;
    }

    private ObjectNode schemaChamadaComparacaoMercado() {
        ObjectNode chamada = schemaChamada("COMPARAR_PRECO_MERCADO", "COMPARACAO_MERCADO",
                List.of("materiaPrimaId", "inicio", "fim"));
        ObjectNode props = (ObjectNode) chamada.path("properties").path("argumentos").path("properties");
        props.putObject("unidade").put("type", "string").put("maxLength", 30);
        props.putObject("quantidadeAlvo").put("type", "number").put("exclusiveMinimum", 0);
        props.putObject("cidade").put("type", "string").put("maxLength", 100);
        props.putObject("uf").put("type", "string").put("pattern", "^[A-Z]{2}$");
        ObjectNode args = (ObjectNode) chamada.path("properties").path("argumentos");
        obrigatorios(args, "tipo", "materiaPrimaId", "inicio", "fim", "unidade", "quantidadeAlvo", "cidade", "uf");
        return chamada;
    }

    private ObjectNode objetoFechado() {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("type", "object");
        node.put("additionalProperties", false);
        return node;
    }

    private ObjectNode enumTexto(List<String> valores) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("type", "string");
        ArrayNode valoresNode = node.putArray("enum");
        valores.forEach(valoresNode::add);
        return node;
    }

    private void obrigatorios(ObjectNode node, String... campos) {
        ArrayNode required = node.putArray("required");
        for (String campo : campos) required.add(campo);
    }

    private String propertiesProviderSchemaVersion() {
        return properties.getSchemaVersion();
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
            throw erro(CodigoErroOrquestrador.NAO_AUTORIZADO, HttpStatus.SERVICE_UNAVAILABLE,
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
