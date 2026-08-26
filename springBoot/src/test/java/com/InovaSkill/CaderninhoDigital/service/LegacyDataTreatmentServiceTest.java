package com.InovaSkill.CaderninhoDigital.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.InovaSkill.CaderninhoDigital.dto.response.LegacyCatalogTreatmentItemResponse;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyCatalogTreatmentResponse;
import com.InovaSkill.CaderninhoDigital.legacy.LegacyHtmlTableParser;
import com.InovaSkill.CaderninhoDigital.legacy.LegacyTable;
import java.util.List;
import org.junit.jupiter.api.Test;

class LegacyDataTreatmentServiceTest {

    private final LegacyDataTreatmentService service = new LegacyDataTreatmentService(
            new LegacyDataAuditService(new LegacyHtmlTableParser()));

    @Test
    void geraCatalogoNormalizadoSemPersistirEConservaProveniencia() {
        LegacyCatalogTreatmentResponse response = service.treat(List.of(
                table("produtos.xls", List.of("CODIGO", "IXPROD", "IUCOM", "PRECOCUSTO", "PRECOVENDA", "ESTOQUE", "ATIVO"), List.of(
                        List.of("1", "Produto vendido", "un", "8,00", "10,00", "4", "1"),
                        List.of("2", "Insumo", "kg", "4,00", "5,00", "8", "1"),
                        List.of("3", "Item comprado", "un", "4,00", "5,00", "3", "1")
                )),
                table("vendasItens.xls", List.of("CODIGO", "CODPRODUTO", "QUANT"), List.of(
                        List.of("10", "1", "2")
                )),
                table("prodReceitasItens.xls", List.of("CODIGO", "CODINSUMO", "QUANT"), List.of(
                        List.of("20", "2", "3")
                )),
                table("comprasItens.xls", List.of("CODIGO", "CODPRODUTO", "QUANT"), List.of(
                        List.of("30", "3", "4")
                ))
        ));

        assertThat(response.itens()).hasSize(3);
        assertThat(response.classificacoes())
                .containsEntry("PRODUTO_FINAL", 1L)
                .containsEntry("MATERIA_PRIMA", 1L)
                .containsEntry("REVISAR", 1L);
        assertThat(response.itensProntos()).isEqualTo(2);
        assertThat(response.itensParaRevisao()).isEqualTo(1);

        LegacyCatalogTreatmentItemResponse reviewed = response.itens().stream()
                .filter(item -> item.codigoLegado().equals("3"))
                .findFirst()
                .orElseThrow();
        assertThat(reviewed.status()).isEqualTo("PENDENTE_REVISAO");
        assertThat(reviewed.arquivo()).isEqualTo("produtos.xls");
        assertThat(reviewed.linha()).isEqualTo(4);
        assertThat(reviewed.precoVenda()).hasToString("5.00");
    }

    @Test
    void bloqueiaNumeroLegadoInvalidoSemTransformarEmZero() {
        LegacyCatalogTreatmentResponse response = service.treat(List.of(
                table("produtos.xls", List.of("CODIGO", "IXPROD", "IUCOM", "PRECOVENDA", "ESTOQUE", "ATIVO"), List.of(
                        List.of("1", "Produto", "un", "nao-informado", "abc", "1")
                )),
                table("vendasItens.xls", List.of("CODIGO", "CODPRODUTO", "QUANT"), List.of(
                        List.of("10", "1", "2")
                ))
        ));

        LegacyCatalogTreatmentItemResponse item = response.itens().getFirst();
        assertThat(item.status()).isEqualTo("PENDENTE_REVISAO");
        assertThat(item.precoVenda()).isNull();
        assertThat(item.estoque()).isNull();
        assertThat(item.alertas())
                .anyMatch(alert -> alert.startsWith("PRECO_VENDA_INVALIDO"))
                .anyMatch(alert -> alert.startsWith("ESTOQUE_INVALIDO"));
    }

    private LegacyTable table(String fileName, List<String> headers, List<List<String>> rows) {
        return new LegacyTable(fileName, headers, rows);
    }
}
