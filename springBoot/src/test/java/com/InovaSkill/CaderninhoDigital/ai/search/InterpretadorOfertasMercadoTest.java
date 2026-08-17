package com.InovaSkill.CaderninhoDigital.ai.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.InovaSkill.CaderninhoDigital.ai.gateway.MetadadosModelo;
import com.InovaSkill.CaderninhoDigital.ai.gateway.ModeloGateway;
import com.InovaSkill.CaderninhoDigital.ai.gateway.RespostaModelo;
import com.InovaSkill.CaderninhoDigital.ai.gateway.SolicitacaoModelo;
import com.InovaSkill.CaderninhoDigital.ai.privacy.PoliticaDadosIa;
import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import com.InovaSkill.CaderninhoDigital.ai.observability.ControleOperacionalIa;
import com.InovaSkill.CaderninhoDigital.exception.CodigoErroOrquestrador;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.net.URI;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Clock;
import org.springframework.http.HttpStatus;

class InterpretadorOfertasMercadoTest {
    private final ModeloGateway gateway = mock(ModeloGateway.class);
    private final AiOrchestratorProperties properties = new AiOrchestratorProperties();
    private final ControleOperacionalIa controle = new ControleOperacionalIa(properties,
            new SimpleMeterRegistry(), Clock.systemUTC());
    private final InterpretadorOfertasMercado interpretador = new InterpretadorOfertasMercado(
            gateway, new PoliticaDadosIa(properties), new ObjectMapper(), controle, properties);

    @Test void preservaUrlConfiavelDoBackendESeparaAnuncios() {
        var primeira = oferta("fonte-1", "145.00", ExtracaoOfertasMercado.TipoPreco.TOTAL_EMBALAGEM,
                ExtracaoOfertasMercado.Unidade.KG, new BigDecimal("50"), "R$ 145,00 Saco de 50 kg");
        var segunda = oferta("fonte-1", "3.60", ExtracaoOfertasMercado.TipoPreco.UNITARIO,
                ExtracaoOfertasMercado.Unidade.KG, null, "R$ 3,60 Kilo");
        when(gateway.gerarEstruturado(any(), eq(ExtracaoOfertasMercado.class), any())).thenReturn(new RespostaModelo<>(
                new ExtracaoOfertasMercado(List.of(primeira, segunda)),
                new MetadadosModelo("modelo", "modelo", 1, 1, 2, 10, false)));
        var fonte = new FontePesquisaPreco("MF Rural", URI.create("https://www.mfrural.com.br/busca/acucar"),
                "mfrural.com.br", "R$ 145,00 Saco de 50 kg. Outro anúncio: R$ 3,60 Kilo");

        var resultado = interpretador.interpretar(List.of(fonte), "Açúcar demerara", 1L);

        assertThat(resultado).hasSize(2).allMatch(item -> item.fonte().url().equals(fonte.url()));
        assertThat(resultado).extracting(item -> item.dados().evidenciaPreco())
                .containsExactly("R$ 145,00 Saco de 50 kg", "R$ 3,60 Kilo");
    }

    @Test void removeDadosPessoaisAntesDeEnviarConteudoExterno() {
        when(gateway.gerarEstruturado(any(), eq(ExtracaoOfertasMercado.class), any())).thenReturn(new RespostaModelo<>(
                new ExtracaoOfertasMercado(List.of()), new MetadadosModelo("m", "m", null, null, null, 1, false)));
        var fonte = new FontePesquisaPreco("Loja", URI.create("https://loja.example/item"), "loja.example",
                "Contato comercial teste@loja.example. R$ 10,00 por kg");
        interpretador.interpretar(List.of(fonte), "Amendoim", 1L);

        ArgumentCaptor<SolicitacaoModelo> captor = ArgumentCaptor.forClass(SolicitacaoModelo.class);
        verify(gateway).gerarEstruturado(captor.capture(), eq(ExtracaoOfertasMercado.class), any());
        assertThat(captor.getValue().mensagens().get(1).conteudo())
                .doesNotContain("teste@loja.example").contains("[DADO_RESTRITO_REMOVIDO]");
    }

