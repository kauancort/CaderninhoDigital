package com.InovaSkill.CaderninhoDigital.ai.cost;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import com.InovaSkill.CaderninhoDigital.entity.*;
import com.InovaSkill.CaderninhoDigital.repository.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class AnaliseMargemProdutoServiceTest {
    @Test void calculaMargemConhecidaEParticipacaoDosComponentesSemPrometerLucroLiquido() {
        var produtos = mock(ProdutoRepository.class);
        var producoes = mock(ProducaoRepository.class);
        var vendas = mock(VendaRepository.class);
        var produto = Produto.builder().id(3L).nome("Paçoca").custoAtual(new BigDecimal("0.57")).build();
        when(produtos.buscarComGabaritoParaEmpresa(3L, 11L)).thenReturn(Optional.of(produto));
        var producao = Producao.builder().produto(produto).quantidadeProduzida(new BigDecimal("100"))
                .insumos(List.of(
                        insumo("Amendoim", "32"), insumo("Açúcar", "8"), insumo("Embalagem", "12"),
                        insumo("Outros", "5"))).build();
        when(producoes.listarParaAnaliseMargem(11L, 3L, LocalDate.parse("2026-07-01"),
                LocalDate.parse("2026-07-31"))).thenReturn(List.of(producao));
        var resumo = mock(VendaRepository.MargemProdutoProjection.class);
        when(resumo.getQuantidadeVendida()).thenReturn(new BigDecimal("100"));
        when(resumo.getReceita()).thenReturn(new BigDecimal("70"));
        when(resumo.getItensSemCusto()).thenReturn(0L);
        when(vendas.resumirMargemProduto(11L, 3L, LocalDate.parse("2026-07-01"),
                LocalDate.parse("2026-07-31"))).thenReturn(resumo);

        var resultado = new AnaliseMargemProdutoService(produtos, producoes, vendas).analisar(
                11L, 3L, LocalDate.parse("2026-07-01"), LocalDate.parse("2026-07-31"));

        assertThat(resultado.custoProducaoConhecido()).isEqualByComparingTo("57");
        assertThat(resultado.custoUnitarioConhecido()).isEqualByComparingTo("0.5700");
        assertThat(resultado.precoMedioVenda()).isEqualByComparingTo("0.7000");
        assertThat(resultado.margemBrutaConhecidaUnitaria()).isEqualByComparingTo("0.1300");
        assertThat(resultado.componentes().getFirst().nome()).isEqualTo("Amendoim");
        assertThat(resultado.componentes().getFirst().participacaoPercentual()).isEqualByComparingTo("56.14");
        assertThat(resultado.avisos()).anyMatch(a -> a.contains("margem") && a.contains("custos cadastrados"));
        assertThat(resultado.custosNaoModelados()).contains("energia", "mão de obra", "impostos");
    }

    private ItemProducaoMateriaPrima insumo(String nome, String custo) {
        return ItemProducaoMateriaPrima.builder().materiaPrima(MateriaPrima.builder().nome(nome).build())
                .custoTotal(new BigDecimal(custo)).build();
    }
}
