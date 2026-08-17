package com.InovaSkill.CaderninhoDigital.ai.openrouter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.InovaSkill.CaderninhoDigital.ai.contract.IntencaoOrquestrador;
import com.InovaSkill.CaderninhoDigital.ai.gateway.MensagemModelo;
import com.InovaSkill.CaderninhoDigital.ai.gateway.PapelMensagemModelo;
import com.InovaSkill.CaderninhoDigital.ai.gateway.RespostaModelo;
import com.InovaSkill.CaderninhoDigital.ai.gateway.SolicitacaoModelo;
import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import com.InovaSkill.CaderninhoDigital.ai.privacy.PoliticaDadosIa;
import com.InovaSkill.CaderninhoDigital.ai.search.ExtracaoOfertasMercado;
import com.InovaSkill.CaderninhoDigital.exception.CodigoErroOrquestrador;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.DeserializationFeature;
import java.util.concurrent.CompletableFuture;
import java.net.http.HttpTimeoutException;
import jakarta.validation.Validation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

class OpenRouterModeloGatewayTest {
    private static final String SECRET = "segredo-nao-pode-vazar";

    private AiOrchestratorProperties properties;
    private ObjectMapper mapper;
    private CapturingTransport transport;
    private OpenRouterModeloGateway gateway;

