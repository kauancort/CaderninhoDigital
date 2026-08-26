package com.InovaSkill.CaderninhoDigital.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.InovaSkill.CaderninhoDigital.dto.response.LegacyHistoricalTreatmentResponse;
import com.InovaSkill.CaderninhoDigital.legacy.LegacyHtmlTableParser;
import com.InovaSkill.CaderninhoDigital.legacy.LegacyTable;
import java.util.List;
import org.junit.jupiter.api.Test;

class LegacyHistoricalTreatmentServiceTest {

    private final LegacyHistoricalTreatmentService service = new LegacyHistoricalTreatmentService(
            new LegacyDataAuditService(new LegacyHtmlTableParser()));

    @Test
    void validaReferenciasDosHistoricosSemPersistirEExigeDecisaoFinanceira() {
        LegacyHistoricalTreatmentResponse response = service.treat(List.of(
                table("produtos.xls", List.of("CODIGO", "IXPROD"), List.of(
                        List.of("1", "Produto"), List.of("2", "Insumo"))),
                table("contatos.xls", List.of("CODIGO", "TIPO", "NOME"), List.of(
                        List.of("10", "1", "Contato"))),
                table("compras.xls", List.of("CODIGO", "CODCONTATO", "DTCOMPRA"), List.of(
                        List.of("20", "10", "2020-02-13"))),
                table("comprasItens.xls", List.of("CODIGO", "CODCOMPRA", "CODPRODUTO", "QUANT", "CUSTOBRUTO"), List.of(
                        List.of("21", "20", "2", "3", "4,00"))),
                table("vendas.xls", List.of("CODIGO", "CODCONTATO", "DTVENDA"), List.of(
                        List.of("30", "10", "2020-02-14"))),
                table("vendasItens.xls", List.of("CODIGO", "CODVENDA", "CODPRODUTO", "QUANT", "PRECO"), List.of(
                        List.of("31", "30", "1", "2", "10,00"))),
                table("financeiro.xls", List.of("CODIGO", "DTCOMP", "VALOR"), List.of(
                        List.of("40", "2020-02-15", "15,00")))
        ));

        assertThat(response.registrosPorDominio())
                .containsEntry("COMPRAS", 1L)
                .containsEntry("COMPRAS_ITENS", 1L)
                .containsEntry("VENDAS", 1L)
                .containsEntry("VENDAS_ITENS", 1L)
                .containsEntry("FINANCEIRO", 1L);
        assertThat(response.registrosBloqueados()).isEqualTo(1);
        assertThat(response.pendencias())
                .extracting(item -> item.tipo())
                .containsExactly("DECISAO_FINANCEIRA_NECESSARIA");
    }

    @Test
    void bloqueiaItemHistoricoComPaiOuCatalogoAusente() {
        LegacyHistoricalTreatmentResponse response = service.treat(List.of(
                table("produtos.xls", List.of("CODIGO", "IXPROD"), List.of(List.of("1", "Produto"))),
                table("compras.xls", List.of("CODIGO", "DTCOMPRA"), List.of(List.of("20", "2020-02-13"))),
                table("comprasItens.xls", List.of("CODIGO", "CODCOMPRA", "CODPRODUTO", "QUANT", "CUSTOBRUTO"), List.of(
                        List.of("21", "999", "404", "3", "4,00")))
        ));

        assertThat(response.registrosBloqueados()).isEqualTo(1);
        assertThat(response.pendencias().getFirst().tipo()).isEqualTo("PAI_NAO_ENCONTRADO");
    }

    private LegacyTable table(String fileName, List<String> headers, List<List<String>> rows) {
        return new LegacyTable(fileName, headers, rows);
    }
}
