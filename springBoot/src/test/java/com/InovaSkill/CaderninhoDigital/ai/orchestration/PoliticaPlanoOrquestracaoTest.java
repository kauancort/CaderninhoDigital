package com.InovaSkill.CaderninhoDigital.ai.orchestration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.mock;

import com.InovaSkill.CaderninhoDigital.ai.contract.*;
import com.InovaSkill.CaderninhoDigital.exception.CodigoErroOrquestrador;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import com.InovaSkill.CaderninhoDigital.service.PlanoContratoValidator;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class PoliticaPlanoOrquestracaoTest {
    private final PoliticaPlanoOrquestracao politica =
            new PoliticaPlanoOrquestracao(mock(PlanoContratoValidator.class));

    @Test
    void rejeitaFerramentaDuplicadaComMesmoPeriodo() {
        var periodo = new ArgumentosPeriodo(LocalDate.parse("2026-07-01"), LocalDate.parse("2026-07-31"));
        var plano = new PlanoOrquestracao("1.0", IntencaoOrquestrador.COMPARAR_VENDAS_PERIODOS,
                List.of(new ChamadaFerramenta(FerramentaPermitida.RESUMO_VENDAS, periodo),
                        new ChamadaFerramenta(FerramentaPermitida.RESUMO_VENDAS, periodo)), ModoResposta.ANALITICA);

        assertThatThrownBy(() -> politica.validar(plano)).isInstanceOfSatisfying(OrquestradorException.class,
                erro -> assertThat(erro.getCodigo()).isEqualTo(CodigoErroOrquestrador.ARGUMENTOS_INVALIDOS));
    }

    @Test
    void rejeitaCombinacaoNaoAllowlisted() {
        var periodo = new ArgumentosPeriodo(LocalDate.parse("2026-07-01"), LocalDate.parse("2026-07-31"));
        var plano = new PlanoOrquestracao("1.0", IntencaoOrquestrador.COMPARAR_VENDAS_GASTOS,
                List.of(new ChamadaFerramenta(FerramentaPermitida.RESUMO_VENDAS, periodo),
                        new ChamadaFerramenta(FerramentaPermitida.RESUMO_RECEBIVEIS, periodo)), ModoResposta.ANALITICA);

        assertThatThrownBy(() -> politica.validar(plano)).isInstanceOfSatisfying(OrquestradorException.class,
                erro -> assertThat(erro.getCodigo()).isEqualTo(CodigoErroOrquestrador.PLANO_INVALIDO));
    }

    @Test
    void aceitaQuatroFerramentasFinanceirasEmDoisPeriodos() {
        var julho = new ArgumentosPeriodo(LocalDate.parse("2026-07-01"), LocalDate.parse("2026-07-31"));
        var agosto = new ArgumentosPeriodo(LocalDate.parse("2026-08-01"), LocalDate.parse("2026-08-31"));
        var plano = new PlanoOrquestracao("1.0", IntencaoOrquestrador.COMPARAR_VENDAS_GASTOS,
                List.of(new ChamadaFerramenta(FerramentaPermitida.RESUMO_VENDAS, julho),
                        new ChamadaFerramenta(FerramentaPermitida.RESUMO_GASTOS, julho),
                        new ChamadaFerramenta(FerramentaPermitida.RESUMO_VENDAS, agosto),
                        new ChamadaFerramenta(FerramentaPermitida.RESUMO_GASTOS, agosto)), ModoResposta.ANALITICA);
        assertThatCode(() -> politica.validar(plano)).doesNotThrowAnyException();
    }
}
