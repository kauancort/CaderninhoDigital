package com.InovaSkill.CaderninhoDigital.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.InovaSkill.CaderninhoDigital.enums.SituacaoCobranca;
import com.InovaSkill.CaderninhoDigital.enums.StatusPagamento;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ClassificadorCobrancaServiceTest {

    private static final ZoneId FUSO_LOCAL = ZoneId.of("America/Sao_Paulo");
    private static final LocalDate HOJE = LocalDate.of(2026, 7, 23);

    private ClassificadorCobrancaService classificador;

    @BeforeEach
    void configurarRelogio() {
        Clock clock = Clock.fixed(Instant.parse("2026-07-23T15:00:00Z"), FUSO_LOCAL);
        classificador = new ClassificadorCobrancaService(clock);
    }

    @Test
    void classificaVencimentoFuturoComoEmDia() {
        assertThat(classificador.classificar(HOJE.plusDays(1), StatusPagamento.PENDENTE))
                .isEqualTo(SituacaoCobranca.EM_DIA);
    }

    @Test
    void classificaVencimentoHojeComoEmDia() {
        assertThat(classificador.classificar(HOJE, StatusPagamento.PENDENTE))
                .isEqualTo(SituacaoCobranca.EM_DIA);
        assertThat(classificador.calcularDiasAtraso(HOJE, StatusPagamento.PENDENTE)).isZero();
    }

    @Test
    void classificaUmDiaDeAtrasoComoRecente() {
        assertThat(classificador.classificar(HOJE.minusDays(1), StatusPagamento.PENDENTE))
                .isEqualTo(SituacaoCobranca.ATRASO_RECENTE);
    }

    @Test
    void mantemSeteDiasNoAtrasoRecente() {
        assertThat(classificador.classificar(HOJE.minusDays(7), StatusPagamento.PENDENTE))
                .isEqualTo(SituacaoCobranca.ATRASO_RECENTE);
    }

    @Test
    void iniciaAtrasoMedioComOitoDias() {
        assertThat(classificador.classificar(HOJE.minusDays(8), StatusPagamento.PENDENTE))
                .isEqualTo(SituacaoCobranca.ATRASO_MEDIO);
    }

    @Test
    void mantemTrintaDiasNoAtrasoMedio() {
        assertThat(classificador.classificar(HOJE.minusDays(30), StatusPagamento.PENDENTE))
                .isEqualTo(SituacaoCobranca.ATRASO_MEDIO);
    }

    @Test
    void iniciaMuitoAtrasadoComTrintaEUmDias() {
        assertThat(classificador.classificar(HOJE.minusDays(31), StatusPagamento.PENDENTE))
                .isEqualTo(SituacaoCobranca.MUITO_ATRASADO);
    }

    @Test
    void parcelaPagaNuncaPossuiDiasDeAtraso() {
        assertThat(classificador.calcularDiasAtraso(HOJE.minusDays(60), StatusPagamento.PAGO))
                .isZero();
        assertThat(classificador.classificar(HOJE.minusDays(60), StatusPagamento.PAGO))
                .isEqualTo(SituacaoCobranca.EM_DIA);
    }
}
