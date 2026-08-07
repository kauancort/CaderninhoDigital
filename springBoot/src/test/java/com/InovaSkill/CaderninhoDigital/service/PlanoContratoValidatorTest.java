package com.InovaSkill.CaderninhoDigital.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.InovaSkill.CaderninhoDigital.ai.contract.ArgumentosPeriodo;
import com.InovaSkill.CaderninhoDigital.ai.contract.ArgumentosSemFiltro;
import com.InovaSkill.CaderninhoDigital.ai.contract.ChamadaFerramenta;
import com.InovaSkill.CaderninhoDigital.ai.contract.FerramentaPermitida;
import com.InovaSkill.CaderninhoDigital.ai.contract.IntencaoOrquestrador;
import com.InovaSkill.CaderninhoDigital.ai.contract.ModoResposta;
import com.InovaSkill.CaderninhoDigital.ai.contract.PlanoOrquestracao;
import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import com.InovaSkill.CaderninhoDigital.exception.CodigoErroOrquestrador;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import jakarta.validation.Validation;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class PlanoContratoValidatorTest {

    @Test
    void aceitaPlanoConhecidoEFechado() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = new PlanoContratoValidator(
                    new AiOrchestratorProperties(), factory.getValidator());
            var plano = new PlanoOrquestracao("1.0", IntencaoOrquestrador.RESUMO_NEGOCIO,
                    List.of(new ChamadaFerramenta(
                            FerramentaPermitida.RESUMO_OPERACIONAL, new ArgumentosSemFiltro())),
                    ModoResposta.TEXTO_SIMPLES);

            validator.validar(plano);
        }
    }

    @Test
    void rejeitaPeriodoInvertido() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = new PlanoContratoValidator(
                    new AiOrchestratorProperties(), factory.getValidator());
            var plano = new PlanoOrquestracao("1.0", IntencaoOrquestrador.CONSULTAR_VENDAS,
                    List.of(new ChamadaFerramenta(FerramentaPermitida.RESUMO_VENDAS,
                            new ArgumentosPeriodo(LocalDate.parse("2026-02-01"), LocalDate.parse("2026-01-01")))),
                    ModoResposta.TEXTO_COM_DADOS);

            assertThatThrownBy(() -> validator.validar(plano))
                    .isInstanceOfSatisfying(OrquestradorException.class,
                            error -> assertThat(error.getCodigo())
                                    .isEqualTo(CodigoErroOrquestrador.ARGUMENTOS_INVALIDOS));
        }
    }
}
