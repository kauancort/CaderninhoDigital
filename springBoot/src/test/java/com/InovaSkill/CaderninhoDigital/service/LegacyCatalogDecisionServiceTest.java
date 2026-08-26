package com.InovaSkill.CaderninhoDigital.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.InovaSkill.CaderninhoDigital.dto.request.LegacyCatalogDecisionRequest;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyCatalogDecisionResponse;
import com.InovaSkill.CaderninhoDigital.legacy.LegacyHtmlTableParser;
import com.InovaSkill.CaderninhoDigital.legacy.LegacyTable;
import java.util.List;
import org.junit.jupiter.api.Test;

class LegacyCatalogDecisionServiceTest {

    private final LegacyCatalogDecisionService service = new LegacyCatalogDecisionService(
            new LegacyDataTreatmentService(new LegacyDataAuditService(new LegacyHtmlTableParser())));

    @Test
    void resolveItemAmbiguoComDecisaoManualSemPersistir() {
        LegacyCatalogDecisionResponse response = service.resolveTables(
                List.of(produtos(List.of(List.of("3", "Item comprado", "un", "5,00", "3", "1")))),
                List.of(new LegacyCatalogDecisionRequest(
                        "produtos.xls", 2, "3", "GASTO_OPERACIONAL", "Compra sem uso em receita")));

        assertThat(response.prontoParaImportacao()).isTrue();
        assertThat(response.itensAprovados()).isEqualTo(1);
        assertThat(response.itensPendentes()).isZero();
        assertThat(response.decisoesAplicadas()).hasSize(1);
        assertThat(response.decisoesAplicadas().getFirst().classificacaoFinal())
                .isEqualTo("GASTO_OPERACIONAL");
    }

    @Test
    void bloqueiaQuandoItemAmbiguoNaoPossuiDecisao() {
        LegacyCatalogDecisionResponse response = service.resolveTables(
                List.of(produtos(List.of(List.of("3", "Item comprado", "un", "5,00", "3", "1")))),
                List.of());

        assertThat(response.prontoParaImportacao()).isFalse();
        assertThat(response.itensPendentes()).isEqualTo(1);
        assertThat(response.rejeicoes())
                .extracting(rejection -> rejection.tipo())
                .contains("DECISAO_AUSENTE");
    }

    @Test
    void naoPermiteDecisaoIgnorarAlertaDoItem() {
        LegacyCatalogDecisionResponse response = service.resolveTables(
                List.of(produtos(List.of(List.of("3", "Item comprado", "un", "5,00", "-1", "1")))),
                List.of(new LegacyCatalogDecisionRequest(
                        "produtos.xls", 2, "3", "MATERIA_PRIMA", "Confirmado pelo gestor")));

        assertThat(response.prontoParaImportacao()).isFalse();
        assertThat(response.rejeicoes())
                .extracting(rejection -> rejection.tipo())
                .contains("DADOS_INVALIDOS");
    }

    private LegacyTable produtos(List<List<String>> rows) {
        return new LegacyTable("produtos.xls",
                List.of("CODIGO", "IXPROD", "IUCOM", "PRECOVENDA", "ESTOQUE", "ATIVO"), rows);
    }
}