    @BeforeEach
    void setUp() {
        properties = new AiOrchestratorProperties();
        properties.getProvider().setKey(SECRET);
        properties.getProvider().setModel("modelo-solicitado");
        properties.getLimits().setReadTimeoutMs(100);
        properties.getLimits().setRequestBudgetMillis(100);
        mapper = new ObjectMapper();
        transport = new CapturingTransport();
        gateway = new OpenRouterModeloGateway(
                properties, mapper, mapper.copy().enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES),
                transport, Validation.buildDefaultValidatorFactory().getValidator(),
                new PoliticaDadosIa(properties));
    }

    @Test
    void geraTextoComHeadersEPayloadAllowlistedEMetadados() throws Exception {
        transport.complete(200, resposta("Tudo certo", "modelo-efetivo", true));

        RespostaModelo<String> response = gateway.gerarRespostaFinal(solicitacao());

        assertThat(response.conteudo()).isEqualTo("Tudo certo");
        assertThat(response.metadados().modeloSolicitado()).isEqualTo("modelo-solicitado");
        assertThat(response.metadados().modeloEfetivo()).isEqualTo("modelo-efetivo");
        assertThat(response.metadados().tokensEntrada()).isEqualTo(8);
        assertThat(response.metadados().tokensSaida()).isEqualTo(3);
        assertThat(response.metadados().tokensTotais()).isEqualTo(11);
        assertThat(response.metadados().modeloDivergente()).isTrue();
        assertThat(transport.request.headers()).containsOnlyKeys("Authorization", "Content-Type");
        assertThat(transport.request.headers().get("Authorization")).isEqualTo("Bearer " + SECRET);
        var body = mapper.readTree(transport.request.body());
        assertThat(body.properties().stream().map(java.util.Map.Entry::getKey).toList())
                .containsExactlyInAnyOrder("model", "max_tokens", "messages");
        assertThat(body.path("messages").get(0).properties().stream()
                .map(java.util.Map.Entry::getKey).toList())
                .containsExactlyInAnyOrder("role", "content");
        assertThat(transport.request.body()).contains("\"model\":\"modelo-solicitado\"");
    }

    @Test
    void geraPlanoEstruturadoValido() {
        String plano = "{\"schemaVersion\":\"1.0\",\"intencao\":\"RESUMO_NEGOCIO\","
                + "\"chamadas\":[],\"modoResposta\":\"TEXTO_SIMPLES\"}";
        transport.complete(200, resposta(plano, "modelo-solicitado", false));

        var response = gateway.gerarPlano(solicitacao());

        assertThat(response.conteudo().intencao()).isEqualTo(IntencaoOrquestrador.RESUMO_NEGOCIO);
        assertThat(transport.request.body())
                .contains("\"provider\":{\"require_parameters\":true}")
                .contains("\"response_format\":{\"type\":\"json_schema\"")
                .contains("\"strict\":true")
                .contains("\"maxItems\":5")
                .contains("\"additionalProperties\":false");
    }

    @Test
    void usaSchemaFechadoEspecificoParaExtracaoDeOfertas() {
        String extracao = "{\"fontes\":[{\"fonteId\":\"fonte-1\",\"status\":\"REJEITADA\",\"motivo\":\"sem oferta\",\"ofertas\":[]}]}";
        transport.complete(200, resposta(extracao, "modelo-solicitado", false));

        var response = gateway.gerarEstruturado(solicitacao(), ExtracaoOfertasMercado.class);

        assertThat(response.conteudo().ofertas()).isEmpty();
        assertThat(transport.request.body())
                .contains("\"name\":\"extracao_ofertas_mercado\"")
                .contains("\"fontes\"")
                .contains("\"evidenciaPreco\"")
                .contains("\"pedidoMinimo\"")
                .contains("\"additionalProperties\":false");
    }

    @Test
    void normalizaRespostaLegadaENumerosTextoSemInventarCampos() {
        String extracao = "{\"ofertas\":[{\"fonteId\":\"fonte-1\",\"produto\":\"Açúcar demerara\","
                + "\"precoAnunciado\":\"R$ 9,53\",\"tipoPreco\":\"unitário\",\"unidadePreco\":\"kg\","
                + "\"quantidadeEmbalagem\":\"\",\"unidadeEmbalagem\":\"\",\"pedidoMinimo\":null,"
                + "\"unidadePedidoMinimo\":null,\"frete\":null,\"validade\":\"\",\"localizacao\":\"\","
                + "\"evidenciaPreco\":\"R$ 9,53 por kg\",\"evidenciaPedidoMinimo\":\"\",\"confianca\":\"alta\"}]}";
        transport.complete(200, resposta(extracao, "modelo-solicitado", false));

        var response = gateway.gerarEstruturado(solicitacao(), ExtracaoOfertasMercado.class);

        assertThat(response.conteudo().fontes()).singleElement().satisfies(fonte -> {
            assertThat(fonte.status()).isEqualTo(ExtracaoOfertasMercado.Status.ACEITA);
            assertThat(fonte.ofertas()).singleElement().satisfies(oferta -> {
                assertThat(oferta.precoAnunciado()).isEqualByComparingTo("9.53");
                assertThat(oferta.tipoPreco()).isEqualTo(ExtracaoOfertasMercado.TipoPreco.UNITARIO);
                assertThat(oferta.unidadePreco()).isEqualTo(ExtracaoOfertasMercado.Unidade.KG);
            });
        });
    }

    @Test
    void reservaMaisTokensParaExtracaoDeVariasFontes() throws Exception {
        transport.complete(200, resposta("{\"fontes\":[]}", "modelo-solicitado", false));

        gateway.gerarEstruturado(solicitacao(), ExtracaoOfertasMercado.class);

        assertThat(mapper.readTree(transport.request.body()).path("max_tokens").asInt()).isEqualTo(4_000);
    }

    @Test
    void rejeitaJsonEstruturadoInvalidoOuComCampoExtra() {
        transport.complete(200, resposta("{\"campo\":true}", null, false));

        assertErro(() -> gateway.gerarPlano(solicitacao()), CodigoErroOrquestrador.PLANO_INVALIDO);

        transport.complete(200, resposta("{}", null, false));
        assertErro(() -> gateway.gerarPlano(solicitacao()), CodigoErroOrquestrador.PLANO_INVALIDO);
    }

    @Test
    void rejeitaCorpoVazioERespostaIncompleta() {
        transport.complete(200, "");
        assertErro(() -> gateway.gerarRespostaFinal(solicitacao()),
                CodigoErroOrquestrador.PROVEDOR_INDISPONIVEL);

        transport.complete(200, "{\"choices\":[]}");
        assertErro(() -> gateway.gerarRespostaFinal(solicitacao()),
                CodigoErroOrquestrador.PROVEDOR_INDISPONIVEL);
    }

    @Test
    void classifica400AutenticacaoLimiteEServidorSemExporCorpo() {
        assertStatus(400, CodigoErroOrquestrador.ARGUMENTOS_INVALIDOS);
        assertStatus(401, CodigoErroOrquestrador.NAO_AUTORIZADO);
        assertStatus(403, CodigoErroOrquestrador.NAO_AUTORIZADO);
        assertStatus(429, CodigoErroOrquestrador.LIMITE_EXCEDIDO);
        assertStatus(500, CodigoErroOrquestrador.PROVEDOR_INDISPONIVEL);
    }

    @Test
    void cancelaFutureQuandoExcedeTimeout() {
        transport.pending();

        assertErro(() -> gateway.gerarRespostaFinal(solicitacao()), CodigoErroOrquestrador.TIMEOUT);

        assertThat(transport.future.isCancelled()).isTrue();
    }

    @Test
    void classificaCancelamentoOriginadoNoTransporte() {
        transport.cancelled();

        assertErro(() -> gateway.gerarRespostaFinal(solicitacao()), CodigoErroOrquestrador.TIMEOUT);
    }

    @Test
    void classificaTimeoutOriginadoNoClienteHttp() {
        transport.failed(new HttpTimeoutException("timeout sem dados sensíveis"));

        assertErro(() -> gateway.gerarRespostaFinal(solicitacao()), CodigoErroOrquestrador.TIMEOUT);
    }

    @Test
    void aceitaMetadadosAusentesEModeloNaoInformado() {
        transport.complete(200, resposta("Olá", null, false));

        var metadata = gateway.gerarRespostaFinal(solicitacao()).metadados();

        assertThat(metadata.modeloEfetivo()).isNull();
        assertThat(metadata.tokensEntrada()).isNull();
        assertThat(metadata.tokensSaida()).isNull();
        assertThat(metadata.tokensTotais()).isNull();
        assertThat(metadata.modeloDivergente()).isFalse();
    }

    @Test
    void repeteUmaVezSomenteFalhaTransitoria() {
        transport.sequence(new OpenRouterHttpResponse(503, "indisponivel"),
                new OpenRouterHttpResponse(200, resposta("recuperado", null, false)));
        assertThat(gateway.gerarRespostaFinal(solicitacao()).conteudo()).isEqualTo("recuperado");
        assertThat(transport.chamadas).isEqualTo(2);

        transport.chamadas = 0;
        transport.complete(429, "limite");
        assertErro(() -> gateway.gerarRespostaFinal(solicitacao()), CodigoErroOrquestrador.LIMITE_EXCEDIDO);
        assertThat(transport.chamadas).isEqualTo(1);
    }

    @Test
    void tentaModeloReservaQuandoModeloPrincipalAtingeLimite() {
        properties.getProvider().setFallbackModel("modelo-reserva");
        transport.sequence(
                new OpenRouterHttpResponse(429, "{\"error\":{\"metadata\":{\"limit_source\":\"upstream_provider_shared_pool\"}}}"),
                new OpenRouterHttpResponse(200, resposta("recuperado pelo reserva", "modelo-reserva", false)));

        var response = gateway.gerarRespostaFinal(solicitacao());

        assertThat(response.conteudo()).isEqualTo("recuperado pelo reserva");
        assertThat(response.metadados().modeloSolicitado()).isEqualTo("modelo-reserva");
        assertThat(transport.chamadas).isEqualTo(2);
        assertThat(transport.request.body()).contains("\"model\":\"modelo-reserva\"");
    }

    @Test
    void descreveLimiteSemExporCorpoBrutoDoOpenRouter() {
        String corpo = "{\"error\":{\"message\":\"segredo do provedor\",\"metadata\":{\"limit_source\":\"upstream_provider_shared_pool\"}}}";
        transport.sequence(new OpenRouterHttpResponse(429, corpo,
                java.util.Map.of("Retry-After", "15")));

        assertThatThrownBy(() -> gateway.gerarRespostaFinal(solicitacao()))
                .isInstanceOf(OrquestradorException.class)
                .hasMessageContaining("pool compartilhado")
                .hasMessageContaining("15 segundos")
                .hasMessageNotContaining("segredo do provedor");
    }

    @Test
    void segredoNaoApareceEmExcecaoNemLogs() {
        Logger logger = (Logger) LoggerFactory.getLogger(OpenRouterModeloGateway.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        try {
            transport.complete(401, "corpo-sensivel-" + SECRET);

            assertThatThrownBy(() -> gateway.gerarRespostaFinal(solicitacao()))
                    .isInstanceOf(OrquestradorException.class)
                    .hasMessageNotContaining(SECRET)
                    .hasMessageNotContaining("corpo-sensivel");
            assertThat(appender.list).extracting(ILoggingEvent::getFormattedMessage)
                    .noneMatch(message -> message.contains(SECRET) || message.contains("corpo-sensivel"));
        } finally {
            logger.detachAppender(appender);
        }
    }

    private void assertStatus(int status, CodigoErroOrquestrador expected) {
        transport.complete(status, "corpo-sensivel-" + SECRET);
        assertErro(() -> gateway.gerarRespostaFinal(solicitacao()), expected);
    }

    private void assertErro(Runnable action, CodigoErroOrquestrador expected) {
        assertThatThrownBy(action::run)
                .isInstanceOfSatisfying(OrquestradorException.class,
                        exception -> assertThat(exception.getCodigo()).isEqualTo(expected))
                .hasMessageNotContaining(SECRET);
    }

    private SolicitacaoModelo solicitacao() {
        return new SolicitacaoModelo(java.util.List.of(
                new MensagemModelo(PapelMensagemModelo.USER, "mensagem segura")));
    }

    private String resposta(String content, String model, boolean usage) {
        var root = mapper.createObjectNode();
        root.putArray("choices").addObject().putObject("message").put("content", content);
        if (model != null) root.put("model", model);
        if (usage) {
            root.putObject("usage")
                    .put("prompt_tokens", 8)
                    .put("completion_tokens", 3)
                    .put("total_tokens", 11);
        }
        try {
            return mapper.writeValueAsString(root);
        } catch (Exception exception) {
            throw new AssertionError(exception);
        }
    }

    private static final class CapturingTransport implements OpenRouterTransport {
        private CompletableFuture<OpenRouterHttpResponse> future;
        private OpenRouterHttpRequest request;
        private final java.util.ArrayDeque<CompletableFuture<OpenRouterHttpResponse>> sequencia = new java.util.ArrayDeque<>();
        private int chamadas;

        @Override
        public CompletableFuture<OpenRouterHttpResponse> enviar(OpenRouterHttpRequest request) {
            this.request = request;
            chamadas++;
            return sequencia.isEmpty() ? future : sequencia.removeFirst();
        }

        void complete(int status, String body) {
            future = CompletableFuture.completedFuture(new OpenRouterHttpResponse(status, body));
        }

        void sequence(OpenRouterHttpResponse... responses) {
            sequencia.clear();
            for (var response : responses) sequencia.add(CompletableFuture.completedFuture(response));
        }

        void pending() {
            future = new CompletableFuture<>();
        }

        void cancelled() {
            future = new CompletableFuture<>();
            future.cancel(true);
        }

        void failed(Throwable throwable) {
            future = CompletableFuture.failedFuture(throwable);
        }
    }
}
