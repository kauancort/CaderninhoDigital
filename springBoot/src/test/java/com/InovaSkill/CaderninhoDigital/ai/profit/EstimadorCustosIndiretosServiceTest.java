package com.InovaSkill.CaderninhoDigital.ai.profit;

import static org.assertj.core.api.Assertions.assertThat;

import com.InovaSkill.CaderninhoDigital.ai.search.FontePesquisaPreco;
import java.math.BigDecimal;
import java.net.URI;
import java.util.List;
import org.junit.jupiter.api.Test;

class EstimadorCustosIndiretosServiceTest {
    private final EstimadorCustosIndiretosService service = new EstimadorCustosIndiretosService();

    @Test void usaMedianaDeDominiosIndependentesECalculaSobreReceita() {
        var resultado = service.estimar(List.of("energia", "impostos"), List.of(
                fonte("A", "a.example", "Energia representa 6% do faturamento em pequenas confeitarias."),
                fonte("B", "b.example", "O gasto com eletricidade chega a 10% da receita do negócio."),
                fonte("C", "c.example", "Conta de luz equivale a 8% das vendas de uma confeitaria.")),
                new BigDecimal("4.20"));

        assertThat(resultado.status()).isEqualTo("PARCIAL");
        assertThat(resultado.componentes()).singleElement().satisfies(c -> {
            assertThat(c.nome()).isEqualTo("energia");
            assertThat(c.medianaPercentual()).isEqualByComparingTo("8");
            assertThat(c.valorEstimadoUnidade()).isEqualByComparingTo("0.3360");
            assertThat(c.referenciasValidas()).isEqualTo(3);
        });
        assertThat(resultado.custosNaoEstimados()).anyMatch(v -> v.startsWith("impostos:"));
    }

    @Test void umaFonteNaoBastaEPercentualSemBaseNaoEAplicado() {
        var resultado = service.estimar(List.of("mão de obra"), List.of(
                fonte("A", "a.example", "Mão de obra pode representar 25% em uma confeitaria."),
                fonte("B", "b.example", "Salários representam 20% do faturamento.")),
                new BigDecimal("4.20"));

        assertThat(resultado.status()).isEqualTo("DADOS_INSUFICIENTES");
        assertThat(resultado.componentes()).isEmpty();
    }

    @Test void usaBenchmarkOperacionalAgregadoSemInventarRateioPorCategoria() {
        var resultado = service.estimar(List.of("energia", "gás", "mão de obra", "impostos"), List.of(
                fonte("A", "a.example", "Matéria-prima: 33% do faturamento. Gastos operacionais: 35% da receita bruta."),
                fonte("B", "b.example", "Custos fixos equivalem a 50% do faturamento do ateliê de doces.")),
                new BigDecimal("4.20"));

        assertThat(resultado.status()).isEqualTo("PARCIAL");
        assertThat(resultado.componentes()).singleElement().satisfies(c -> {
            assertThat(c.nome()).isEqualTo("custos operacionais agregados");
            assertThat(c.menorPercentual()).isEqualByComparingTo("35");
            assertThat(c.medianaPercentual()).isEqualByComparingTo("42.5");
            assertThat(c.maiorPercentual()).isEqualByComparingTo("50");
            assertThat(c.valorEstimadoUnidade()).isEqualByComparingTo("1.7850");
        });
        assertThat(resultado.custosNaoEstimados()).anyMatch(v -> v.contains("forma agregada"));
    }

    private FontePesquisaPreco fonte(String titulo, String dominio, String trecho) {
        URI url = URI.create("https://" + dominio + "/referencia");
        return new FontePesquisaPreco(titulo, url, dominio, trecho);
    }
}
