package com.InovaSkill.CaderninhoDigital.ai.tool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.InovaSkill.CaderninhoDigital.ai.contract.ArgumentosPeriodo;
import com.InovaSkill.CaderninhoDigital.ai.contract.ArgumentosSemFiltro;
import com.InovaSkill.CaderninhoDigital.ai.contract.ChamadaFerramenta;
import com.InovaSkill.CaderninhoDigital.ai.contract.FerramentaPermitida;
import com.InovaSkill.CaderninhoDigital.ai.contract.QualidadeResultado;
import com.InovaSkill.CaderninhoDigital.ai.contract.ResultadoFerramenta;
import com.InovaSkill.CaderninhoDigital.ai.contract.StatusResultado;
import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import com.InovaSkill.CaderninhoDigital.enums.PerfilUsuario;
import com.InovaSkill.CaderninhoDigital.exception.CodigoErroOrquestrador;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import com.InovaSkill.CaderninhoDigital.security.UsuarioPrincipal;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.MapperFeature;
import jakarta.validation.Validation;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

class ExecutorFerramentasTest {
    private static final Instant AGORA = Instant.parse("2026-08-06T12:00:00Z");
    private static final ZoneId FUSO = ZoneId.of("America/Sao_Paulo");

    private AiOrchestratorProperties properties;
    private ExecutorService threads;
    private FerramentaFake ferramenta;
    private ExecutorFerramentas executor;

    @BeforeEach
    void setUp() {
        properties = new AiOrchestratorProperties();
        properties.getFeatures().setTools(true);
        properties.getLimits().setMaxPeriodDays(31);
        threads = Executors.newVirtualThreadPerTaskExecutor();
        ferramenta = new FerramentaFake();
        executor = criarExecutor(new CatalogoFerramentas(List.of(ferramenta)));
        autenticar(PerfilUsuario.GESTOR);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        threads.close();
    }

    @Test
    void registraFerramentaValidaEExpoeSomenteMetadadosDePlanejamento() {
        CatalogoFerramentas catalogo = new CatalogoFerramentas(List.of(ferramenta));

        assertThat(catalogo.localizar(FerramentaPermitida.RESUMO_VENDAS)).isSameAs(ferramenta);
        assertThat(catalogo.metadadosParaPlanejamento()).containsExactly(
                new MetadadosFerramenta(FerramentaPermitida.RESUMO_VENDAS,
                        "Resumo falso para teste", TipoArgumentosFerramenta.PERIODO));
    }