    @Test void preservaCoberturaDeTodasAsFontesMesmoQuandoUmaERejeitada() {
        var oferta = oferta("fonte-1", "10.00", ExtracaoOfertasMercado.TipoPreco.UNITARIO,
                ExtracaoOfertasMercado.Unidade.KG, null, "R$ 10,00 por kg");
        when(gateway.gerarEstruturado(any(), eq(ExtracaoOfertasMercado.class), any())).thenReturn(new RespostaModelo<>(
                new ExtracaoOfertasMercado(List.of(
                        new ExtracaoOfertasMercado.Fonte("fonte-1", ExtracaoOfertasMercado.Status.ACEITA, null, List.of(oferta)),
                        new ExtracaoOfertasMercado.Fonte("fonte-2", ExtracaoOfertasMercado.Status.REJEITADA, "sem preço", List.of()))),
                new MetadadosModelo("m", "m", null, null, null, 1, false)));
        var primeira = new FontePesquisaPreco("Loja 1", URI.create("https://loja1.example/item"), "loja1.example", "R$ 10/kg");
        var segunda = new FontePesquisaPreco("Loja 2", URI.create("https://loja2.example/item"), "loja2.example", "sem preço");

        var resultado = interpretador.interpretarDetalhado(List.of(primeira, segunda), "Açúcar", 1L);

        assertThat(resultado.ofertas()).hasSize(1);
        assertThat(resultado.fontes()).extracting(ResultadoFontePesquisa::status)
                .containsExactly(ResultadoFontePesquisa.Status.VALIDADA, ResultadoFontePesquisa.Status.REJEITADA);
        assertThat(resultado.fontes().get(1).motivo()).isEqualTo("sem preço");
    }

    @Test void recuperaAnuncioExplicitoQuandoModeloNaoEntregaJsonValido() {
        when(gateway.gerarEstruturado(any(), eq(ExtracaoOfertasMercado.class), any()))
                .thenThrow(new OrquestradorException(CodigoErroOrquestrador.PLANO_INVALIDO,
                        HttpStatus.BAD_GATEWAY, "formato inválido"));
        var primeira = new FontePesquisaPreco("Açúcar Demerara - Loja", URI.create("https://loja.example/acucar"),
                "loja.example", "Açúcar Demerara em pacote de 10 kg por R$ 95,29.");
        var segunda = new FontePesquisaPreco("Açúcar Demerara atacado", URI.create("https://atacado.example/acucar"),
                "atacado.example", "Açúcar Demerara por R$ 9,53 por kg.");

        var resultado = interpretador.interpretarDetalhado(List.of(primeira, segunda), "Açúcar Demerara", 1L);

        assertThat(resultado.ofertas()).hasSize(2);
        assertThat(resultado.fontes()).extracting(ResultadoFontePesquisa::status)
                .containsExactly(ResultadoFontePesquisa.Status.VALIDADA, ResultadoFontePesquisa.Status.VALIDADA);
        assertThat(resultado.ofertas().get(0).dados().tipoPreco())
                .isEqualTo(ExtracaoOfertasMercado.TipoPreco.TOTAL_EMBALAGEM);
        assertThat(resultado.ofertas().get(0).dados().precoAnunciado()).isEqualByComparingTo("95.29");
        assertThat(resultado.ofertas().get(0).dados().quantidadeEmbalagem()).isEqualByComparingTo("10");
        assertThat(resultado.ofertas().get(1).dados().tipoPreco())
                .isEqualTo(ExtracaoOfertasMercado.TipoPreco.UNITARIO);
        assertThat(resultado.ofertas().get(1).dados().unidadePreco())
                .isEqualTo(ExtracaoOfertasMercado.Unidade.KG);
    }

    @Test void fallbackRespeitaVariantesDeEmbalagemEIgnoraProdutoRelacionado() {
        when(gateway.gerarEstruturado(any(), eq(ExtracaoOfertasMercado.class), any())).thenReturn(
                new RespostaModelo<>(new ExtracaoOfertasMercado(List.of(
                        new ExtracaoOfertasMercado.Fonte("fonte-1", ExtracaoOfertasMercado.Status.REJEITADA,
                                "sem oferta estruturada", List.of()))),
                        new MetadadosModelo("m", "m", 1, 1, 2, 1, false)));
        var fonte = new FontePesquisaPreco("Açúcar Demerara atacado",
                URI.create("https://loja.example/acucar-demerara"), "loja.example",
                "Açúcar Demerara. Embalagem - preço por quilo: 1KG - R$8,35/kg, "
                        + "25KG - R$5,65/kg, 5KG - R$7,00/kg. Produtos relacionados: "
                        + "Açúcar Mascavo R$6,51/kg.");

        var resultado = interpretador.interpretarDetalhado(List.of(fonte), "Açúcar Demerara", 1L);

        assertThat(resultado.ofertas()).hasSize(3);
        assertThat(resultado.ofertas()).extracting(item -> item.dados().precoAnunciado())
                .containsExactlyInAnyOrder(new BigDecimal("8.350000"), new BigDecimal("5.650000"),
                        new BigDecimal("7.000000"));
        assertThat(resultado.ofertas()).noneMatch(item ->
                item.dados().precoAnunciado().compareTo(new BigDecimal("6.51")) == 0);
        assertThat(resultado.ofertas()).anyMatch(item -> item.dados().quantidadeEmbalagem()
                .compareTo(new BigDecimal("25")) == 0);
    }

