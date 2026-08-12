package com.InovaSkill.CaderninhoDigital.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import com.InovaSkill.CaderninhoDigital.ai.contract.*;
import com.InovaSkill.CaderninhoDigital.ai.gateway.*;
import com.InovaSkill.CaderninhoDigital.ai.privacy.PoliticaDadosIa;
import com.InovaSkill.CaderninhoDigital.ai.orchestration.ConsolidadorResultadosOrquestracao;
import com.InovaSkill.CaderninhoDigital.ai.orchestration.ExecutorPlanoOrquestracao;
import com.InovaSkill.CaderninhoDigital.ai.orchestration.PoliticaPlanoOrquestracao;
import com.InovaSkill.CaderninhoDigital.ai.orchestration.ResolvedorDeterministicoOrquestracao;
import com.InovaSkill.CaderninhoDigital.ai.tool.ExecutorFerramentas;
import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import com.InovaSkill.CaderninhoDigital.dto.request.AcaoRapidaAssistente;
import com.InovaSkill.CaderninhoDigital.dto.request.ConversaRequestDTO;
import com.InovaSkill.CaderninhoDigital.exception.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import com.InovaSkill.CaderninhoDigital.ai.observability.ControleOperacionalIa;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Clock;
import java.time.ZoneOffset;
import java.util.concurrent.Executors;
import org.mockito.ArgumentCaptor;
import com.InovaSkill.CaderninhoDigital.security.UsuarioPrincipal;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import com.InovaSkill.CaderninhoDigital.ai.orchestration.MapeadorDadosAssistente;
import com.InovaSkill.CaderninhoDigital.ai.orchestration.PoliticaRespostaAnalitica;
import com.InovaSkill.CaderninhoDigital.ai.orchestration.ResolvedorConsultaMercado;
import com.InovaSkill.CaderninhoDigital.dto.response.DadosAssistenteDTO;
import org.springframework.security.core.context.SecurityContextHolder;

class AssistenteOrquestradorServiceTest {
    private final ModeloGateway gateway = mock(ModeloGateway.class);
    private final PlanoContratoValidator validator = mock(PlanoContratoValidator.class);
    private final ExecutorFerramentas executor = mock(ExecutorFerramentas.class);
    private final PoliticaDadosIa politica = mock(PoliticaDadosIa.class);
    private final AiOrchestratorProperties properties = new AiOrchestratorProperties();
    private AssistenteOrquestradorService service;

    @BeforeEach void setup() {
        when(politica.delimitarEntradaNaoConfiavel(anyString())).thenAnswer(i -> i.getArgument(0));
        when(politica.protegerRespostaTexto(anyString())).thenAnswer(i -> i.getArgument(0));
        var principal = new UsuarioPrincipal(7L, "Gestor", "gestor@example.invalid", "x", null, "GESTOR", false);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
        var controle = new ControleOperacionalIa(properties, new SimpleMeterRegistry(),
                Clock.fixed(Instant.parse("2026-08-06T12:00:00Z"), ZoneOffset.UTC));
        Clock clock = Clock.fixed(Instant.parse("2026-08-06T12:00:00Z"), ZoneOffset.UTC);
        var politicaPlano = new PoliticaPlanoOrquestracao(validator);
        var resolvedor = new ResolvedorDeterministicoOrquestracao(properties, clock);
        var executorPlano = new ExecutorPlanoOrquestracao(executor,
                Executors.newVirtualThreadPerTaskExecutor(), properties);
        service = new AssistenteOrquestradorService(properties, gateway, politicaPlano, resolvedor,
                executorPlano, new ConsolidadorResultadosOrquestracao(), new MapeadorDadosAssistente(), politica,
                new ObjectMapper().findAndRegisterModules(), controle, new PoliticaRespostaAnalitica(),
                mock(ResolvedorConsultaMercado.class));
    }

    @Test void acaoRapidaFuncionaSemModelo() {
        when(executor.executar(any(), any())).thenReturn(resultado(2));
        var request = request("Como está?", AcaoRapidaAssistente.VERIFICAR_ESTOQUE);
        var response = service.conversar(request);
        assertThat(response.getResposta()).contains("2 insumos");
        assertThat(response.getCorrelacao()).isNotBlank();
        verify(executor).executar(any(), eq(response.getCorrelacao()));
        verifyNoInteractions(gateway);
    }

    @Test void removeIdentificadoresInternosAntesDoPayloadDoModelo() {
        var seguro = service.dadosSegurosParaModelo(Map.of("materiaPrimaId", 42,
                "itens", List.of(Map.of("materiaPrimaId", 42, "valorTotal", 100))));
        assertThat(seguro.toString()).doesNotContain("materiaPrimaId", "42").contains("valorTotal");
    }

    @Test void textoLivrePlanejaExecutaEUsaFallbackSeRespostaFinalFalhar() {
        when(gateway.gerarPlano(any())).thenReturn(new RespostaModelo<>(planoEstoque(), metadata()));
        when(executor.executar(any(), any())).thenReturn(resultado(1));
        when(gateway.gerarRespostaFinal(any())).thenThrow(new OrquestradorException(
                CodigoErroOrquestrador.TIMEOUT, HttpStatus.GATEWAY_TIMEOUT, "timeout"));
        assertThat(service.conversar(request("Quais insumos estão críticos?", null)).getResposta())
                .contains("1 insumo");
        verify(executor, times(1)).executar(any(), any());
    }

