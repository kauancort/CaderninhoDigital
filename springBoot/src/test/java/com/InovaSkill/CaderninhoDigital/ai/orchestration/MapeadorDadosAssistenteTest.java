package com.InovaSkill.CaderninhoDigital.ai.orchestration;

import static org.assertj.core.api.Assertions.assertThat;

import com.InovaSkill.CaderninhoDigital.ai.contract.*;
import com.InovaSkill.CaderninhoDigital.dto.response.DadosAssistenteDTO;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class MapeadorDadosAssistenteTest {
    private final MapeadorDadosAssistente mapper = new MapeadorDadosAssistente();

    @Test
    void produzComparacaoFechadaComDiscriminadorSerializavel() throws Exception {
        var periodo = LocalDate.parse("2026-07-01");
        var resultados = List.of(
                resultado(FerramentaPermitida.RESUMO_VENDAS,
                        Map.of("valorTotalValido", new BigDecimal("18000"), "quantidadeVendas", 20,
                                "ticketMedio", new BigDecimal("900"), "quantidadeItens", 100)),
                resultado(FerramentaPermitida.RESUMO_GASTOS,
                        Map.of("totalGastos", new BigDecimal("11000"), "quantidadeLancamentos", 8)));
        var consolidado = new ConsolidadorResultadosOrquestracao().consolidar(resultados);

        DadosAssistenteDTO dados = mapper.mapear(resultados, consolidado);
        String json = new ObjectMapper().findAndRegisterModules().writeValueAsString(dados);

        assertThat(dados).isInstanceOf(DadosAssistenteDTO.ComparacaoVendasGastos.class);
        assertThat(json).contains("\"tipo\":\"COMPARACAO_VENDAS_GASTOS\"", "\"diferenca\":7000");
        assertThat(json).doesNotContain("sql", "endpoint", "repository");
    }

    @Test
    void preservaFontesDoMercadoMesmoSemOfertaValidada() throws Exception {
        var fonte = new com.InovaSkill.CaderninhoDigital.ai.search.ResultadoFontePesquisa(
                "fonte-1", "Loja", "https://loja.example/item", "loja.example",
                com.InovaSkill.CaderninhoDigital.ai.search.ResultadoFontePesquisa.Status.NAO_CONCLUIDA,
                "limite do OpenRouter");
        Map<String, Object> dados = new java.util.LinkedHashMap<>();
        dados.put("materiaPrimaId", 3L); dados.put("unidade", "kg");
        dados.put("quantidadeAlvo", new BigDecimal("10")); dados.put("situacao", "INSUFICIENTE");
        dados.put("pesquisadoEm", Instant.parse("2026-08-12T20:00:00Z"));
        dados.put("fontes", List.of(fonte)); dados.put("ofertas", List.of());
        var resultado = resultado(FerramentaPermitida.COMPARAR_PRECO_MERCADO, dados);

        var dto = mapper.mapear(List.of(resultado), dados);
        String json = new ObjectMapper().findAndRegisterModules().writeValueAsString(dto);

        assertThat(dto).isInstanceOf(DadosAssistenteDTO.ComparacaoMercado.class);
        assertThat(json).contains("\"fontes\"", "NAO_CONCLUIDA", "limite do OpenRouter")
                .doesNotContain("\"ofertas\":[{");
    }

    private ResultadoFerramenta resultado(FerramentaPermitida ferramenta, Map<String,Object> dados) {
        return new ResultadoFerramenta(ferramenta, StatusResultado.SUCESSO, dados,
                LocalDate.parse("2026-07-01"), LocalDate.parse("2026-07-31"),
                Instant.parse("2026-08-08T12:00:00Z"), List.of(), QualidadeResultado.COMPLETO);
    }
}
