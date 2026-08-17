package com.InovaSkill.CaderninhoDigital.ai.profit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;
import com.InovaSkill.CaderninhoDigital.ai.search.*;
import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import com.InovaSkill.CaderninhoDigital.entity.*;
import com.InovaSkill.CaderninhoDigital.enums.ModalidadeVenda;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import com.InovaSkill.CaderninhoDigital.exception.ResourceNotFoundException;
import com.InovaSkill.CaderninhoDigital.repository.*;
import java.math.BigDecimal;
import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AnaliseRentabilidadeProdutoServiceTest {
    private final ProdutoRepository produtos = mock(ProdutoRepository.class);
    private final ProducaoRepository producoes = mock(ProducaoRepository.class);
    private final VendaRepository vendas = mock(VendaRepository.class);
    private final PesquisaPrecosGateway pesquisa = mock(PesquisaPrecosGateway.class);
    private final PesquisaCustosIndiretosGateway pesquisaCustos = mock(PesquisaCustosIndiretosGateway.class);
    private final InterpretadorOfertasMercado interpretador = mock(InterpretadorOfertasMercado.class);
    private final EstimadorCustosIndiretosService estimadorCustos = new EstimadorCustosIndiretosService();
    private final AiOrchestratorProperties properties = new AiOrchestratorProperties();
    private AnaliseRentabilidadeProdutoService service;
    private final LocalDate inicio = LocalDate.parse("2026-07-18");
    private final LocalDate fim = LocalDate.parse("2026-08-16");

    @BeforeEach void setup() {
        properties.getFeatures().setSearch(false);
        service = new AnaliseRentabilidadeProdutoService(produtos, producoes, vendas, pesquisa, interpretador,
                pesquisaCustos, estimadorCustos, properties,
                Clock.fixed(Instant.parse("2026-08-16T12:00:00Z"), ZoneOffset.UTC));
        when(produtos.buscarComGabaritoParaEmpresa(3L, 11L)).thenReturn(Optional.of(produto()));
        when(producoes.listarParaAnaliseMargem(11L, 3L, inicio, fim)).thenReturn(List.of(producao()));
        when(vendas.listarItensRentabilidadeProduto(11L, 3L, inicio, fim)).thenReturn(List.of());
        when(pesquisaCustos.pesquisarCustosIndiretos(any())).thenReturn(new ResultadoPesquisaCustosIndiretos(
                "q", Instant.parse("2026-08-16T12:00:00Z"), List.of(), List.of()));
    }

    @Test void margemPositivaComCusto210EVenda420() {
        when(vendas.listarItensRentabilidadeProduto(11L, 3L, inicio, fim))
                .thenReturn(List.of(item(ModalidadeVenda.UNIDADE, "1", "1", "4.20", "4.20")));
        var r = analisar(null, null);
        assertThat(r.custo().custoConhecidoUnidade()).isEqualByComparingTo("2.1000");
        assertThat(r.vendas().precoMedioReal()).isEqualByComparingTo("4.2000");
        assertThat(r.modalidades()).anySatisfy(m -> {
            assertThat(m.margemConhecidaUnidade()).isEqualByComparingTo("2.1000");
            assertThat(m.margemPercentual()).isEqualByComparingTo("50.00");
        });
        assertThat(r.situacao()).isEqualTo("MARGEM_CONHECIDA_POSITIVA");
    }

    @Test void caixa30Com10UnidadesNormalizaPara3EMargem090() {
        when(vendas.listarItensRentabilidadeProduto(11L, 3L, inicio, fim))
                .thenReturn(List.of(item(ModalidadeVenda.CAIXA, "10", "1", "30", "3")));
        var caixa = analisar(ModalidadeVenda.CAIXA, null).modalidades().stream()
                .filter(m -> m.tipo() == ModalidadeVenda.CAIXA).findFirst().orElseThrow();
        assertThat(caixa.preco()).isEqualByComparingTo("30.00");
        assertThat(caixa.precoEquivalenteUnidade()).isEqualByComparingTo("3.0000");
        assertThat(caixa.margemConhecidaUnidade()).isEqualByComparingTo("0.9000");
    }

    @Test void identificaModalidadesComResultadosDiferentes() {
        when(vendas.listarItensRentabilidadeProduto(11L, 3L, inicio, fim)).thenReturn(List.of(
                item(ModalidadeVenda.UNIDADE, "1", "1", "4.20", "4.20"),
                item(ModalidadeVenda.CAIXA, "10", "1", "20", "2")));
        assertThat(analisar(null, null).situacao()).isEqualTo("MODALIDADES_DIVERGENTES");
    }

    @Test void naoInventaQuantidadeAusenteDaCaixa() {
        var item = item(ModalidadeVenda.CAIXA, "10", "1", "30", "3");
        item.setUnidadesPorModalidade(null);
        when(vendas.listarItensRentabilidadeProduto(11L, 3L, inicio, fim)).thenReturn(List.of(item));
        var r = analisar(ModalidadeVenda.CAIXA, new BigDecimal("30"));
        assertThat(r.situacao()).isEqualTo("INFORMACAO_NECESSARIA");
        assertThat(r.informacaoNecessaria()).contains("quantas unidades", "caixa");
    }

    @Test void mercado390420450ClassificaDentroDaFaixa() {
        habilitarMercado(oferta("Artesanal 40g", "3.90", "https://a.example/p"),
                oferta("Artesanal 40g", "4.20", "https://b.example/p"),
                oferta("Artesanal 40g", "4.50", "https://c.example/p"));
        var r = analisar(null, new BigDecimal("4.20"));
        assertThat(r.mercado().menorPrecoComparavel()).isEqualByComparingTo("3.90");
        assertThat(r.mercado().mediana()).isEqualByComparingTo("4.20");
        assertThat(r.mercado().maiorPrecoComparavel()).isEqualByComparingTo("4.50");
        assertThat(r.mercado().posicao()).isEqualTo(
                AnaliseRentabilidadeProdutoService.PosicaoMercado.DENTRO_DA_FAIXA);
    }

    @Test void tavilyIndisponivelPreservaAnaliseInterna() {
        properties.getFeatures().setSearch(true);
        when(pesquisa.pesquisar(any())).thenThrow(mock(OrquestradorException.class));
        when(vendas.listarItensRentabilidadeProduto(11L, 3L, inicio, fim))
                .thenReturn(List.of(item(ModalidadeVenda.UNIDADE, "1", "1", "4.20", "4.20")));
        var r = analisar(null, null);
        assertThat(r.situacao()).isEqualTo("MARGEM_CONHECIDA_POSITIVA");
        assertThat(r.mercado().posicao()).isEqualTo(
                AnaliseRentabilidadeProdutoService.PosicaoMercado.DADOS_INSUFICIENTES);
    }

    @Test void calculaCenarioExternoSeparadoSemAlterarMargemConhecida() {
        habilitarMercado(oferta("Artesanal 40g", "4.00", "https://preco-a.example/p"),
                oferta("Artesanal 40g", "4.40", "https://preco-b.example/p"));
        when(pesquisaCustos.pesquisarCustosIndiretos(any())).thenReturn(new ResultadoPesquisaCustosIndiretos(
                "q", Instant.parse("2026-08-16T12:00:00Z"), List.of(
                        fonteCusto("A", "a.example", "Energia representa 6% do faturamento de confeitarias."),
                        fonteCusto("B", "b.example", "Eletricidade equivale a 10% da receita de uma confeitaria."),
                        fonteCusto("C", "c.example", "Conta de luz alcança 8% das vendas de doces.")), List.of()));

        var r = analisar(null, new BigDecimal("4.20"));

        assertThat(r.modalidades().getFirst().margemConhecidaUnidade()).isEqualByComparingTo("2.1000");
        assertThat(r.estimativaCustosIndiretos().custoIndiretoEstimadoUnidade()).isEqualByComparingTo("0.3360");
        assertThat(r.estimativaCustosIndiretos().custoTotalEstimadoUnidade()).isEqualByComparingTo("2.4360");
        assertThat(r.estimativaCustosIndiretos().margemEstimadaUnidade()).isEqualByComparingTo("1.7640");
        assertThat(r.estimativaCustosIndiretos().custosNaoEstimados())
                .anyMatch(v -> v.startsWith("impostos:"));
    }

    @Test void produtoInexistenteOuDeOutraEmpresaNaoEConsultadoNemPesquisado() {
        when(produtos.buscarComGabaritoParaEmpresa(3L, 11L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> analisar(null, null)).isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Produto não encontrado");
        verifyNoInteractions(pesquisa, pesquisaCustos);
    }

    @Test void ofertaIndustrialDiferenteTemComparabilidadeBaixaENaoDefineFaixa() {
        habilitarMercado(oferta("Paçoquita industrial atacado 15g", "1.00", "https://industrial.example/p"),
                oferta("Paçoca artesanal 40g", "4.00", "https://a.example/p"),
                oferta("Paçoca artesanal 40g", "4.40", "https://b.example/p"));
        var r = analisar(null, new BigDecimal("4.20"));
        assertThat(r.mercado().referencias()).anySatisfy(ref -> {
            if (ref.nome().contains("industrial"))
                assertThat(ref.comparabilidade()).isEqualTo(
                        AnaliseRentabilidadeProdutoService.Comparabilidade.BAIXA);
        });
        assertThat(r.mercado().menorPrecoComparavel()).isEqualByComparingTo("4.00");
    }

    private AnaliseRentabilidadeProdutoService.Resultado analisar(ModalidadeVenda modalidade, BigDecimal preco) {
        return service.analisar(11L, 3L, inicio, fim, modalidade, preco);
    }

    private Produto produto() {
        return Produto.builder().id(3L).nome("Paçoca").descricao("Paçoca artesanal 40g")
                .unidadeMedida("unidade").precoVenda(new BigDecimal("4.20"))
                .custoAtual(new BigDecimal("2.10")).build();
    }

    private Producao producao() {
        return Producao.builder().quantidadeProduzida(new BigDecimal("100")).insumos(List.of(
                insumo("Amendoim", "120"), insumo("Açúcar", "35"),
                insumo("Embalagem", "40"), insumo("Outros", "15"))).build();
    }

    private ItemProducaoMateriaPrima insumo(String nome, String custo) {
        return ItemProducaoMateriaPrima.builder().materiaPrima(MateriaPrima.builder().nome(nome).build())
                .custoTotal(new BigDecimal(custo)).build();
    }

    private ItemVenda item(ModalidadeVenda modalidade, String qtdUnidades, String qtdModalidade,
            String total, String unitario) {
        BigDecimal unidades = new BigDecimal(qtdUnidades);
        BigDecimal modais = new BigDecimal(qtdModalidade);
        return ItemVenda.builder().quantidade(unidades).quantidadeModalidade(modais)
                .unidadesPorModalidade(unidades.divide(modais)).modalidadeVenda(modalidade)
                .valorTotal(new BigDecimal(total)).valorUnitario(new BigDecimal(unitario)).build();
    }

    @SafeVarargs
    private final void habilitarMercado(InterpretadorOfertasMercado.OfertaInterpretada... ofertas) {
        properties.getFeatures().setSearch(true);
        List<FontePesquisaPreco> fontes = java.util.Arrays.stream(ofertas)
                .map(InterpretadorOfertasMercado.OfertaInterpretada::fonte).toList();
        when(pesquisa.pesquisar(any())).thenReturn(new ResultadoPesquisaPrecos("q",
                Instant.parse("2026-08-16T12:00:00Z"), fontes, List.of()));
        when(interpretador.interpretarDeterministicamente(fontes, "Paçoca"))
                .thenReturn(new InterpretadorOfertasMercado.ResultadoInterpretacao(
                        List.of(ofertas), List.of()));
    }

    private InterpretadorOfertasMercado.OfertaInterpretada oferta(String titulo, String preco, String url) {
        var fonte = new FontePesquisaPreco(titulo, URI.create(url), URI.create(url).getHost(),
                titulo + " por R$ " + preco + " por unidade");
        var dados = new ExtracaoOfertasMercado.Oferta("fonte", "Paçoca", new BigDecimal(preco),
                ExtracaoOfertasMercado.TipoPreco.UNITARIO, ExtracaoOfertasMercado.Unidade.UNIDADE,
                null, null, null, null, null, null, null, titulo + " R$ " + preco + " por unidade",
                null, ExtracaoOfertasMercado.Confianca.ALTA);
        return new InterpretadorOfertasMercado.OfertaInterpretada(fonte, dados);
    }

    private FontePesquisaPreco fonteCusto(String titulo, String dominio, String trecho) {
        URI url = URI.create("https://" + dominio + "/referencia");
        return new FontePesquisaPreco(titulo, url, dominio, trecho);
    }
}
