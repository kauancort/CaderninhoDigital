package com.InovaSkill.CaderninhoDigital.ai.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import com.InovaSkill.CaderninhoDigital.ai.contract.QualidadeResultado;
import com.InovaSkill.CaderninhoDigital.ai.cost.HistoricoPrecosInsumoService;
import com.InovaSkill.CaderninhoDigital.entity.MateriaPrima;
import com.InovaSkill.CaderninhoDigital.exception.CodigoErroOrquestrador;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import com.InovaSkill.CaderninhoDigital.repository.MateriaPrimaRepository;
import java.math.BigDecimal;
import java.net.URI;
import java.time.*;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class ComparacaoMercadoServiceTest {
    private final HistoricoPrecosInsumoService interna=mock(HistoricoPrecosInsumoService.class);
    private final MateriaPrimaRepository materias=mock(MateriaPrimaRepository.class);
    private final PesquisaPrecosGateway pesquisa=mock(PesquisaPrecosGateway.class);
    private final InterpretadorOfertasMercado interpretador=mock(InterpretadorOfertasMercado.class);
    private final Clock clock=Clock.fixed(Instant.parse("2026-08-09T12:00:00Z"),ZoneOffset.UTC);
    private final ComparacaoMercadoService service=new ComparacaoMercadoService(interna,materias,pesquisa,interpretador,clock);

    @BeforeEach void preparar() {
        when(materias.buscarAcessivelParaAnalise(3L, 7L)).thenReturn(Optional.of(MateriaPrima.builder()
                .id(3L).nome("Amendoim").unidadeMedida("kg").build()));
        var janela = new HistoricoPrecosInsumoService.Janela(BigDecimal.TEN, BigDecimal.TEN,
                BigDecimal.TEN, BigDecimal.TEN, 2);
        when(interna.analisar(7L, 3L, LocalDate.parse("2026-07-31"))).thenReturn(
                new HistoricoPrecosInsumoService.Resultado(
                        new HistoricoPrecosInsumoService.UltimaCompra(LocalDate.parse("2026-07-15"),
                                BigDecimal.TEN, BigDecimal.TEN, new BigDecimal("100")),
                        janela, janela, janela, new BigDecimal("5"), "ESTAVEL"));
    }

    @Test void calculaEconomiaComFreteEPedidoMinimo() {
        configurarOferta(oferta("8.00", ExtracaoOfertasMercado.TipoPreco.UNITARIO,
                ExtracaoOfertasMercado.Unidade.KG, null, "12", "5.00", null, "R$ 8,00 por kg"));
        var r=comparar();
        assertThat(r.custoInternoComparavel()).isEqualByComparingTo("100.00");
        assertThat(r.menorCustoExterno()).isNull();
        assertThat(r.ofertas().getFirst().pedidoMinimo()).isEqualByComparingTo("12");
        assertThat(r.ofertas().getFirst().compativelQuantidadeAlvo()).isFalse();
        assertThat(r.materiaPrima()).isEqualTo("Amendoim");
    }

    @Test void pedidoMinimoDe50KgComConsumo35RepresentaPoucoMaisDeUmMes() {
        configurarConsumo("35");
        configurarOferta(oferta("4.90", ExtracaoOfertasMercado.TipoPreco.UNITARIO,
                ExtracaoOfertasMercado.Unidade.KG, null, "50", null, null, "R$ 4,90 por kg; mínimo 50 kg"));
        var oferta = comparar().ofertas().getFirst();
        assertThat(oferta.pedidoMinimo()).isEqualByComparingTo("50");
        assertThat(oferta.mesesCoberturaPedidoMinimo()).isEqualByComparingTo("1.43");
        assertThat(oferta.status()).contains(ComparacaoMercadoService.StatusOferta.PEDIDO_MINIMO_ACIMA_DA_QUANTIDADE)
                .doesNotContain(ComparacaoMercadoService.StatusOferta.ESTOQUE_EXCESSIVO_PROVAVEL);
    }

    @Test void pedidoMinimoDe50KgComConsumo8AlertaEstoqueExcessivoSemDescartar() {
        configurarConsumo("8");
        configurarOferta(oferta("4.90", ExtracaoOfertasMercado.TipoPreco.UNITARIO,
                ExtracaoOfertasMercado.Unidade.KG, null, "50", null, null, "R$ 4,90 por kg; mínimo 50 kg"));
        var resultado = comparar();
        assertThat(resultado.ofertas()).hasSize(1);
        assertThat(resultado.ofertas().getFirst().mesesCoberturaPedidoMinimo()).isEqualByComparingTo("6.25");
        assertThat(resultado.ofertas().getFirst().status())
                .contains(ComparacaoMercadoService.StatusOferta.ESTOQUE_EXCESSIVO_PROVAVEL);
    }

    @Test void excluiUnidadeIncompativelEPromocaoVencida() {
        configurarOferta(
                oferta("2.00", ExtracaoOfertasMercado.TipoPreco.UNITARIO, ExtracaoOfertasMercado.Unidade.L,
                        null, null, null, null, "R$ 2,00 por litro"),
                oferta("8.00", ExtracaoOfertasMercado.TipoPreco.UNITARIO, ExtracaoOfertasMercado.Unidade.KG,
                        null, null, null, LocalDate.parse("2026-08-01"), "R$ 8,00 por kg"));
        assertThat(comparar().ofertas()).isEmpty();
    }

    @Test void rejeitaLeiteEmPoMesmoQuandoIaRotulaErroneamenteComoLitro() {
        when(materias.buscarAcessivelParaAnalise(3L, 7L)).thenReturn(Optional.of(MateriaPrima.builder()
                .id(3L).nome("Leite integral").unidadeMedida("L").build()));
        configurarOferta(oferta("34.99", ExtracaoOfertasMercado.TipoPreco.UNITARIO,
                ExtracaoOfertasMercado.Unidade.L, null, null, null, null,
                "Leite em pó integral sachê 1 kg por R$ 34,99"));

        var resultado = service.comparar(1L, 7L, 3L, LocalDate.parse("2026-05-01"),
                LocalDate.parse("2026-07-31"), "L", BigDecimal.ONE, "Marília", "SP");

        assertThat(resultado.ofertas()).isEmpty();
        assertThat(resultado.situacao()).isEqualTo("INSUFICIENTE");
    }

    @Test void aceitaLeiteLiquidoComEvidenciaEmLitro() {
        when(materias.buscarAcessivelParaAnalise(3L, 7L)).thenReturn(Optional.of(MateriaPrima.builder()
                .id(3L).nome("Leite integral").unidadeMedida("L").build()));
        configurarOferta(oferta("6.48", ExtracaoOfertasMercado.TipoPreco.UNITARIO,
                ExtracaoOfertasMercado.Unidade.L, null, null, null, null,
                "Leite integral UHT 1 L por R$ 6,48"));

        var resultado = service.comparar(1L, 7L, 3L, LocalDate.parse("2026-05-01"),
                LocalDate.parse("2026-07-31"), "L", BigDecimal.ONE, "Marília", "SP");

        assertThat(resultado.ofertas()).hasSize(1);
        assertThat(resultado.ofertas().getFirst().precoUnitario()).isEqualByComparingTo("6.4800");
    }

    @Test void escolheMelhorEntreMultiplasFontesSemInventarFrete() {
        configurarOferta(
                oferta("9.00", ExtracaoOfertasMercado.TipoPreco.UNITARIO, ExtracaoOfertasMercado.Unidade.KG,
                        null, null, null, null, "R$ 9,00 por kg"),
                oferta("8.50", ExtracaoOfertasMercado.TipoPreco.UNITARIO, ExtracaoOfertasMercado.Unidade.KG,
                        null, null, null, null, "R$ 8,50 por kg"));
        var r=comparar();
        assertThat(r.menorCustoExterno()).isEqualByComparingTo("85.00");
        assertThat(r.economiaEstimada()).isEqualByComparingTo("15.00");
        assertThat(r.avisos()).anyMatch(a -> a.contains("não foi estimado"));
    }

    @Test void sinalizaFreteQuandoSuperaVintePorCentoDaMercadoria() {
        configurarOferta(oferta("10.00", ExtracaoOfertasMercado.TipoPreco.UNITARIO,
                ExtracaoOfertasMercado.Unidade.KG, null, null, "30.00", null, "R$ 10,00 por kg"));

        assertThat(comparar().ofertas().getFirst().status())
                .contains(ComparacaoMercadoService.StatusOferta.FRETE_ALTO);
    }

    @Test void converteEmbalagemDeQuinhentosGramasParaKg() {
        configurarOferta(ofertaEmbalagem("6.00", "500", ExtracaoOfertasMercado.Unidade.G,
                "500 g por R$ 6,00"));
        var r=comparar();
        assertThat(r.ofertas().getFirst().precoUnitario()).isEqualByComparingTo("12.0000");
        assertThat(r.menorCustoExterno()).isEqualByComparingTo("120.00");
    }

    @Test void regressaoNaoMisturaPrecoEEmbalagemDeAnunciosDiferentes() {
        configurarOferta(
                ofertaEmbalagem("145.00", "50", ExtracaoOfertasMercado.Unidade.KG,
                        "R$ 145,00 Saco de 50 kg"),
                oferta("3.60", ExtracaoOfertasMercado.TipoPreco.UNITARIO, ExtracaoOfertasMercado.Unidade.KG,
                        null, null, null, null, "R$ 3,60 Kilo"));
        var resultado = comparar();
        assertThat(resultado.ofertas()).extracting(ComparacaoMercadoService.Oferta::precoUnitario)
                .containsExactly(new BigDecimal("3.6000"), new BigDecimal("2.9000"));
        assertThat(resultado.menorCustoExterno()).isEqualByComparingTo("36.00");
        assertThat(resultado.ofertas()).filteredOn(oferta ->
                oferta.precoUnitario().compareTo(new BigDecimal("2.9000")) == 0)
                .singleElement().satisfies(oferta ->
                        assertThat(oferta.quantidadeCalculada()).isEqualByComparingTo("50"));
        assertThat(resultado.ofertas()).noneMatch(o -> o.precoUnitario().compareTo(new BigDecimal("5.80")) == 0);
    }

    @Test void precoPorKgDeEmbalagem25KgExigeComprarAoMenos25Kg() {
        configurarOferta(new ExtracaoOfertasMercado.Oferta("fonte-1", "Amendoim",
                new BigDecimal("5.65"), ExtracaoOfertasMercado.TipoPreco.UNITARIO,
                ExtracaoOfertasMercado.Unidade.KG, new BigDecimal("25"),
                ExtracaoOfertasMercado.Unidade.KG, null, null, null, null, null,
                "25KG - R$5,65/kg", null, ExtracaoOfertasMercado.Confianca.ALTA));

        var oferta = comparar().ofertas().getFirst();

        assertThat(oferta.quantidadeCalculada()).isEqualByComparingTo("25");
        assertThat(oferta.pedidoMinimo()).isEqualByComparingTo("25");
        assertThat(oferta.custoTotal()).isEqualByComparingTo("141.25");
        assertThat(oferta.status()).contains(ComparacaoMercadoService.StatusOferta.PEDIDO_MINIMO_ACIMA_DA_QUANTIDADE);
    }

    @Test void falhaExternaPreservaAnaliseInterna() {
        when(pesquisa.pesquisar(any())).thenThrow(new OrquestradorException(
                CodigoErroOrquestrador.TIMEOUT,HttpStatus.GATEWAY_TIMEOUT,"indisponível"));
        var r=comparar();
        assertThat(r.custoInternoComparavel()).isEqualByComparingTo("100.00");
        assertThat(r.ofertas()).isEmpty(); assertThat(r.avisos()).anyMatch(a -> a.contains("preservada"));
    }

    @Test void informaLimiteRealDoOpenRouterSemConfirmarPrecos() {
        FontePesquisaPreco fonte = fonte("R$ 8,00 por kg");
        when(pesquisa.pesquisar(any())).thenReturn(new ResultadoPesquisaPrecos(
                "q", Instant.now(clock), List.of(fonte, fonte, fonte), List.of()));
        when(interpretador.interpretar(anyList(), anyString(), anyLong())).thenThrow(
                new OrquestradorException(CodigoErroOrquestrador.LIMITE_EXCEDIDO,
                        HttpStatus.TOO_MANY_REQUESTS, "limite"));

        var resultado = comparar();

        assertThat(resultado.ofertas()).isEmpty();
        assertThat(resultado.avisos()).singleElement().asString()
                .contains("3 fontes", "limite", "OpenRouter");
        assertThat(resultado.fontes()).hasSize(3)
                .allMatch(item -> item.status() == ResultadoFontePesquisa.Status.NAO_CONCLUIDA);
    }

    @Test void concluiComFontesValidasMesmoQuandoUmaFonteNaoFoiValidada() {
        FontePesquisaPreco primeira = fonte("R$ 8,00 por kg");
        FontePesquisaPreco segunda = new FontePesquisaPreco("Outra loja", URI.create("https://outra.example/item"),
                "outra.example", "preço não identificado");
        when(pesquisa.pesquisar(any())).thenReturn(new ResultadoPesquisaPrecos(
                "q", Instant.now(clock), List.of(primeira, segunda), List.of()));
        var oferta = oferta("8.00", ExtracaoOfertasMercado.TipoPreco.UNITARIO,
                ExtracaoOfertasMercado.Unidade.KG, null, null, null, null, "R$ 8,00 por kg");
        when(interpretador.interpretarDetalhado(anyList(), anyString(), anyLong())).thenReturn(
                new InterpretadorOfertasMercado.ResultadoInterpretacao(
                        List.of(new InterpretadorOfertasMercado.OfertaInterpretada(primeira, oferta)),
                        List.of(
                                new ResultadoFontePesquisa("fonte-1", primeira.titulo(), primeira.url().toString(),
                                        primeira.dominio(), ResultadoFontePesquisa.Status.VALIDADA, null),
                                new ResultadoFontePesquisa("fonte-2", segunda.titulo(), segunda.url().toString(),
                                        segunda.dominio(), ResultadoFontePesquisa.Status.NAO_CONCLUIDA, "não concluída"))));

        var resultado = comparar();

        assertThat(resultado.ofertas()).hasSize(1);
        assertThat(resultado.situacao()).isEqualTo("OFERTA_EXTERNA_MENOR");
        assertThat(resultado.menorCustoExterno()).isEqualByComparingTo("80.00");
        assertThat(resultado.avisos()).anyMatch(aviso -> aviso.contains("não foram usadas"));
    }

    private ComparacaoMercadoService.Resultado comparar(){return service.comparar(7L,3L,
            LocalDate.parse("2026-07-01"),LocalDate.parse("2026-07-31"),"kg",BigDecimal.TEN,"Belo Horizonte","MG");}
    private void configurarConsumo(String consumo) {
        var janela = new HistoricoPrecosInsumoService.Janela(BigDecimal.TEN, BigDecimal.TEN,
                BigDecimal.TEN, BigDecimal.TEN, 2);
        when(interna.analisar(7L, 3L, LocalDate.parse("2026-07-31"))).thenReturn(
                new HistoricoPrecosInsumoService.Resultado(
                        new HistoricoPrecosInsumoService.UltimaCompra(LocalDate.parse("2026-07-15"),
                                BigDecimal.TEN, BigDecimal.TEN, new BigDecimal("100")),
                        janela, janela, janela, new BigDecimal(consumo), "ESTAVEL"));
    }
    private void configurarOferta(ExtracaoOfertasMercado.Oferta... ofertas) {
        List<FontePesquisaPreco> fontes = java.util.stream.IntStream.range(0, ofertas.length)
                .mapToObj(i -> fonte(ofertas[i].evidenciaPreco())).toList();
        when(pesquisa.pesquisar(any())).thenReturn(new ResultadoPesquisaPrecos("q",Instant.now(clock),fontes,List.of()));
        List<InterpretadorOfertasMercado.OfertaInterpretada> interpretadas = java.util.stream.IntStream.range(0, ofertas.length)
                .mapToObj(i -> new InterpretadorOfertasMercado.OfertaInterpretada(fontes.get(i), ofertas[i])).toList();
        when(interpretador.interpretar(anyList(), anyString(), anyLong())).thenReturn(interpretadas);
    }
    private ExtracaoOfertasMercado.Oferta oferta(String preco, ExtracaoOfertasMercado.TipoPreco tipo,
            ExtracaoOfertasMercado.Unidade unidadePreco, BigDecimal embalagem, String minimo,
            String frete, LocalDate validade, String evidencia) {
        return new ExtracaoOfertasMercado.Oferta("fonte-1", "Amendoim", new BigDecimal(preco), tipo,
                unidadePreco, embalagem, embalagem == null ? null : ExtracaoOfertasMercado.Unidade.G,
                minimo == null ? null : new BigDecimal(minimo), minimo == null ? null : ExtracaoOfertasMercado.Unidade.KG,
                frete == null ? null : new BigDecimal(frete), validade, null, evidencia, null,
                ExtracaoOfertasMercado.Confianca.ALTA);
    }
    private ExtracaoOfertasMercado.Oferta ofertaEmbalagem(String preco, String quantidade,
            ExtracaoOfertasMercado.Unidade unidade, String evidencia) {
        return new ExtracaoOfertasMercado.Oferta("fonte-1", "Amendoim", new BigDecimal(preco),
                ExtracaoOfertasMercado.TipoPreco.TOTAL_EMBALAGEM, null, new BigDecimal(quantidade), unidade,
                null, null, null, null, null, evidencia, null, ExtracaoOfertasMercado.Confianca.ALTA);
    }
    private FontePesquisaPreco fonte(String trecho){return new FontePesquisaPreco("Loja",URI.create("https://loja.example/item"),"loja.example",trecho);}
}
