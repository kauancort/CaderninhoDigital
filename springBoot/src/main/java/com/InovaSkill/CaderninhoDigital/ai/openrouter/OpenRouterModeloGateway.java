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
import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
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
@Slf4j
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
            String json = normalizarJsonEstruturado(removerCercaMarkdown(response.content()), tipoResposta);
            T parsed = contractMapper.readValue(json, tipoResposta);
            if (!validator.validate(parsed).isEmpty()) {
                throw erro(CodigoErroOrquestrador.PLANO_INVALIDO, HttpStatus.BAD_GATEWAY,
                        "O provedor retornou uma resposta estruturada incompleta");
            }
            return new RespostaModelo<>(parsed, response.metadata());
        } catch (OrquestradorException exception) {
            throw exception;
        } catch (Exception exception) {
            log.warn("Resposta estruturada inválida no OpenRouter: tipo={} causa={}",
                    tipoResposta.getSimpleName(), exception.getClass().getSimpleName());
            throw erro(CodigoErroOrquestrador.PLANO_INVALIDO, HttpStatus.BAD_GATEWAY,
                    "O provedor retornou uma resposta estruturada inválida");
        }
    }

    private ParsedResponse executar(SolicitacaoModelo solicitacao, boolean jsonEstruturado, Class<?> tipoResposta,
            Duration timeout) {
        politicaDados.validarSolicitacaoModelo(solicitacao);
        validarConfiguracao();
        OrquestradorException ultimaFalha = null;
        long inicio = System.nanoTime();
        for (String modelo : modelosDisponiveis()) {
            try {
                return executarModelo(solicitacao, jsonEstruturado, tipoResposta,
                        tempoRestante(timeout, inicio), modelo);
            } catch (OrquestradorException exception) {
                ultimaFalha = exception;
                if (!permiteFallback(exception.getCodigo(), modelo)) throw exception;
                log.warn("OpenRouter indisponível para etapa estruturada/textual; tentando modelo alternativo. "
                                + "codigo={} modelo={}", exception.getCodigo(), modelo);
            }
        }
        throw ultimaFalha == null
                ? erro(CodigoErroOrquestrador.PROVEDOR_INDISPONIVEL, HttpStatus.SERVICE_UNAVAILABLE,
                        "O provedor está temporariamente indisponível")
                : ultimaFalha;
    }

    private ParsedResponse executarModelo(SolicitacaoModelo solicitacao, boolean jsonEstruturado,
            Class<?> tipoResposta, Duration timeout, String modelo) {
        long inicio = System.nanoTime();
        ObjectNode body = criarBody(solicitacao, jsonEstruturado, tipoResposta, modelo);
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
        classificarStatus(response);
        return interpretarResposta(response.body(), inicio, modelo);
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

    private ObjectNode criarBody(SolicitacaoModelo solicitacao, boolean jsonEstruturado, Class<?> tipoResposta,
            String modelo) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("model", modelo);
        int maxTokens = properties.getLimits().getMaxOutputTokens();
        if (jsonEstruturado && tipoResposta == ExtracaoOfertasMercado.class) {
            maxTokens = Math.max(maxTokens, properties.getSearch().getInterpretationMaxOutputTokens());
        }
        body.put("max_tokens", maxTokens);
        ArrayNode messages = body.putArray("messages");
        for (MensagemModelo mensagem : solicitacao.mensagens()) {
            ObjectNode item = messages.addObject();
            item.put("role", mensagem.papel().providerValue());
            item.put("content", mensagem.conteudo());
        }
        if (jsonEstruturado) {
            body.putObject("provider").put("require_parameters", true);
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
                "ANALISAR_MARGEM_PRODUTO", "ANALISE_EMPRESARIAL",
                "ANALISAR_RENTABILIDADE_PRODUTO",
                "ANALISAR_COMPRAS_INSUMO", "COMPARAR_VENDAS_GASTOS",
                "COMPARAR_VENDAS_PERIODOS", "COMPARAR_PRECO_MERCADO", "DESCONHECIDA")));
        ObjectNode chamadas = properties.putObject("chamadas");
        chamadas.put("type", "array");
        chamadas.put("minItems", 1);
        chamadas.put("maxItems", Math.min(this.properties.getLimits().getToolsPerPlan(),
                this.properties.getLimits().getToolCalls()));
        ArrayNode alternativas = chamadas.putObject("items").putArray("anyOf");
        alternativas.add(schemaChamada("RESUMO_ESTOQUE", "SEM_FILTRO", List.of()));
        alternativas.add(schemaChamada("RESUMO_VENDAS", "PERIODO", List.of("inicio", "fim")));
        alternativas.add(schemaChamada("RESUMO_GASTOS", "PERIODO", List.of("inicio", "fim")));
        alternativas.add(schemaChamada("RESUMO_RECEBIVEIS", "PERIODO", List.of("inicio", "fim")));
        alternativas.add(schemaChamada("ANALISE_CUSTO_PRODUTO", "PRODUTO", List.of("produtoId")));
        alternativas.add(schemaChamada("ANALISE_MARGEM_PRODUTO", "PRODUTO_PERIODO",
                List.of("produtoId", "inicio", "fim")));
        alternativas.add(schemaChamadaRentabilidade());
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
        ObjectNode fontes = properties.putObject("fontes");
        fontes.put("type", "array");
        // Uma pesquisa pode não conter nenhuma oferta validável. A ausência de
        // fontes é tratada pelo backend como cobertura não concluída, nunca como
        // autorização para calcular um preço.
        fontes.put("minItems", 0);
        fontes.put("maxItems", 5);

        ObjectNode fonte = objetoFechado();
        ObjectNode fonteCampos = fonte.putObject("properties");
        fonteCampos.set("fonteId", textoLimitado(40, false));
        fonteCampos.set("status", enumTexto(List.of("ACEITA", "REJEITADA", "NAO_CONCLUIDA")));
        fonteCampos.set("motivo", textoLimitado(240, true));

        ObjectNode ofertas = fonteCampos.putObject("ofertas");
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
        campos.set("marca", textoLimitado(120, true));
        campos.set("fornecedor", textoLimitado(120, true));
        obrigatorios(oferta, "fonteId", "produto", "precoAnunciado", "tipoPreco", "unidadePreco",
                "quantidadeEmbalagem", "unidadeEmbalagem", "pedidoMinimo", "unidadePedidoMinimo",
                "frete", "validade", "localizacao", "evidenciaPreco", "evidenciaPedidoMinimo", "confianca",
                "marca", "fornecedor");
        ofertas.set("items", oferta);
        obrigatorios(fonte, "fonteId", "status", "motivo", "ofertas");
        fontes.set("items", fonte);
        obrigatorios(schema, "fontes");
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

    private ObjectNode schemaChamadaRentabilidade() {
        ObjectNode chamada = schemaChamada("ANALISAR_RENTABILIDADE_PRODUTO", "RENTABILIDADE_PRODUTO",
                List.of("produtoId", "inicio", "fim"));
        ObjectNode props = (ObjectNode) chamada.path("properties").path("argumentos").path("properties");
        props.set("modalidade", enumOuNulo(List.of("UNIDADE", "CAIXA", "PACOTE", "DUZIA", "PESO", "POTE")));
        ObjectNode preco = objectMapper.createObjectNode();
        ArrayNode tipos = preco.putArray("type"); tipos.add("number"); tipos.add("null");
        preco.put("exclusiveMinimum", 0); props.set("precoConsultado", preco);
        ObjectNode argumentos = (ObjectNode) chamada.path("properties").path("argumentos");
        obrigatorios(argumentos, "tipo", "produtoId", "inicio", "fim", "modalidade", "precoConsultado");
        return chamada;
    }

    private ObjectNode schemaChamadaComparacaoMercado() {
        ObjectNode chamada = schemaChamada("COMPARAR_PRECO_MERCADO", "COMPARACAO_MERCADO",
                List.of("materiaPrimaId", "inicio", "fim"));
        ObjectNode props = (ObjectNode) chamada.path("properties").path("argumentos").path("properties");
        ObjectNode unidade = props.putObject("unidade");
        unidade.putArray("type").add("string").add("null"); unidade.put("maxLength", 30);
        ObjectNode quantidade = props.putObject("quantidadeAlvo");
        quantidade.putArray("type").add("number").add("null"); quantidade.put("exclusiveMinimum", 0);
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

    private ParsedResponse interpretarResposta(String rawBody, long inicio, String requestedModel) {
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

    private void classificarStatus(OpenRouterHttpResponse response) {
        int status = response.statusCode();
        if (status >= 200 && status < 300) return;
        if (status == 400) {
            throw erro(CodigoErroOrquestrador.ARGUMENTOS_INVALIDOS, HttpStatus.BAD_GATEWAY,
                    "O OpenRouter rejeitou a solicitação enviada");
        }
        if (status == 401 || status == 403) {
            throw erro(CodigoErroOrquestrador.NAO_AUTORIZADO, HttpStatus.SERVICE_UNAVAILABLE,
                    "O OpenRouter não autorizou a integração");
        }
        if (status == 429) {
            String limite = motivoLimite(response.body());
            String retryAfter = retryAfterSeguro(response.header("retry-after"));
            throw erro(CodigoErroOrquestrador.LIMITE_EXCEDIDO, HttpStatus.TOO_MANY_REQUESTS,
                    "O limite do OpenRouter foi atingido" + (limite == null ? "" : " (" + limite + ")")
                            + (retryAfter == null ? "." : ". Tente novamente após " + retryAfter + " segundos."));
        }
        throw erro(CodigoErroOrquestrador.PROVEDOR_INDISPONIVEL, HttpStatus.SERVICE_UNAVAILABLE,
                "O OpenRouter está temporariamente indisponível");
    }

    private String motivoLimite(String body) {
        try {
            JsonNode metadata = objectMapper.readTree(body).path("error").path("metadata");
            String source = metadata.path("limit_source").asText(null);
            if ("upstream_provider_shared_pool".equals(source)) return "pool compartilhado do provedor";
            if ("account".equals(source)) return "limite da conta";
            if (source != null && source.matches("[A-Za-z0-9_-]{1,60}")) return "limite " + source;
        } catch (Exception ignored) {
            // O corpo do provedor nunca deve ser propagado para a resposta.
        }
        return null;
    }

    private String retryAfterSeguro(String valor) {
        return valor != null && valor.matches("[0-9]{1,6}") ? valor : null;
    }

    private List<String> modelosDisponiveis() {
        List<String> modelos = new ArrayList<>();
        String principal = properties.getProvider().getModel();
        if (principal != null && !principal.isBlank()) modelos.add(principal.trim());
        String fallback = properties.getProvider().getFallbackModel();
        if (fallback != null && !fallback.isBlank() && !modelos.contains(fallback.trim())) modelos.add(fallback.trim());
        return modelos;
    }

    private boolean permiteFallback(CodigoErroOrquestrador codigo, String modeloAtual) {
        String fallback = properties.getProvider().getFallbackModel();
        return fallback != null && !fallback.isBlank() && !fallback.trim().equals(modeloAtual)
                && (codigo == CodigoErroOrquestrador.LIMITE_EXCEDIDO
                        || codigo == CodigoErroOrquestrador.PROVEDOR_INDISPONIVEL
                        || codigo == CodigoErroOrquestrador.TIMEOUT);
    }

    private void validarConfiguracao() {
        if (properties.getProvider().getKey() == null || properties.getProvider().getKey().isBlank()) {
            throw erro(CodigoErroOrquestrador.PROVEDOR_INDISPONIVEL, HttpStatus.SERVICE_UNAVAILABLE,
                    "A integração com o provedor não está configurada");
        }
    }

    private Duration tempoRestante(Duration solicitado, long inicio) {
        long budget = properties.getLimits().getRequestBudgetMillis();
        if (budget <= 0) return solicitado;
        long decorrido = Duration.ofNanos(System.nanoTime() - inicio).toMillis();
        long restante = budget - decorrido;
        if (restante <= 0) {
            throw erro(CodigoErroOrquestrador.TIMEOUT, HttpStatus.GATEWAY_TIMEOUT,
                    "O orçamento de tempo do provedor foi excedido");
        }
        return Duration.ofMillis(Math.min(solicitado.toMillis(), restante));
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
        String limpo = content.replace("```json", "").replace("```", "").trim();
        int inicio = limpo.indexOf('{');
        int fim = limpo.lastIndexOf('}');
        return inicio >= 0 && fim > inicio ? limpo.substring(inicio, fim + 1).trim() : limpo;
    }

    /**
     * Normaliza apenas representações equivalentes antes da validação do
     * contrato. Não cria preço, unidade ou evidência que não vieram do modelo.
     * Isso cobre respostas de modelos que serializam números como texto e o
     * contrato plano usado por versões anteriores da aplicação.
     */
    private String normalizarJsonEstruturado(String content, Class<?> tipoResposta) throws Exception {
        JsonNode raiz = objectMapper.readTree(content);
        if (tipoResposta == ExtracaoOfertasMercado.class && raiz != null && raiz.isObject()) {
            normalizarExtracao((ObjectNode) raiz);
        }
        return objectMapper.writeValueAsString(raiz);
    }

    private void normalizarExtracao(ObjectNode raiz) {
        JsonNode legado = raiz.get("ofertas");
        if (!raiz.has("fontes") && legado != null && legado.isArray()) {
            raiz.set("fontes", agruparOfertas(legado));
            raiz.remove("ofertas");
        }
        JsonNode fontesNode = raiz.get("fontes");
        if (fontesNode == null || !fontesNode.isArray()) return;
        for (JsonNode fonteNode : fontesNode) {
            if (!(fonteNode instanceof ObjectNode fonte)) continue;
            normalizarFonte(fonte);
        }
    }

    private ArrayNode agruparOfertas(JsonNode legado) {
        Map<String, ArrayNode> porFonte = new LinkedHashMap<>();
        for (JsonNode ofertaNode : legado) {
            if (!(ofertaNode instanceof ObjectNode oferta)) continue;
            normalizarOferta(oferta);
            String fonteId = oferta.path("fonteId").asText("");
            porFonte.computeIfAbsent(fonteId, ignorado -> objectMapper.createArrayNode()).add(oferta);
        }
        ArrayNode fontes = objectMapper.createArrayNode();
        porFonte.forEach((fonteId, ofertas) -> {
            ObjectNode fonte = objectMapper.createObjectNode();
            fonte.put("fonteId", fonteId);
            fonte.put("status", "ACEITA");
            fonte.putNull("motivo");
            fonte.set("ofertas", ofertas);
            fontes.add(fonte);
        });
        return fontes;
    }

    private void normalizarFonte(ObjectNode fonte) {
        vazioParaNulo(fonte, "motivo");
        JsonNode ofertasNode = fonte.get("ofertas");
        if (ofertasNode == null || ofertasNode.isNull()) {
            fonte.set("ofertas", objectMapper.createArrayNode());
            ofertasNode = fonte.get("ofertas");
        }
        if (!fonte.has("status") || fonte.get("status").isNull() || fonte.path("status").asText().isBlank()) {
            fonte.put("status", ofertasNode.isArray() && ofertasNode.size() > 0 ? "ACEITA" : "REJEITADA");
        } else {
            normalizarEnum(fonte, "status");
        }
        if (!fonte.has("motivo")) fonte.putNull("motivo");
        if (ofertasNode.isArray()) {
            for (JsonNode ofertaNode : ofertasNode) {
                if (ofertaNode instanceof ObjectNode oferta) normalizarOferta(oferta);
            }
        }
    }

    private void normalizarOferta(ObjectNode oferta) {
        for (String campo : List.of("precoAnunciado", "quantidadeEmbalagem", "pedidoMinimo", "frete")) {
            numeroTextoParaNumero(oferta, campo);
        }
        for (String campo : List.of("unidadePreco", "unidadeEmbalagem", "unidadePedidoMinimo",
                "tipoPreco", "confianca")) {
            normalizarEnum(oferta, campo);
        }
        for (String campo : List.of("quantidadeEmbalagem", "unidadeEmbalagem", "pedidoMinimo",
                "unidadePedidoMinimo", "frete", "validade", "localizacao", "evidenciaPedidoMinimo")) {
            vazioParaNulo(oferta, campo);
        }
        JsonNode validade = oferta.get("validade");
        if (validade != null && validade.isTextual() && validade.asText().matches("\\d{2}/\\d{2}/\\d{4}")) {
            String[] partes = validade.asText().split("/");
            oferta.put("validade", partes[2] + "-" + partes[1] + "-" + partes[0]);
        }
    }

    private void numeroTextoParaNumero(ObjectNode objeto, String campo) {
        JsonNode valor = objeto.get(campo);
        if (valor == null || valor.isNull() || !valor.isTextual()) return;
        String texto = valor.asText().trim().replaceAll("(?i)r\\$", "").replaceAll("\\s+", "");
        if (texto.isBlank()) {
            objeto.putNull(campo);
            return;
        }
        try {
            if (texto.contains(",")) texto = texto.replace(".", "").replace(',', '.');
            objeto.put(campo, new BigDecimal(texto));
        } catch (NumberFormatException ignorado) {
            // A validação posterior rejeita o campo sem transformar texto em preço.
        }
    }

    private void normalizarEnum(ObjectNode objeto, String campo) {
        JsonNode valor = objeto.get(campo);
        if (valor == null || valor.isNull() || !valor.isTextual()) return;
        String normalizado = Normalizer.normalize(valor.asText(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "").trim().toUpperCase(Locale.ROOT)
                .replace(' ', '_').replace('-', '_');
        normalizado = switch (normalizado) {
            case "QUILO", "QUILOS" -> "KG";
            case "LITRO", "LITROS" -> "L";
            case "UNIDADES" -> "UNIDADE";
            case "UNITARIO", "UNITARIA", "POR_UNIDADE" -> "UNITARIO";
            case "TOTAL", "EMBALAGEM", "TOTAL_DA_EMBALAGEM" -> "TOTAL_EMBALAGEM";
            case "NAO_CONCLUIDA", "NAO_CONCLUIDO" -> "NAO_CONCLUIDA";
            case "MEDIA" -> "MEDIA";
            default -> normalizado;
        };
        objeto.put(campo, normalizado);
    }

    private void vazioParaNulo(ObjectNode objeto, String campo) {
        JsonNode valor = objeto.get(campo);
        if (valor != null && valor.isTextual() && valor.asText().isBlank()) objeto.putNull(campo);
    }

    private OrquestradorException erro(CodigoErroOrquestrador codigo, HttpStatus status, String mensagem) {
        return new OrquestradorException(codigo, status, mensagem);
    }

    private record ParsedResponse(String content, MetadadosModelo metadata) {}
}
