package com.InovaSkill.CaderninhoDigital.legacy;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.Charset;
import org.junit.jupiter.api.Test;

class LegacyHtmlTableParserTest {

    private final LegacyHtmlTableParser parser = new LegacyHtmlTableParser();

    @Test
    void interpretaExportacaoHtmlXlsEmWindows1252() {
        String html = "<html><body><table><thead><tr><td>CODIGO</td><td>IXPROD</td></tr></thead>"
                + "<tbody><tr><td>1</td><td>Açúcar &amp; leite</td></tr></tbody></table></body></html>";

        LegacyTable table = parser.parse("produtos.xls", html.getBytes(Charset.forName("windows-1252")));

        assertThat(table.headers()).containsExactly("CODIGO", "IXPROD");
        assertThat(table.rows()).containsExactly(java.util.List.of("1", "Açúcar & leite"));
    }

    @Test
    void normalizaLinhasComColunasAusentesSemDescartarRegistro() {
        String html = "<table><tr><td>A</td><td>B</td></tr>"
                + "<tr><td>valor</td></tr></table>";

        LegacyTable table = parser.parse("dados.xls", html.getBytes(Charset.forName("windows-1252")));

        assertThat(table.rows()).containsExactly(java.util.List.of("valor", ""));
    }
}
