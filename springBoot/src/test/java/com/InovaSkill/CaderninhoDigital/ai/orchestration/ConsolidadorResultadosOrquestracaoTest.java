package com.InovaSkill.CaderninhoDigital.ai.orchestration;

import static org.assertj.core.api.Assertions.assertThat;

import com.InovaSkill.CaderninhoDigital.ai.contract.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ConsolidadorResultadosOrquestracaoTest {
    private final ConsolidadorResultadosOrquestracao consolidador = new ConsolidadorResultadosOrquestracao();

    @Test
    void informaCoberturaEquivalenteETrataBaseZero() {
        Map<String, Object> dados = consolidador.consolidar(List.of(
                vendas("0", "2026-07-01", "2026-07-08"),
                vendas("100", "2026-08-01", "2026-08-08")));

        assertThat(comparacao(dados))
                .containsEntry("diasPeriodoAnterior", 8L)
                .containsEntry("diasPeriodoAtual", 8L)
                .containsEntry("coberturaEquivalente", true)
                .containsEntry("variacaoPercentual", null);
    }

    @Test
    void sinalizaPeriodosComCoberturaDiferente() {
        Map<String, Object> dados = consolidador.consolidar(List.of(
                vendas("100", "2026-07-01", "2026-07-31"),
                vendas("50", "2026-08-01", "2026-08-08")));

        assertThat(comparacao(dados))
                .containsEntry("diasPeriodoAnterior", 31L)
                .containsEntry("diasPeriodoAtual", 8L)
                .containsEntry("coberturaEquivalente", false);
    }

    private ResultadoFerramenta vendas(String total, String inicio, String fim) {
        return new ResultadoFerramenta(FerramentaPermitida.RESUMO_VENDAS, StatusResultado.SUCESSO,
                Map.of("valorTotalValido", new BigDecimal(total)), LocalDate.parse(inicio), LocalDate.parse(fim),
                Instant.parse("2026-08-08T12:00:00Z"), List.of(), QualidadeResultado.COMPLETO);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> comparacao(Map<String, Object> dados) {
        return (Map<String, Object>) dados.get("comparacao");
    }
}
