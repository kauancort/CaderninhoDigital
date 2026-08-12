package com.InovaSkill.CaderninhoDigital.ai.observability;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import com.InovaSkill.CaderninhoDigital.ai.gateway.MetadadosModelo;
import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class ControleOperacionalIaTest {
    private final Clock clock = Clock.fixed(Instant.parse("2026-08-06T12:00:00Z"), ZoneOffset.UTC);

    @Test void auditaSomenteMetadadosETokensAusentesComoParciais() {
        var controle = novo(new AiOrchestratorProperties());
        var sessao = controle.iniciar(7L, "corr-1");
        sessao.intencao("CONSULTAR_ESTOQUE"); sessao.antesModelo();
        sessao.metadados(new MetadadosModelo("pedido", "efetivo", null, null, null, 10, true));
        sessao.ferramenta("RESUMO_ESTOQUE"); sessao.concluir("SUCESSO", null);
        assertThat(controle.eventos()).singleElement().satisfies(evento -> {
            assertThat(evento.correlacao()).isEqualTo("corr-1");
            assertThat(evento.medicaoTokensParcial()).isTrue();
            assertThat(evento.toString()).doesNotContain("cpf", "email", "pergunta", "resposta");
        });
    }

    @Test void bloqueiaLimitePorUsuarioEGlobal() {
        var props = new AiOrchestratorProperties(); props.getLimits().setRequestsPerUserWindow(1);
        var controle = novo(props); controle.iniciar(7L, "a");
        var controleUsuario = controle;
        assertThatThrownBy(() -> controleUsuario.iniciar(7L, "b")).isInstanceOf(OrquestradorException.class);
        props = new AiOrchestratorProperties(); props.getLimits().setRequestsGlobalWindow(1);
        controle = novo(props); controle.iniciar(7L, "a");
        var finalControle = controle;
        assertThatThrownBy(() -> finalControle.iniciar(8L, "b")).isInstanceOf(OrquestradorException.class);
    }

    @Test void concorrenciaNaoUltrapassaLimiteGlobal() throws Exception {
        var props = new AiOrchestratorProperties(); props.getLimits().setRequestsGlobalWindow(10);
        props.getLimits().setRequestsPerUserWindow(20); var controle = novo(props);
        var inicio = new CountDownLatch(1); var permitidas = new AtomicInteger();
        try (var pool = Executors.newVirtualThreadPerTaskExecutor()) {
            for (long i=0;i<30;i++) { long id=i; pool.submit(() -> { inicio.await();
                try { controle.iniciar(id, "c"+id); permitidas.incrementAndGet(); } catch (OrquestradorException ignored) {}
                return null; }); }
            inicio.countDown(); pool.shutdown(); assertThat(pool.awaitTermination(5, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
        }
        assertThat(permitidas).hasValue(10);
    }

    @Test void aplicaOrcamentoDiarioEMantemAuditoriaLimitada() {
        var props = new AiOrchestratorProperties(); props.getLimits().setModelCallsPerUserDay(1);
        props.getLimits().setAuditCapacity(1); var controle = novo(props);
        var primeira = controle.iniciar(7L, "primeira"); primeira.antesModelo();
        primeira.metadados(new MetadadosModelo("m", "m", 2, 3, 5, 1, false));
        primeira.concluir("SUCESSO", null);
        var segunda = controle.iniciar(7L, "segunda");
        assertThatThrownBy(segunda::antesModelo).isInstanceOf(OrquestradorException.class);
        segunda.concluir("ERRO", com.InovaSkill.CaderninhoDigital.exception.CodigoErroOrquestrador.LIMITE_EXCEDIDO);
        assertThat(controle.eventos()).singleElement().extracting(EventoAuditoriaIa::correlacao)
                .isEqualTo("segunda");
    }

    private ControleOperacionalIa novo(AiOrchestratorProperties props) {
        return new ControleOperacionalIa(props, new SimpleMeterRegistry(), clock);
    }
}