    @Test void consultaDiretaDeVendasComDatasNaoEsperaPeloModelo() {
        when(executor.executar(any(), any())).thenReturn(new ResultadoFerramenta(
                FerramentaPermitida.RESUMO_VENDAS, StatusResultado.SUCESSO,
                Map.of("quantidadeVendas", 2L, "valorTotalValido", 300),
                LocalDate.parse("2026-08-01"), LocalDate.parse("2026-08-07"),
                Instant.parse("2026-08-06T12:00:00Z"), List.of(), QualidadeResultado.COMPLETO));
        service.conversar(request("Quanto vendemos de 01/08/2026 a 07/08/2026?", null));
        ArgumentCaptor<ChamadaFerramenta> captor = ArgumentCaptor.forClass(ChamadaFerramenta.class);
        verify(executor).executar(captor.capture(), any());
        assertThat(captor.getValue().ferramenta()).isEqualTo(FerramentaPermitida.RESUMO_VENDAS);
        assertThat(captor.getValue().argumentos()).isEqualTo(
                new ArgumentosPeriodo(LocalDate.parse("2026-08-01"), LocalDate.parse("2026-08-07")));
        verifyNoInteractions(gateway);
    }

    @Test void consultaDiretaDoMesPassadoUsaPeriodoCompleto() {
        when(executor.executar(any(), any())).thenReturn(new ResultadoFerramenta(
                FerramentaPermitida.RESUMO_GASTOS, StatusResultado.SUCESSO,
                Map.of("quantidadeLancamentos", 1L, "totalGastos", 50),
                LocalDate.parse("2026-07-01"), LocalDate.parse("2026-07-31"),
                Instant.parse("2026-08-06T12:00:00Z"), List.of(), QualidadeResultado.COMPLETO));
        service.conversar(request("Quais foram os gastos do mês passado?", null));
        ArgumentCaptor<ChamadaFerramenta> captor = ArgumentCaptor.forClass(ChamadaFerramenta.class);
        verify(executor).executar(captor.capture(), any());
        assertThat(captor.getValue().argumentos()).isEqualTo(
                new ArgumentosPeriodo(LocalDate.parse("2026-07-01"), LocalDate.parse("2026-07-31")));
        verifyNoInteractions(gateway);
    }

    @Test void reparaPlanoUmaUnicaVez() {
        when(gateway.gerarPlano(any())).thenThrow(new OrquestradorException(
                CodigoErroOrquestrador.PLANO_INVALIDO, HttpStatus.BAD_GATEWAY, "json"))
                .thenReturn(new RespostaModelo<>(planoEstoque(), metadata()));
        when(executor.executar(any(), any())).thenReturn(resultado(0));
        when(gateway.gerarRespostaFinal(any())).thenReturn(new RespostaModelo<>("Estoque em ordem", metadata()));
        service.conversar(request("Analise a situação do negócio", null));
        verify(gateway, times(2)).gerarPlano(any());
    }

    @Test void rejeitaOutraFerramentaSemExecutar() {
        var plano = new PlanoOrquestracao("1.0", IntencaoOrquestrador.CONSULTAR_VENDAS,
                List.of(new ChamadaFerramenta(FerramentaPermitida.RESUMO_VENDAS,
                        new ArgumentosSemFiltro())), ModoResposta.TEXTO_SIMPLES);
        when(gateway.gerarPlano(any())).thenReturn(new RespostaModelo<>(plano, metadata()));
        assertThatThrownBy(() -> service.conversar(request("Faça uma consulta especial", null)))
                .isInstanceOf(OrquestradorException.class);
        verifyNoInteractions(executor);
    }

    @Test void comparaVendasEGastosComDuasFerramentasECalculaNoBackend() {
        var periodo = new ArgumentosPeriodo(LocalDate.parse("2026-07-01"), LocalDate.parse("2026-07-31"));
        var plano = new PlanoOrquestracao("1.0", IntencaoOrquestrador.COMPARAR_VENDAS_GASTOS,
                List.of(
                        new ChamadaFerramenta(FerramentaPermitida.RESUMO_VENDAS, periodo),
                        new ChamadaFerramenta(FerramentaPermitida.RESUMO_GASTOS, periodo)),
                ModoResposta.ANALITICA);
        when(gateway.gerarPlano(any())).thenReturn(new RespostaModelo<>(plano, metadata()));
        when(executor.executar(argThat(c -> c != null && c.ferramenta() == FerramentaPermitida.RESUMO_VENDAS), any()))
                .thenReturn(resultadoFinanceiro(FerramentaPermitida.RESUMO_VENDAS,
                        Map.of("valorTotalValido", new BigDecimal("18000")), periodo));
        when(executor.executar(argThat(c -> c != null && c.ferramenta() == FerramentaPermitida.RESUMO_GASTOS), any()))
                .thenReturn(resultadoFinanceiro(FerramentaPermitida.RESUMO_GASTOS,
                        Map.of("totalGastos", new BigDecimal("11000")), periodo));
        when(gateway.gerarRespostaFinal(any())).thenThrow(new OrquestradorException(
                CodigoErroOrquestrador.TIMEOUT, HttpStatus.GATEWAY_TIMEOUT, "timeout"));

        var resposta = service.conversar(request(
                "Compare as vendas e os gastos do mês passado e explique o resultado.", null));

        assertThat(resposta.getResposta().replace('\u00A0', ' '))
                .contains("R$ 18.000,00", "R$ 11.000,00", "R$ 7.000,00")
                .contains("não representa necessariamente lucro líquido");
        assertThat(resposta.getDados()).isInstanceOf(DadosAssistenteDTO.ComparacaoVendasGastos.class);
        verify(executor, times(2)).executar(any(), any());
    }

