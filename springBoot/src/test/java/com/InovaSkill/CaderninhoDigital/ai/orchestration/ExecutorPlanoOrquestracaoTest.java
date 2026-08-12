package com.InovaSkill.CaderninhoDigital.ai.orchestration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.InovaSkill.CaderninhoDigital.ai.contract.*;
import com.InovaSkill.CaderninhoDigital.ai.tool.ExecutorFerramentas;
import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import com.InovaSkill.CaderninhoDigital.exception.CodigoErroOrquestrador;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import com.InovaSkill.CaderninhoDigital.security.UsuarioPrincipal;

class ExecutorPlanoOrquestracaoTest {
    private final ExecutorFerramentas ferramentas = mock(ExecutorFerramentas.class);
    private final AiOrchestratorProperties properties = new AiOrchestratorProperties();
    private ExecutorService executorService;
    private ExecutorPlanoOrquestracao executor;

    @BeforeEach
    void preparar() {
        executorService = Executors.newVirtualThreadPerTaskExecutor();
        executor = new ExecutorPlanoOrquestracao(ferramentas, executorService, properties);
    }

    @AfterEach
    void encerrar() {
        SecurityContextHolder.clearContext();
        executorService.close();
    }

    @Test
    void propagaIdentidadeAutenticadaParaThreadDeExecucao() {
        var principal = new UsuarioPrincipal(7L, "Gestora", "gestora@example.invalid", "x", null,
                "GESTOR", false);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
        when(ferramentas.executar(any(), any())).thenAnswer(invocation -> {
            assertThat(SecurityContextHolder.getContext().getAuthentication().getPrincipal()).isSameAs(principal);
            return resultado(FerramentaPermitida.RESUMO_VENDAS);
        });

        assertThat(executor.executar(List.of(chamada(FerramentaPermitida.RESUMO_VENDAS)), "corr"))
                .hasSize(1);
    }

    @Test
    void executaDuasFerramentasUmaVezNaOrdem() {
        when(ferramentas.executar(any(), any())).thenReturn(resultado(FerramentaPermitida.RESUMO_VENDAS))
                .thenReturn(resultado(FerramentaPermitida.RESUMO_GASTOS));
        var chamadas = List.of(chamada(FerramentaPermitida.RESUMO_VENDAS),
                chamada(FerramentaPermitida.RESUMO_GASTOS));

        assertThat(executor.executar(chamadas, "corr")).extracting(ResultadoFerramenta::ferramenta)
                .containsExactly(FerramentaPermitida.RESUMO_VENDAS, FerramentaPermitida.RESUMO_GASTOS);
        verify(ferramentas, times(2)).executar(any(), eq("corr"));
    }

    @Test
    void interrompeDepoisDaPrimeiraFalha() {
        when(ferramentas.executar(any(), any())).thenThrow(new OrquestradorException(
                CodigoErroOrquestrador.ERRO_INTERNO, org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR, "erro"));

        assertThatThrownBy(() -> executor.executar(List.of(chamada(FerramentaPermitida.RESUMO_VENDAS),
                chamada(FerramentaPermitida.RESUMO_GASTOS)), "corr"))
                .isInstanceOf(OrquestradorException.class);
        verify(ferramentas, times(1)).executar(any(), any());
    }

    @Test
    void preservaPrimeiroResultadoMasFalhaOPlanoQuandoSegundaFerramentaFalha() {
        when(ferramentas.executar(any(), any())).thenReturn(resultado(FerramentaPermitida.RESUMO_VENDAS))
                .thenThrow(new OrquestradorException(CodigoErroOrquestrador.TIMEOUT,
                        org.springframework.http.HttpStatus.GATEWAY_TIMEOUT, "timeout"));

        assertThatThrownBy(() -> executor.executar(List.of(chamada(FerramentaPermitida.RESUMO_VENDAS),
                chamada(FerramentaPermitida.RESUMO_GASTOS)), "corr"))
                .isInstanceOfSatisfying(OrquestradorException.class,
                        erro -> assertThat(erro.getCodigo()).isEqualTo(CodigoErroOrquestrador.TIMEOUT));
        verify(ferramentas, times(2)).executar(any(), any());
    }

    @Test
    void aplicaOrcamentoTotalECancelaOPlano() {
        properties.getLimits().setRequestBudgetMillis(20);
        when(ferramentas.executar(any(), any())).thenAnswer(invocation -> {
            Thread.sleep(5_000);
            return resultado(FerramentaPermitida.RESUMO_VENDAS);
        });

        assertThatThrownBy(() -> executor.executar(List.of(chamada(FerramentaPermitida.RESUMO_VENDAS)), "corr"))
                .isInstanceOfSatisfying(OrquestradorException.class,
                        erro -> assertThat(erro.getCodigo()).isEqualTo(CodigoErroOrquestrador.TIMEOUT));
    }

    private ChamadaFerramenta chamada(FerramentaPermitida ferramenta) {
        return new ChamadaFerramenta(ferramenta, new ArgumentosSemFiltro());
    }

    private ResultadoFerramenta resultado(FerramentaPermitida ferramenta) {
        return new ResultadoFerramenta(ferramenta, StatusResultado.SUCESSO, Map.of(), null, null,
                Instant.parse("2026-08-08T12:00:00Z"), List.of(), QualidadeResultado.COMPLETO);
    }
}