    @Test void fallbackNaoTransformaDescontoOuParcelaDePaginaDeBuscaEmPrecoDoPacote() {
        when(gateway.gerarEstruturado(any(), eq(ExtracaoOfertasMercado.class), any())).thenReturn(
                new RespostaModelo<>(new ExtracaoOfertasMercado(List.of()),
                        new MetadadosModelo("m", "m", 1, 1, 2, 1, false)));
        var fonte = new FontePesquisaPreco("Açúcar Demerara 10 Kg - Busca",
                URI.create("https://loja.example/busca"), "loja.example",
                "Açúcar demerara 10 kg. Produto avulso R$10,98 R$10,43 5% OFF. "
                        + "5x R$34,20 sem juros.");

        var resultado = interpretador.interpretarDetalhado(List.of(fonte), "Açúcar Demerara", 1L);

        assertThat(resultado.ofertas()).isEmpty();
        assertThat(resultado.fontes()).singleElement().satisfies(item ->
                assertThat(item.status()).isNotEqualTo(ResultadoFontePesquisa.Status.VALIDADA));
    }

    @Test void fallbackAceitaQuantidadeImediatamenteAntesDoPrecoTotal() {
        when(gateway.gerarEstruturado(any(), eq(ExtracaoOfertasMercado.class), any())).thenReturn(
                new RespostaModelo<>(new ExtracaoOfertasMercado(List.of()),
                        new MetadadosModelo("m", "m", 1, 1, 2, 1, false)));
        var fonte = new FontePesquisaPreco("Açúcar Demerara 10 kg - Ingredientes Online",
                URI.create("https://loja.example/acucar-demerara-10-kg"), "loja.example",
                "Açúcar Demerara 10 kg - R$ 95,29 no pagamento à vista.");

        var resultado = interpretador.interpretarDetalhado(List.of(fonte), "Açúcar Demerara", 1L);

        assertThat(resultado.ofertas()).singleElement().satisfies(item -> {
            assertThat(item.dados().tipoPreco()).isEqualTo(ExtracaoOfertasMercado.TipoPreco.TOTAL_EMBALAGEM);
            assertThat(item.dados().precoAnunciado()).isEqualByComparingTo("95.29");
            assertThat(item.dados().quantidadeEmbalagem()).isEqualByComparingTo("10");
        });
        assertThat(resultado.fontes()).singleElement().satisfies(item ->
                assertThat(item.status()).isEqualTo(ResultadoFontePesquisa.Status.VALIDADA));
    }

    @Test void fallbackNaoAceitaProdutosRecomendadosSoPorqueTituloDaPaginaTemProdutoBuscado() {
        when(gateway.gerarEstruturado(any(), eq(ExtracaoOfertasMercado.class), any())).thenReturn(
                new RespostaModelo<>(new ExtracaoOfertasMercado(List.of()),
                        new MetadadosModelo("m", "m", 1, 1, 2, 1, false)));
        var fonte = new FontePesquisaPreco("Açúcar Demerara 10 kg - Ingredientes Online",
                URI.create("https://loja.example/acucar-demerara-10-kg"), "loja.example",
                "Açúcar Demerara 10 kg R$ 95,29. Recomendado para você: "
                        + "Farinha de Castanha de Caju 5 kg R$ 189,00. Amêndoa Defumada 1 kg R$ 107,10.");

        var resultado = interpretador.interpretarDetalhado(List.of(fonte), "Açúcar Demerara", 1L);

        assertThat(resultado.ofertas()).singleElement().satisfies(item ->
                assertThat(item.dados().precoAnunciado()).isEqualByComparingTo("95.29"));
    }

    private ExtracaoOfertasMercado.Oferta oferta(String fonte, String preco,
            ExtracaoOfertasMercado.TipoPreco tipo, ExtracaoOfertasMercado.Unidade unidade,
            BigDecimal embalagem, String evidencia) {
        return new ExtracaoOfertasMercado.Oferta(fonte, "Açúcar demerara", new BigDecimal(preco), tipo,
                tipo == ExtracaoOfertasMercado.TipoPreco.UNITARIO ? unidade : null,
                embalagem, embalagem == null ? null : unidade, null, null, null, null, null,
                evidencia, null, ExtracaoOfertasMercado.Confianca.ALTA);
    }
}