    @Test
    void rejeitaIdentificadorDuplicadoEFerramentaQueDeclareEscrita() {
        assertThatThrownBy(() -> new CatalogoFerramentas(List.of(ferramenta, new FerramentaFake())))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageNotContaining(FerramentaFake.class.getName());

        ferramenta.somenteLeitura = false;
        assertThatThrownBy(() -> new CatalogoFerramentas(List.of(ferramenta)))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void executaUmaVezComContextoConfiavelSemEscrita() {
        ResultadoFerramenta resultado = executor.executar(chamadaValida(), "corr-123");

        assertThat(resultado.status()).isEqualTo(StatusResultado.SUCESSO);
        assertThat(ferramenta.execucoes).hasValue(1);
        assertThat(ferramenta.escritas).hasValue(0);
        assertThat(ferramenta.contexto.identidade().usuarioId()).isEqualTo(7L);
        assertThat(ferramenta.contexto.identidade().perfil()).isEqualTo(PerfilUsuario.GESTOR);
        assertThat(ferramenta.contexto.correlacao()).isEqualTo("corr-123");
        assertThat(ferramenta.contexto.solicitadoEm()).isEqualTo(AGORA);
        assertThat(ferramenta.contexto.timezone()).isEqualTo(FUSO);
    }

    @Test
    void rejeitaFerramentaNaoRegistradaEFlagDesabilitada() {
        ExecutorFerramentas vazio = criarExecutor(new CatalogoFerramentas(List.of()));
        assertErro(() -> vazio.executar(chamadaValida(), null),
                CodigoErroOrquestrador.FERRAMENTA_DESCONHECIDA);

        properties.getFeatures().setTools(false);
        assertErro(() -> executor.executar(chamadaValida(), null),
                CodigoErroOrquestrador.FERRAMENTA_DESCONHECIDA);
    }

    @Test
    void rejeitaCampoObrigatorioAusenteETipoDeArgumentoIncorreto() {
        assertErro(() -> executor.executar(new ChamadaFerramenta(
                        FerramentaPermitida.RESUMO_VENDAS,
                        new ArgumentosPeriodo(null, LocalDate.parse("2026-08-06"))), null),
                CodigoErroOrquestrador.ARGUMENTOS_INVALIDOS);
        assertErro(() -> executor.executar(new ChamadaFerramenta(
                        FerramentaPermitida.RESUMO_VENDAS, new ArgumentosSemFiltro()), null),
                CodigoErroOrquestrador.ARGUMENTOS_INVALIDOS);
    }

    @Test
    void rejeitaPeriodoInvertidoOuForaDoLimite() {
        assertErro(() -> executor.executar(new ChamadaFerramenta(
                        FerramentaPermitida.RESUMO_VENDAS,
                        new ArgumentosPeriodo(LocalDate.parse("2026-08-06"),
                                LocalDate.parse("2026-08-01"))), null),
                CodigoErroOrquestrador.ARGUMENTOS_INVALIDOS);
        assertErro(() -> executor.executar(new ChamadaFerramenta(
                        FerramentaPermitida.RESUMO_VENDAS,
                        new ArgumentosPeriodo(LocalDate.parse("2026-01-01"),
                                LocalDate.parse("2026-08-01"))), null),
                CodigoErroOrquestrador.ARGUMENTOS_INVALIDOS);
    }

    @Test
    void mapperFechadoRejeitaCampoExtraTipoIncorretoENomesArbitrarios() throws Exception {
        ObjectMapper mapper = new ObjectMapper().findAndRegisterModules()
                .disable(MapperFeature.ALLOW_COERCION_OF_SCALARS)
                .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
        String base = "{\"ferramenta\":\"RESUMO_VENDAS\",\"argumentos\":{"
                + "\"tipo\":\"PERIODO\",\"inicio\":\"2026-08-01\",\"fim\":\"2026-08-06\"%s}}";

        ChamadaFerramenta valida = mapper.readValue(base.formatted(""), ChamadaFerramenta.class);
        assertThat(valida.argumentos()).isInstanceOf(ArgumentosPeriodo.class);
        assertThatThrownBy(() -> mapper.readValue(base.formatted(",\"sql\":\"select 1\""),
                ChamadaFerramenta.class)).isInstanceOf(Exception.class);
        assertThatThrownBy(() -> mapper.readValue(base.formatted("").replace(
                "\"2026-08-01\"", "123"), ChamadaFerramenta.class)).isInstanceOf(Exception.class);
        for (String arbitrario : List.of("java.lang.Runtime", "SELECT * FROM usuarios", "https://host")) {
            String json = base.formatted("").replace("RESUMO_VENDAS", arbitrario);
            assertThatThrownBy(() -> mapper.readValue(json, ChamadaFerramenta.class))
                    .isInstanceOf(Exception.class);
        }
    }

    @Test
    void rejeitaUsuarioSemAutenticacaoOuSemPermissao() {
        SecurityContextHolder.clearContext();
        assertErro(() -> executor.executar(chamadaValida(), null),
                CodigoErroOrquestrador.NAO_AUTENTICADO);

        autenticar(PerfilUsuario.FUNCIONARIO);
        assertErro(() -> executor.executar(chamadaValida(), null),
                CodigoErroOrquestrador.NAO_AUTORIZADO);
        assertThat(ferramenta.execucoes).hasValue(0);
    }

    @Test
    void aplicaTimeoutECancelaExecucao() throws InterruptedException {
        ferramenta.modo = Modo.DEMORAR;
        ferramenta.timeout = Duration.ofMillis(30);

        assertErro(() -> executor.executar(chamadaValida(), null), CodigoErroOrquestrador.TIMEOUT);
        assertThat(ferramenta.execucoes).hasValue(1);
        assertThat(ferramenta.interrompida.await(500, TimeUnit.MILLISECONDS)).isTrue();
    }

    @Test
    void normalizaExcecaoInternaEResultadoVazio() {
        ferramenta.modo = Modo.FALHAR;
        assertThatThrownBy(() -> executor.executar(chamadaValida(), null))
                .isInstanceOfSatisfying(OrquestradorException.class, exception -> {
                    assertThat(exception.getCodigo()).isEqualTo(CodigoErroOrquestrador.ERRO_INTERNO);
                    assertThat(exception).hasMessageNotContaining("detalhe-interno");
                });

        ferramenta.modo = Modo.VAZIO;
        assertErro(() -> executor.executar(chamadaValida(), null), CodigoErroOrquestrador.ERRO_INTERNO);
    }

    private ExecutorFerramentas criarExecutor(CatalogoFerramentas catalogo) {
        var factory = new ContextoFerramentaFactory(Clock.fixed(AGORA, FUSO), properties);
        return new ExecutorFerramentas(catalogo, factory, properties,
                Validation.buildDefaultValidatorFactory().getValidator(), threads);
    }

    private ChamadaFerramenta chamadaValida() {
        return new ChamadaFerramenta(FerramentaPermitida.RESUMO_VENDAS,
                new ArgumentosPeriodo(LocalDate.parse("2026-08-01"), LocalDate.parse("2026-08-06")));
    }

    private void autenticar(PerfilUsuario perfil) {
        UsuarioPrincipal principal = new UsuarioPrincipal(
                7L, "nome", "email-interno", "senha-interna", "cargo", perfil.name(), false);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }

    private void assertErro(Runnable action, CodigoErroOrquestrador codigo) {
        assertThatThrownBy(action::run)
                .isInstanceOfSatisfying(OrquestradorException.class,
                        exception -> assertThat(exception.getCodigo()).isEqualTo(codigo));
    }

    private enum Modo { SUCESSO, DEMORAR, FALHAR, VAZIO }

    private static final class FerramentaFake implements FerramentaLeitura<ArgumentosPeriodo> {
        private final AtomicInteger execucoes = new AtomicInteger();
        private final AtomicInteger escritas = new AtomicInteger();
        private Duration timeout = Duration.ofSeconds(1);
        private Modo modo = Modo.SUCESSO;
        private boolean somenteLeitura = true;
        private final CountDownLatch interrompida = new CountDownLatch(1);
        private ContextoExecucaoFerramenta contexto;

        @Override public FerramentaPermitida identificador() { return FerramentaPermitida.RESUMO_VENDAS; }
        @Override public String descricao() { return "Resumo falso para teste"; }
        @Override public TipoArgumentosFerramenta tipoArgumentos() { return TipoArgumentosFerramenta.PERIODO; }
        @Override public Class<ArgumentosPeriodo> classeArgumentos() { return ArgumentosPeriodo.class; }
        @Override public PerfilUsuario permissaoNecessaria() { return PerfilUsuario.GESTOR; }
        @Override public Duration timeout() { return timeout; }
        @Override public boolean somenteLeitura() { return somenteLeitura; }

        @Override
        public ResultadoFerramenta executar(
                ArgumentosPeriodo argumentos,
                ContextoExecucaoFerramenta contexto
        ) {
            this.execucoes.incrementAndGet();
            this.contexto = contexto;
            if (modo == Modo.DEMORAR) {
                try {
                    Thread.sleep(5_000);
                } catch (InterruptedException exception) {
                    interrompida.countDown();
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException("interrompida", exception);
                }
            }
            if (modo == Modo.FALHAR) throw new IllegalStateException("detalhe-interno");
            if (modo == Modo.VAZIO) return null;
            return new ResultadoFerramenta(
                    identificador(), StatusResultado.SUCESSO, Map.of("total", 1),
                    argumentos.inicio(), argumentos.fim(), AGORA, List.of(), QualidadeResultado.COMPLETO);
        }
    }
}
