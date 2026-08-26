package com.InovaSkill.CaderninhoDigital.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.InovaSkill.CaderninhoDigital.dto.response.LegacyAuditItemResponse;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyDataAuditResponse;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyQuantityIssueResponse;
import com.InovaSkill.CaderninhoDigital.legacy.LegacyHtmlTableParser;
import com.InovaSkill.CaderninhoDigital.legacy.LegacyTable;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

class LegacyDataAuditServiceTest {

    private final LegacyDataAuditService service = new LegacyDataAuditService(new LegacyHtmlTableParser());

    @Test
    void classificaProdutoVendaMateriaPrimaECompraAmbigua() {
        LegacyDataAuditResponse response = service.audit(List.of(
                produtos(List.of(
                        List.of("1", "Produto vendido", "un", "10,00", "1", "1"),
                        List.of("2", "Insumo", "kg", "5,00", "2", "1"),
                        List.of("3", "Item comprado", "un", "5,00", "3", "1")
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

        assertThat(response.classificacoes())
                .containsEntry("PRODUTO_FINAL", 1L)
                .containsEntry("MATERIA_PRIMA", 1L)
                .containsEntry("REVISAR", 1L);
        assertThat(response.itensParaRevisao())
                .extracting(LegacyAuditItemResponse::codigoLegado)
                .containsExactly("3");
    }

    @Test
    void marcaQuantidadeMuitoAcimaDoPadraoSemAlterarOValorOriginal() {
        LegacyDataAuditResponse response = service.audit(List.of(
                produtos(List.of(
                        List.of("1", "Item 1", "un", "10,00", "1", "1"),
                        List.of("2", "Item 2", "un", "10,00", "2", "1"),
                        List.of("3", "Item 3", "un", "10,00", "3", "1"),
                        List.of("4", "Item 4", "un", "10,00", "4", "1"),
                        List.of("5", "Item 5", "un", "10,00", "5", "1"),
                        List.of("6", "Item 6", "un", "10,00", "999927", "1")
                ))
        ));

        assertThat(response.quantidadesExorbitantes()).isEqualTo(1);
        LegacyQuantityIssueResponse issue = response.alertasQuantidade().stream()
                .filter(item -> item.codigoLegado().equals("6"))
                .findFirst()
                .orElseThrow();
        assertThat(issue.tipo()).isEqualTo("QUANTIDADE_EXORBITANTE");
        assertThat(issue.valor()).hasToString("999927");
        assertThat(response.itensParaRevisao()).extracting(LegacyAuditItemResponse::codigoLegado).contains("6");
    }

    @Test
    void marcaEstoqueNegativoComoRevisaoMasNaoComoExorbitante() {
        LegacyDataAuditResponse response = service.audit(List.of(
                produtos(List.of(List.of("1", "Item", "kg", "10,00", "-2", "1")))
        ));

        assertThat(response.quantidadesExorbitantes()).isZero();
        assertThat(response.alertasQuantidade())
                .extracting(LegacyQuantityIssueResponse::tipo)
                .contains("ESTOQUE_NEGATIVO");
    }

    @Test
    void aceitaODatasetAtualComTrintaEDoisArquivos() {
        List<MultipartFile> files = new ArrayList<>();
        files.add(file("produtos.xls", "<table><tr><td>CODIGO</td><td>IXPROD</td><td>IUCOM</td></tr>"
                + "<tr><td>1</td><td>Produto</td><td>un</td></tr></table>"));

        for (int index = 1; index < 32; index++) {
            files.add(file("arquivo" + index + ".xls", "<table><tr><td>CODIGO</td></tr>"
                    + "<tr><td>" + index + "</td></tr></table>"));
        }

        LegacyDataAuditResponse response = service.preview(files);

        assertThat(response.arquivosAnalisados()).isEqualTo(32);
    }

    private LegacyTable produtos(List<List<String>> rows) {
        return table("produtos.xls",
                List.of("CODIGO", "IXPROD", "IUCOM", "PRECOCUSTO", "PRECOVENDA", "ESTOQUE", "ATIVO"),
                rows.stream().map(row -> {
                    List<String> normalizada = new ArrayList<>(row);
                    normalizada.add(3, "1,00");
                    return normalizada;
                }).toList());
    }

    private LegacyTable table(String fileName, List<String> headers, List<List<String>> rows) {
        return new LegacyTable(fileName, headers, rows);
    }

    private MultipartFile file(String fileName, String content) {
        return new MockMultipartFile(
                "arquivos",
                fileName,
                "application/vnd.ms-excel",
                content.getBytes(StandardCharsets.UTF_8));
    }
}
