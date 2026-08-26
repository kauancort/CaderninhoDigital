package com.InovaSkill.CaderninhoDigital.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.InovaSkill.CaderninhoDigital.dto.response.LegacyImportSimulationResponse;
import com.InovaSkill.CaderninhoDigital.legacy.LegacyHtmlTableParser;
import com.InovaSkill.CaderninhoDigital.legacy.LegacyTable;
import java.util.List;
import org.junit.jupiter.api.Test;

class LegacyImportSimulationServiceTest {

    private final LegacyImportSimulationService service = new LegacyImportSimulationService(
            new LegacyDataTreatmentService(new LegacyDataAuditService(new LegacyHtmlTableParser())));

    @Test
    void bloqueiaSimulacaoEnquantoHouverItemAmbiguo() {
        LegacyImportSimulationResponse response = service.simulateTables(List.of(
                produtos(List.of(List.of("1", "Item sem referencia", "un", "10,00", "2", "1")))
        ));

        assertThat(response.prontoParaImportacao()).isFalse();
        assertThat(response.itensPendentes()).isEqualTo(1);
        assertThat(response.rejeicoes()).anySatisfy(rejection ->
                assertThat(rejection.tipo()).isEqualTo("CLASSIFICACAO_AMBIGUA"));
        assertThat(response.bloqueios()).isNotEmpty();
    }

    @Test
    void liberaSimulacaoQuandoOCatalogoNaoPossuiPendencias() {
        LegacyImportSimulationResponse response = service.simulateTables(List.of(
                produtos(List.of(List.of("1", "Produto vendido", "un", "10,00", "2", "1"))),
                table("vendasItens.xls", List.of("CODIGO", "CODPRODUTO", "QUANT"), List.of(
                        List.of("10", "1", "1")
                ))
        ));

        assertThat(response.prontoParaImportacao()).isTrue();
        assertThat(response.itensProntos()).isEqualTo(1);
        assertThat(response.itensPendentes()).isZero();
        assertThat(response.rejeicoes()).isEmpty();
        assertThat(response.bloqueios()).isEmpty();
    }

    private LegacyTable produtos(List<List<String>> rows) {
        return table("produtos.xls",
                List.of("CODIGO", "IXPROD", "IUCOM", "PRECOVENDA", "ESTOQUE", "ATIVO"), rows);
    }

    private LegacyTable table(String fileName, List<String> headers, List<List<String>> rows) {
        return new LegacyTable(fileName, headers, rows);
    }
}