    @Test void rejeitaDuasFerramentasComPeriodosDiferentesAntesDeExecutar() {
        var julho = new ArgumentosPeriodo(LocalDate.parse("2026-07-01"), LocalDate.parse("2026-07-31"));
        var junho = new ArgumentosPeriodo(LocalDate.parse("2026-06-01"), LocalDate.parse("2026-06-30"));
        var plano = new PlanoOrquestracao("1.0", IntencaoOrquestrador.COMPARAR_VENDAS_GASTOS,
                List.of(
                        new ChamadaFerramenta(FerramentaPermitida.RESUMO_VENDAS, julho),
                        new ChamadaFerramenta(FerramentaPermitida.RESUMO_GASTOS, junho)),
                ModoResposta.ANALITICA);
        when(gateway.gerarPlano(any())).thenReturn(new RespostaModelo<>(plano, metadata()));

        assertThatThrownBy(() -> service.conversar(request("Confronte os resultados comerciais e as saídas financeiras", null)))
                .isInstanceOfSatisfying(OrquestradorException.class,
                        error -> assertThat(error.getCodigo()).isEqualTo(CodigoErroOrquestrador.ARGUMENTOS_INVALIDOS));
        verifyNoInteractions(executor);
    }

    @Test void comparaVendasDoMesPassadoComMesAtualSemModeloParaPlanejar() {
        when(executor.executar(any(), any()))
                .thenReturn(resultadoFinanceiro(FerramentaPermitida.RESUMO_VENDAS,
                        Map.of("valorTotalValido", new BigDecimal("1000")),
                        new ArgumentosPeriodo(LocalDate.parse("2026-07-01"), LocalDate.parse("2026-07-06"))))
                .thenReturn(resultadoFinanceiro(FerramentaPermitida.RESUMO_VENDAS,
                        Map.of("valorTotalValido", new BigDecimal("1250")),
                        new ArgumentosPeriodo(LocalDate.parse("2026-08-01"), LocalDate.parse("2026-08-06"))));

        var resposta = service.conversar(request("Compare minhas vendas do mês passado com esse mês", null));

        assertThat(resposta.getResposta().replace('\u00A0', ' '))
                .contains("6 dias", "R$ 1.000,00", "R$ 1.250,00", "R$ 250,00");
        assertThat(resposta.getPeriodoInicio()).isEqualTo(LocalDate.parse("2026-07-01"));
        assertThat(resposta.getPeriodoFim()).isEqualTo(LocalDate.parse("2026-08-06"));
        verify(executor, times(2)).executar(any(), any());
        verifyNoInteractions(gateway);
    }

    private ConversaRequestDTO request(String texto, AcaoRapidaAssistente acao) {
        var request = new ConversaRequestDTO(); request.setMensagem(texto); request.setAcaoRapida(acao); return request;
    }
    private PlanoOrquestracao planoEstoque() {
        return new PlanoOrquestracao("1.0", IntencaoOrquestrador.CONSULTAR_ESTOQUE,
                List.of(new ChamadaFerramenta(FerramentaPermitida.RESUMO_ESTOQUE,
                        new ArgumentosSemFiltro())), ModoResposta.TEXTO_COM_DADOS);
    }
    private ResultadoFerramenta resultado(int quantidade) {
        return new ResultadoFerramenta(FerramentaPermitida.RESUMO_ESTOQUE, StatusResultado.SUCESSO,
                Map.of("criterio", "estoqueAtual <= estoqueMinimo", "itensCriticos", quantidade,
                        "itensAvaliados", 3, "itens", List.of()), null, null, Instant.parse("2026-08-06T12:00:00Z"),
                List.of(), QualidadeResultado.COMPLETO);
    }
    private ResultadoFerramenta resultadoFinanceiro(FerramentaPermitida ferramenta,
            Map<String, Object> dados, ArgumentosPeriodo periodo) {
        return new ResultadoFerramenta(ferramenta, StatusResultado.SUCESSO, dados,
                periodo.inicio(), periodo.fim(), Instant.parse("2026-08-06T12:00:00Z"),
                List.of(), QualidadeResultado.COMPLETO);
    }
    private MetadadosModelo metadata() { return new MetadadosModelo("m", "m", 1, 1, 2, 1, false); }
}
