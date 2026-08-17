package com.InovaSkill.CaderninhoDigital.ai.orchestration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.InovaSkill.CaderninhoDigital.ai.contract.ArgumentosComparacaoMercado;
import com.InovaSkill.CaderninhoDigital.ai.contract.ChamadaFerramenta;
import com.InovaSkill.CaderninhoDigital.ai.contract.FerramentaPermitida;
import com.InovaSkill.CaderninhoDigital.ai.contract.IntencaoOrquestrador;
import com.InovaSkill.CaderninhoDigital.ai.contract.ModoResposta;
import com.InovaSkill.CaderninhoDigital.ai.contract.PlanoOrquestracao;
import com.InovaSkill.CaderninhoDigital.ai.gateway.MetadadosModelo;
import com.InovaSkill.CaderninhoDigital.ai.gateway.ModeloGateway;
import com.InovaSkill.CaderninhoDigital.ai.gateway.RespostaModelo;
import com.InovaSkill.CaderninhoDigital.ai.observability.ControleOperacionalIa;
import com.InovaSkill.CaderninhoDigital.ai.privacy.PoliticaDadosIa;
import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class PlanejadorConsultaIaTest {

    @Test
    void removeDuplicataEUsaUltimosNoventaDiasQuandoPerguntaNaoInformaPeriodo() {
        ModeloGateway gateway = mock(ModeloGateway.class);
        PoliticaDadosIa politica = mock(PoliticaDadosIa.class);
        ContextoPlanejamentoService contexto = mock(ContextoPlanejamentoService.class);
        AiOrchestratorProperties properties = new AiOrchestratorProperties();
        properties.getFeatures().setSearch(true);
        Clock clock = Clock.fixed(Instant.parse("2026-08-15T12:00:00Z"),
                ZoneId.of("America/Sao_Paulo"));
        ControleOperacionalIa.Sessao sessao = new ControleOperacionalIa(properties,
                new SimpleMeterRegistry(), clock).iniciar(1L, 1L, "teste-planejador");
        when(politica.delimitarEntradaNaoConfiavel(any())).thenAnswer(inv -> inv.getArgument(0));
        when(contexto.carregar(1L)).thenReturn(new ContextoPlanejamentoService.Contexto(1L, List.of(),
                List.of(new ContextoPlanejamentoService.ItemCatalogo(9L, "Açúcar demerara", "kg"))));
        var argumentosAntigos = new ArgumentosComparacaoMercado(9L,
                LocalDate.parse("2024-01-01"), LocalDate.parse("2024-03-30"), "kg",
                new BigDecimal("10"), "Marília/SP", "SP");
        var chamada = new ChamadaFerramenta(FerramentaPermitida.COMPARAR_PRECO_MERCADO, argumentosAntigos);
        var plano = new PlanoOrquestracao("1.0", IntencaoOrquestrador.ANALISE_EMPRESARIAL,
                List.of(chamada, chamada), ModoResposta.ANALITICA);
        when(gateway.gerarPlano(any())).thenReturn(new RespostaModelo<>(plano,
                new MetadadosModelo("m", "m", 1, 1, 2, 1, false)));
        var planejador = new PlanejadorConsultaIa(gateway, politica, properties, contexto,
                new ObjectMapper().findAndRegisterModules(), clock);

        PlanoOrquestracao resultado = planejador.planejar(
                "Estou pagando caro por 10 kg de açúcar demerara?", 1L, sessao);

        assertThat(resultado.chamadas()).hasSize(1);
        assertThat(resultado.intencao()).isEqualTo(IntencaoOrquestrador.COMPARAR_PRECO_MERCADO);
        var argumentos = (ArgumentosComparacaoMercado) resultado.chamadas().getFirst().argumentos();
        assertThat(argumentos.inicio()).isEqualTo("2026-05-18");
        assertThat(argumentos.fim()).isEqualTo("2026-08-15");
        assertThat(argumentos.quantidadeAlvo()).isEqualByComparingTo("10");
        assertThat(argumentos.cidade()).isEqualTo("Marília");
        assertThat(argumentos.uf()).isEqualTo("SP");

        ArgumentCaptor<com.InovaSkill.CaderninhoDigital.ai.gateway.SolicitacaoModelo> solicitacao =
                ArgumentCaptor.forClass(com.InovaSkill.CaderninhoDigital.ai.gateway.SolicitacaoModelo.class);
        org.mockito.Mockito.verify(gateway).gerarPlano(solicitacao.capture());
        assertThat(solicitacao.getValue().mensagens().getFirst().conteudo())
                .contains("Hoje é 2026-08-15", "America/Sao_Paulo");
    }
}
