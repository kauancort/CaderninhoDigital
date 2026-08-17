package com.InovaSkill.CaderninhoDigital.ai.cost;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;
import com.InovaSkill.CaderninhoDigital.entity.*;
import com.InovaSkill.CaderninhoDigital.repository.*;
import com.InovaSkill.CaderninhoDigital.repository.projection.AnaliseCompraInsumoProjection;
import com.InovaSkill.CaderninhoDigital.service.UsuarioAcessoService;
import java.math.BigDecimal;
import java.time.*;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class AnalisesCustoComprasTest {
    @Test void produtoInexistenteFalhaSemExporDados() {
        var produtos = mock(ProdutoRepository.class);
        var service = new AnaliseCustoProdutoService(produtos, mock(HistoricoCustoProdutoRepository.class));
        assertThatThrownBy(() -> service.analisar(7L, 99L, Instant.EPOCH, ZoneOffset.UTC))
                .hasMessage("Produto não encontrado");
    }

    @Test void rendimentoZeroNaoExecutaDivisao() {
        var produtos = mock(ProdutoRepository.class);
        var gabarito = ProdutoGabarito.builder().quantidadeBase(BigDecimal.ZERO)
                .itens(List.of(ProdutoGabaritoItem.builder()
                        .materiaPrima(MateriaPrima.builder().custoMedio(BigDecimal.ONE).build())
                        .quantidadeNecessaria(BigDecimal.ONE).build())).build();
        when(produtos.buscarComGabaritoParaEmpresa(1L, 7L)).thenReturn(Optional.of(Produto.builder().id(1L).gabarito(gabarito).build()));
        var r = new AnaliseCustoProdutoService(produtos, mock(HistoricoCustoProdutoRepository.class))
                .analisar(7L, 1L, Instant.EPOCH, ZoneOffset.UTC);
        assertThat(r.custoUnitarioFicha()).isNull();
        assertThat(r.avisos()).anyMatch(a -> a.contains("Rendimento"));
    }

    @Test void calculaFichaComFormulaRealEArredondamento() {
        var produtos = mock(ProdutoRepository.class); var historico = mock(HistoricoCustoProdutoRepository.class);
        var materia = MateriaPrima.builder().id(2L).custoMedio(new BigDecimal("3.333")).build();
        var gabarito = ProdutoGabarito.builder().quantidadeBase(new BigDecimal("2"))
                .itens(List.of(ProdutoGabaritoItem.builder().materiaPrima(materia)
                        .quantidadeNecessaria(new BigDecimal("3")).build())).build();
        var produto = Produto.builder().id(1L).custoAtual(new BigDecimal("5.00")).gabarito(gabarito).build();
        when(produtos.buscarComGabaritoParaEmpresa(1L, 7L)).thenReturn(Optional.of(produto));
        var service = new AnaliseCustoProdutoService(produtos, historico);
        var r = service.analisar(7L, 1L, Instant.EPOCH, ZoneOffset.UTC);
        assertThat(r.custoUnitarioFicha()).isEqualByComparingTo("5.00");
        assertThat(r.avisos()).anyMatch(a -> a.contains("mão de obra"));
    }

    @Test void componenteSemCustoProduzResultadoParcial() {
        var produtos = mock(ProdutoRepository.class);
        var materia = MateriaPrima.builder().id(2L).custoMedio(BigDecimal.ZERO).build();
        var gabarito = ProdutoGabarito.builder().quantidadeBase(BigDecimal.ONE)
                .itens(List.of(ProdutoGabaritoItem.builder().materiaPrima(materia)
                        .quantidadeNecessaria(BigDecimal.ONE).build())).build();
        when(produtos.buscarComGabaritoParaEmpresa(1L, 7L)).thenReturn(Optional.of(
                Produto.builder().id(1L).gabarito(gabarito).build()));
        var r = new AnaliseCustoProdutoService(produtos, mock(HistoricoCustoProdutoRepository.class))
                .analisar(7L, 1L, Instant.EPOCH, ZoneOffset.UTC);
        assertThat(r.componentesCompletos()).isFalse(); assertThat(r.componentesSemCusto()).isOne();
    }

    @Test void comprasCalculaMediaPonderadaSemFornecedor() {
        var compras = mock(CompraMateriaPrimaRepository.class); var materias = mock(MateriaPrimaRepository.class);
        when(materias.buscarAcessivelParaAnalise(3L, 7L)).thenReturn(Optional.of(
                MateriaPrima.builder().id(3L).unidadeMedida("kg").build()));
        var p = mock(AnaliseCompraInsumoProjection.class);
        when(p.getQuantidadeTotal()).thenReturn(new BigDecimal("5"));
        when(p.getValorTotal()).thenReturn(new BigDecimal("42.50"));
        when(p.getMenorPreco()).thenReturn(new BigDecimal("8")); when(p.getMaiorPreco()).thenReturn(new BigDecimal("9"));
        when(p.getQuantidadeCompras()).thenReturn(2L); when(compras.analisarInsumo(anyLong(), anyLong(), any(), any())).thenReturn(p);
        var r = new AnaliseComprasInsumoService(compras, materias)
                .analisar(7L, 3L, LocalDate.parse("2026-01-01"), LocalDate.parse("2026-01-31"));
        assertThat(r.itens().getFirst().precoMedioPonderado()).isEqualByComparingTo("8.50");
        assertThat(r.toString()).doesNotContain("fornecedor", "documento", "contato");
    }

    @Test void historicoVazioNaoInventaPreco() {
        var compras = mock(CompraMateriaPrimaRepository.class); var materias = mock(MateriaPrimaRepository.class);
        when(materias.buscarAcessivelParaAnalise(3L, 7L)).thenReturn(Optional.of(MateriaPrima.builder().id(3L).unidadeMedida("kg").build()));
        var p = mock(AnaliseCompraInsumoProjection.class); when(p.getQuantidadeCompras()).thenReturn(0L);
        when(compras.analisarInsumo(anyLong(), anyLong(), any(), any())).thenReturn(p);
        var r = new AnaliseComprasInsumoService(compras, materias)
                .analisar(7L, 3L, LocalDate.now(), LocalDate.now());
        assertThat(r.itens().getFirst().precoMedioPonderado()).isNull();
        assertThat(r.qualidade()).isEqualTo(com.InovaSkill.CaderninhoDigital.ai.contract.QualidadeResultado.INSUFICIENTE);
    }

    @Test void analiseGeralComComprasSemanaisNaoPrometeEconomiaMensal() {
        var compras = mock(CompraMateriaPrimaRepository.class);
        var p = mock(com.InovaSkill.CaderninhoDigital.repository.projection.AnaliseCompraInsumoAgrupadaProjection.class);
        when(p.getMateriaPrimaId()).thenReturn(3L); when(p.getUnidade()).thenReturn("kg");
        when(p.getQuantidadeTotal()).thenReturn(new BigDecimal("40"));
        when(p.getValorTotal()).thenReturn(new BigDecimal("400"));
        when(p.getMenorPreco()).thenReturn(new BigDecimal("9")); when(p.getMaiorPreco()).thenReturn(new BigDecimal("11"));
        when(p.getQuantidadeCompras()).thenReturn(4L);
        when(p.getPrimeiraCompra()).thenReturn(LocalDate.parse("2026-07-01"));
        when(p.getUltimaCompra()).thenReturn(LocalDate.parse("2026-07-22"));
        when(compras.analisarInsumos(anyLong(), any(), any())).thenReturn(List.of(p));

        var r = new AnaliseComprasInsumoService(compras, mock(MateriaPrimaRepository.class)).analisar(7L, null,
                        LocalDate.parse("2026-07-01"), LocalDate.parse("2026-07-31"));

        assertThat(r.itens().getFirst().frequenciaObservada()).isEqualTo("SEMANAL");
        assertThat(r.itens().getFirst().amplitudePrecoPercentual()).isEqualByComparingTo("22.22");
        assertThat(r.simulacaoMensal().economiaComprovavel()).isFalse();
        assertThat(r.simulacaoMensal().economiaComprovada()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(r.toString()).doesNotContain("fornecedor", "telefone", "documento", "endereco");
    }

    @Test void unidadesDiferentesPermanecemSeparadasSemConversaoInventada() {
        var compras = mock(CompraMateriaPrimaRepository.class);
        var kg = agrupada(1L, "kg"); var unidade = agrupada(2L, "unidade");
        when(compras.analisarInsumos(anyLong(), any(), any())).thenReturn(List.of(kg, unidade));
        var r = new AnaliseComprasInsumoService(compras, mock(MateriaPrimaRepository.class)).analisar(7L, null,
                        LocalDate.parse("2026-01-01"), LocalDate.parse("2026-06-30"));
        assertThat(r.itens()).extracting(AnaliseComprasInsumoService.Item::unidade)
                .containsExactly("kg", "unidade");
    }

    private com.InovaSkill.CaderninhoDigital.repository.projection.AnaliseCompraInsumoAgrupadaProjection agrupada(
            Long id, String unidade) {
        var p = mock(com.InovaSkill.CaderninhoDigital.repository.projection.AnaliseCompraInsumoAgrupadaProjection.class);
        when(p.getMateriaPrimaId()).thenReturn(id); when(p.getUnidade()).thenReturn(unidade);
        when(p.getQuantidadeTotal()).thenReturn(BigDecimal.ONE); when(p.getValorTotal()).thenReturn(BigDecimal.ONE);
        when(p.getQuantidadeCompras()).thenReturn(1L);
        return p;
    }
}
