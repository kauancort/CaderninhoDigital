package com.InovaSkill.CaderninhoDigital.ai.observability;

import com.InovaSkill.CaderninhoDigital.ai.gateway.MetadadosModelo;
import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import com.InovaSkill.CaderninhoDigital.exception.CodigoErroOrquestrador;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import com.InovaSkill.CaderninhoDigital.ai.gateway.RespostaModelo;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class ControleOperacionalIa {
    private final AiOrchestratorProperties properties;
    private final MeterRegistry metrics;
    private final Clock clock;
    private final Map<Long, Janela> usuarios = new HashMap<>();
    private Janela global = new Janela(Instant.EPOCH, 0);
    private LocalDate dia;
    private int chamadasDiaGlobal;
    private long tokensDiaGlobal;
    private final Map<Long, ConsumoDia> consumoUsuario = new HashMap<>();
    private final ArrayDeque<EventoAuditoriaIa> eventos = new ArrayDeque<>();

    public ControleOperacionalIa(AiOrchestratorProperties properties, MeterRegistry metrics, Clock clock) {
        this.properties = properties; this.metrics = metrics; this.clock = clock;
    }

    public synchronized Sessao iniciar(Long usuarioId, String correlacao) {
        Instant agora = clock.instant();
        global = atualizar(global, agora);
        Janela usuario = atualizar(usuarios.get(usuarioId), agora);
        if (global.quantidade >= properties.getLimits().getRequestsGlobalWindow()
                || usuario.quantidade >= properties.getLimits().getRequestsPerUserWindow()) {
            metrics.counter("ai.bloqueios", "motivo", "rate_limit").increment();
            throw limite("Muitas solicitações à assistente. Aguarde um pouco e tente novamente.");
        }
        global = new Janela(global.inicio, global.quantidade + 1);
        usuarios.put(usuarioId, new Janela(usuario.inicio, usuario.quantidade + 1));
        metrics.counter("ai.solicitacoes").increment();
        return new Sessao(usuarioId, correlacao, agora);
    }

    private Janela atualizar(Janela janela, Instant agora) {
        if (janela == null || Duration.between(janela.inicio, agora).toSeconds()
                >= properties.getLimits().getRateWindowSeconds()) return new Janela(agora, 0);
        return janela;
    }

    private synchronized void autorizarModelo(Long usuarioId) {
        LocalDate hoje = LocalDate.now(clock);
        if (!hoje.equals(dia)) { dia = hoje; chamadasDiaGlobal = 0; tokensDiaGlobal = 0; consumoUsuario.clear(); }
        ConsumoDia usuario = consumoUsuario.getOrDefault(usuarioId, new ConsumoDia(0, 0));
        if (chamadasDiaGlobal >= properties.getLimits().getModelCallsGlobalDay()
                || usuario.chamadas >= properties.getLimits().getModelCallsPerUserDay()
                || tokensDiaGlobal >= properties.getLimits().getModelTokensGlobalDay()
                || usuario.tokens >= properties.getLimits().getModelTokensPerUserDay()) {
            metrics.counter("ai.bloqueios", "motivo", "orcamento_chamadas").increment();
            throw limite("O limite diário da assistente foi atingido. A consulta rápida de estoque continua disponível.");
        }
        chamadasDiaGlobal++;
        consumoUsuario.put(usuarioId, new ConsumoDia(usuario.chamadas + 1, usuario.tokens));
        metrics.counter("ai.modelo.chamadas").increment();
    }

    private synchronized void registrarTokens(Long usuarioId, MetadadosModelo metadados) {
        if (metadados.tokensTotais() == null) return;
        ConsumoDia usuario = consumoUsuario.getOrDefault(usuarioId, new ConsumoDia(0, 0));
        long novoUsuario = usuario.tokens + metadados.tokensTotais();
        long novoGlobal = tokensDiaGlobal + metadados.tokensTotais();
        consumoUsuario.put(usuarioId, new ConsumoDia(usuario.chamadas, novoUsuario));
        tokensDiaGlobal = novoGlobal;
        metrics.counter("ai.modelo.tokens").increment(metadados.tokensTotais());
    }

    private synchronized void armazenar(EventoAuditoriaIa evento) {
        while (eventos.size() >= properties.getLimits().getAuditCapacity()) eventos.removeFirst();
        eventos.addLast(evento);
    }

    public <T> RespostaModelo<T> executarModeloAuxiliar(Long usuarioId,
            Supplier<RespostaModelo<T>> chamada, String etapa) {
        autorizarModelo(usuarioId);
        RespostaModelo<T> resposta = chamada.get();
        registrarTokens(usuarioId, resposta.metadados());
        metrics.timer("ai.etapa.latencia", "etapa", etapa)
                .record(Duration.ofMillis(Math.max(0, resposta.metadados().duracaoMillis())));
        return resposta;
    }

    List<EventoAuditoriaIa> eventos() { synchronized (this) { return List.copyOf(eventos); } }

    private OrquestradorException limite(String mensagem) {
        return new OrquestradorException(CodigoErroOrquestrador.LIMITE_EXCEDIDO,
                HttpStatus.TOO_MANY_REQUESTS, mensagem);
    }

    public final class Sessao {
        private final Long usuario; private final String correlacao; private final Instant inicio;
        private String intencao = "NAO_DEFINIDA", modelo; private final List<String> ferramentas = new ArrayList<>();
        private int chamadas; private Integer entrada, saida, total; private boolean fallback;
        private Sessao(Long usuario, String correlacao, Instant inicio) { this.usuario=usuario; this.correlacao=correlacao; this.inicio=inicio; }
        public void intencao(String valor) { intencao = valor; }
        public void ferramenta(String valor) { ferramentas.add(valor); metrics.counter("ai.ferramentas", "id", valor).increment(); }
        public void antesModelo() { autorizarModelo(usuario); chamadas++; }
        public void metadados(MetadadosModelo m) { metadados(m, "modelo"); }
        public void metadados(MetadadosModelo m, String etapa) {
            modelo=m.modeloEfetivo(); entrada=somar(entrada,m.tokensEntrada()); saida=somar(saida,m.tokensSaida());
            total=somar(total,m.tokensTotais()); registrarTokens(usuario,m);
            metrics.timer("ai.etapa.latencia", "etapa", etapa)
                    .record(Duration.ofMillis(Math.max(0, m.duracaoMillis())));
        }
        public void ferramentasConcluidas(long duracaoNanos) {
            metrics.timer("ai.etapa.latencia", "etapa", "ferramentas")
                    .record(Duration.ofNanos(Math.max(0, duracaoNanos)));
        }
        public void fallback() { fallback=true; metrics.counter("ai.fallbacks").increment(); }
        public void concluir(String status, CodigoErroOrquestrador erro) {
            long duracao=Duration.between(inicio,clock.instant()).toMillis();
            metrics.timer("ai.latencia", "status", status).record(Duration.ofMillis(Math.max(0,duracao)));
            metrics.counter("ai.resultados", "status", status).increment();
            boolean autorizado = erro != CodigoErroOrquestrador.NAO_AUTORIZADO
                    && erro != CodigoErroOrquestrador.NAO_AUTENTICADO;
            armazenar(new EventoAuditoriaIa(correlacao,usuario,intencao,List.copyOf(ferramentas),autorizado,
                    modelo,chamadas,entrada,saida,total,total==null,duracao,status,
                    erro==null?null:erro.name(),properties.getPromptVersion(),properties.getSchemaVersion(),inicio));
        }
        private Integer somar(Integer atual,Integer valor){
            if (valor == null) return atual;
            return Integer.valueOf((atual == null ? 0 : atual.intValue()) + valor.intValue());
        }
    }

    private record Janela(Instant inicio, int quantidade) {}
    private record ConsumoDia(int chamadas, long tokens) {}
}
