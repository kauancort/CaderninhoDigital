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
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.net.URI;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Clock;

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

    private ExtracaoOfertasMercado.Oferta oferta(String fonte, String preco,
            ExtracaoOfertasMercado.TipoPreco tipo, ExtracaoOfertasMercado.Unidade unidade,
            BigDecimal embalagem, String evidencia) {
        return new ExtracaoOfertasMercado.Oferta(fonte, "Açúcar demerara", new BigDecimal(preco), tipo,
                tipo == ExtracaoOfertasMercado.TipoPreco.UNITARIO ? unidade : null,
                embalagem, embalagem == null ? null : unidade, null, null, null, null, null,
                evidencia, null, ExtracaoOfertasMercado.Confianca.ALTA);
    }
}
