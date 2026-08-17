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
import com.InovaSkill.CaderninhoDigital.ai.orchestration.PlanejadorConsultaIa;
import com.InovaSkill.CaderninhoDigital.ai.orchestration.ContextoPlanejamentoService;
import com.InovaSkill.CaderninhoDigital.ai.orchestration.ClassificadorRentabilidadeProduto;
import com.InovaSkill.CaderninhoDigital.dto.response.DadosAssistenteDTO;
import org.springframework.security.core.context.SecurityContextHolder;

class AssistenteOrquestradorServiceTest {
    private final ModeloGateway gateway = mock(ModeloGateway.class);
    private final PlanoContratoValidator validator = mock(PlanoContratoValidator.class);
    private final ExecutorFerramentas executor = mock(ExecutorFerramentas.class);
    private final PoliticaDadosIa politica = mock(PoliticaDadosIa.class);
    private final ResolvedorConsultaMercado resolvedorMercado = mock(ResolvedorConsultaMercado.class);
    private final ClassificadorRentabilidadeProduto classificadorRentabilidade =
            mock(ClassificadorRentabilidadeProduto.class);
    private final AiOrchestratorProperties properties = new AiOrchestratorProperties();
    private AssistenteOrquestradorService service;

    @BeforeEach void setup() {
        when(politica.delimitarEntradaNaoConfiavel(anyString())).thenAnswer(i -> i.getArgument(0));
        when(politica.protegerRespostaTexto(anyString())).thenAnswer(i -> i.getArgument(0));
        when(validator.limiteFerramentasPorPlano()).thenReturn(5);
        when(validator.limitePesquisasMercado()).thenReturn(1);
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
        var contexto = mock(ContextoPlanejamentoService.class);
        when(contexto.empresaId(7L)).thenReturn(11L);
        when(contexto.carregar(7L)).thenReturn(new ContextoPlanejamentoService.Contexto(11L, List.of(), List.of()));
        var mapper = new ObjectMapper().findAndRegisterModules();
        var planejador = new PlanejadorConsultaIa(gateway, politica, properties, contexto, mapper, clock);
        service = new AssistenteOrquestradorService(properties, gateway, politicaPlano, resolvedor,
                executorPlano, new ConsolidadorResultadosOrquestracao(), new MapeadorDadosAssistente(), politica,
                mapper, controle, new PoliticaRespostaAnalitica(),
                resolvedorMercado, planejador, contexto, classificadorRentabilidade);
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

    @Test void timeoutDaFerramentaNaoETratadoComoFalhaDePlanejamentoNemRepeteExecucao() {
        when(gateway.gerarPlano(any())).thenReturn(new RespostaModelo<>(planoEstoque(), metadata()));
        when(executor.executar(any(), any())).thenThrow(new OrquestradorException(
                CodigoErroOrquestrador.TIMEOUT, HttpStatus.GATEWAY_TIMEOUT, "timeout da ferramenta"));

        assertThatThrownBy(() -> service.conversar(request("Analise a situação do estoque", null)))
                .isInstanceOfSatisfying(OrquestradorException.class,
                        erro -> assertThat(erro.getCodigo()).isEqualTo(CodigoErroOrquestrador.TIMEOUT));

        verify(executor, times(1)).executar(any(), any());
        verify(resolvedorMercado).resolver("Analise a situação do estoque", 11L);
    }

    @Test void openRouterIndisponivelUsaComparacaoDeterministicaQuandoAplicavel() {
        when(gateway.gerarPlano(any())).thenThrow(new OrquestradorException(
                CodigoErroOrquestrador.PROVEDOR_INDISPONIVEL, HttpStatus.SERVICE_UNAVAILABLE, "indisponível"));
        var periodo = new ArgumentosPeriodo(LocalDate.parse("2026-07-01"), LocalDate.parse("2026-07-31"));
        when(executor.executar(argThat(c -> c != null
                && c.ferramenta() == FerramentaPermitida.RESUMO_VENDAS), any()))
                .thenReturn(resultadoFinanceiro(FerramentaPermitida.RESUMO_VENDAS,
                        Map.of("valorTotalValido", new BigDecimal("1000")), periodo));
        when(executor.executar(argThat(c -> c != null
                && c.ferramenta() == FerramentaPermitida.RESUMO_GASTOS), any()))
                .thenReturn(resultadoFinanceiro(FerramentaPermitida.RESUMO_GASTOS,
                        Map.of("totalGastos", new BigDecimal("700")), periodo));

        var resposta = service.conversar(request(
                "Compare as vendas e os gastos do mês passado e explique o resultado.", null));

        assertThat(resposta.getOrigem()).isEqualTo("FALLBACK");
        assertThat(resposta.getResposta().replace('\u00A0', ' ')).contains("R$ 1.000,00", "R$ 700,00");
        verify(executor, times(2)).executar(any(), any());
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

    @Test void perguntaDePrejuizoUsaPlanoDeMargemEExplicitaCustoParcial() {
        var argumentos = new ArgumentosProdutoPeriodo(3L, LocalDate.parse("2026-07-01"),
                LocalDate.parse("2026-07-31"));
        var plano = new PlanoOrquestracao("1.0", IntencaoOrquestrador.ANALISAR_MARGEM_PRODUTO,
                List.of(new ChamadaFerramenta(FerramentaPermitida.ANALISE_MARGEM_PRODUTO, argumentos)),
                ModoResposta.ANALITICA);
        when(gateway.gerarPlano(any())).thenReturn(new RespostaModelo<>(plano, metadata()));
        when(gateway.gerarRespostaFinal(any())).thenThrow(new OrquestradorException(
                CodigoErroOrquestrador.TIMEOUT, HttpStatus.GATEWAY_TIMEOUT, "timeout"));
        when(executor.executar(any(), any())).thenReturn(new ResultadoFerramenta(
                FerramentaPermitida.ANALISE_MARGEM_PRODUTO, StatusResultado.SUCESSO,
                Map.ofEntries(
                        Map.entry("produtoId", 3L), Map.entry("produto", "Paçoca"),
                        Map.entry("quantidadeProduzida", new BigDecimal("100")),
                        Map.entry("custoProducaoConhecido", new BigDecimal("57")),
                        Map.entry("custoUnitarioConhecido", new BigDecimal("0.57")),
                        Map.entry("quantidadeVendida", new BigDecimal("100")),
                        Map.entry("receitaVendas", new BigDecimal("70")),
                        Map.entry("precoMedioVenda", new BigDecimal("0.70")),
                        Map.entry("margemBrutaConhecidaUnitaria", new BigDecimal("0.13")),
                        Map.entry("margemBrutaConhecidaTotal", new BigDecimal("13")),
                        Map.entry("situacao", "MARGEM_CONHECIDA_POSITIVA"),
                        Map.entry("componentes", List.of()),
                        Map.entry("custosNaoModelados", List.of("energia", "mão de obra", "impostos"))),
                argumentos.inicio(), argumentos.fim(), Instant.parse("2026-08-06T12:00:00Z"),
                List.of("A margem é bruta e considera somente os custos cadastrados."), QualidadeResultado.PARCIAL));

        var resposta = service.conversar(request("Estou vendendo paçoca com prejuízo?", null));

        assertThat(resposta.getResposta().replace('\u00A0', ' '))
                .contains("R$ 0,13", "custos cadastrados", "não representa lucro líquido");
        assertThat(resposta.getDados()).isInstanceOf(DadosAssistenteDTO.MargemProduto.class);
        verify(gateway).gerarPlano(any());
        verify(executor, times(1)).executar(any(), any());
    }

    @Test void fastPathDeRentabilidadeNaoPlanejaEFallbackFinalRespondeDiagnostico() {
        var argumentos = new ArgumentosRentabilidadeProduto(3L, LocalDate.parse("2026-07-08"),
                LocalDate.parse("2026-08-06"), null, null);
        when(classificadorRentabilidade.classificar("Estou vendendo paçoca no prejuízo?", 11L))
                .thenReturn(new ChamadaFerramenta(FerramentaPermitida.ANALISAR_RENTABILIDADE_PRODUTO, argumentos));
        var custo = new com.InovaSkill.CaderninhoDigital.ai.profit.AnaliseRentabilidadeProdutoService.Custo(
                new BigDecimal("2.10"), new BigDecimal("210"), new BigDecimal("100"),
                "MEDIA_PONDERADA_PRODUCOES_PERIODO", List.of("Amendoim", "Embalagem"),
                List.of("energia", "mão de obra"), List.of());
        var modalidade = new com.InovaSkill.CaderninhoDigital.ai.profit.AnaliseRentabilidadeProdutoService.Modalidade(
                com.InovaSkill.CaderninhoDigital.enums.ModalidadeVenda.UNIDADE, BigDecimal.ONE,
                new BigDecimal("4.20"), new BigDecimal("4.20"), new BigDecimal("2.10"),
                new BigDecimal("50"), new BigDecimal("10"), new BigDecimal("42"), "VENDAS_REAIS");
        var mercado = new com.InovaSkill.CaderninhoDigital.ai.profit.AnaliseRentabilidadeProdutoService.Mercado(
                null, null, null, 0,
                com.InovaSkill.CaderninhoDigital.ai.profit.AnaliseRentabilidadeProdutoService.PosicaoMercado.DADOS_INSUFICIENTES,
                null, List.of(), "Tavily indisponível");
        var estimativa = new com.InovaSkill.CaderninhoDigital.ai.profit.AnaliseRentabilidadeProdutoService.EstimativaCustosIndiretos(
                "PARCIAL", "MEDIANA_REFERENCIAS_EXTERNAS", new BigDecimal("4.20"),
                new BigDecimal("0.34"), new BigDecimal("2.44"), new BigDecimal("1.76"),
                new BigDecimal("41.90"), List.of(),
                List.of("impostos: depende do regime tributário e da faixa de faturamento da empresa"),
                "Cenário externo indicativo; não substitui custos cadastrados nem apuração contábil.");
        when(executor.executar(any(), any())).thenReturn(new ResultadoFerramenta(
                FerramentaPermitida.ANALISAR_RENTABILIDADE_PRODUTO, StatusResultado.SUCESSO,
                Map.ofEntries(Map.entry("produtoId", 3L), Map.entry("produto", "Paçoca"),
                        Map.entry("periodoInicio", argumentos.inicio()), Map.entry("periodoFim", argumentos.fim()),
                        Map.entry("custo", custo), Map.entry("vendas", Map.of()),
                        Map.entry("modalidades", List.of(modalidade)), Map.entry("mercado", mercado),
                        Map.entry("estimativaCustosIndiretos", estimativa),
                        Map.entry("situacao", "MARGEM_CONHECIDA_POSITIVA")),
                argumentos.inicio(), argumentos.fim(), Instant.parse("2026-08-06T12:00:00Z"),
                List.of("Não é lucro líquido"), QualidadeResultado.PARCIAL));
        when(gateway.gerarRespostaFinal(any())).thenThrow(new OrquestradorException(
                CodigoErroOrquestrador.PROVEDOR_INDISPONIVEL, HttpStatus.SERVICE_UNAVAILABLE, "indisponível"));

        var resposta = service.conversar(request("Estou vendendo paçoca no prejuízo?", null));

        assertThat(resposta.getOrigem()).isEqualTo("CAMINHO_RAPIDO");
        assertThat(resposta.getResposta().replace('\u00A0', ' '))
                .startsWith("Considerando os custos cadastrados, as vendas de Paçoca não estão no prejuízo")
                .contains("R$ 2,10", "margem conhecida", "venda por unidade", "não lucro líquido",
                        "custo total estimado", "R$ 2,44", "R$ 1,76", "regime tributário");
        verify(gateway, never()).gerarPlano(any());
        verify(gateway, times(1)).gerarRespostaFinal(any());
    }

    @Test void perguntaDePrecoUsaPlanejamentoIaEEntregaComparacaoEstruturada() {
        var argumentos = new ArgumentosComparacaoMercado(7L, LocalDate.parse("2026-05-09"),
                LocalDate.parse("2026-08-06"), "kg", new BigDecimal("10"), "Marília", "SP");
        var plano = new PlanoOrquestracao("1.0", IntencaoOrquestrador.COMPARAR_PRECO_MERCADO,
                List.of(new ChamadaFerramenta(FerramentaPermitida.COMPARAR_PRECO_MERCADO, argumentos)),
                ModoResposta.ANALITICA);
        when(gateway.gerarPlano(any())).thenReturn(new RespostaModelo<>(plano, metadata()));
        when(gateway.gerarRespostaFinal(any())).thenThrow(new OrquestradorException(
                CodigoErroOrquestrador.TIMEOUT, HttpStatus.GATEWAY_TIMEOUT, "timeout"));
        when(executor.executar(any(), any())).thenReturn(new ResultadoFerramenta(
                FerramentaPermitida.COMPARAR_PRECO_MERCADO, StatusResultado.SUCESSO,
                Map.ofEntries(
                        Map.entry("materiaPrimaId", 7L), Map.entry("unidade", "kg"),
                        Map.entry("quantidadeAlvo", new BigDecimal("10")),
                        Map.entry("precoInternoUnitario", new BigDecimal("5.90")),
                        Map.entry("custoInternoComparavel", new BigDecimal("59")),
                        Map.entry("menorCustoExterno", new BigDecimal("54")),
                        Map.entry("economiaEstimada", new BigDecimal("5")),
                        Map.entry("diferencaExternaMenosInterna", new BigDecimal("-5")),
                        Map.entry("percentualDiferenca", new BigDecimal("8.47")),
                        Map.entry("situacao", "OFERTA_EXTERNA_MENOR"),
                        Map.entry("pesquisadoEm", Instant.parse("2026-08-06T12:00:00Z")),
                        Map.entry("fontes", List.of()), Map.entry("ofertas", List.of())),
                argumentos.inicio(), argumentos.fim(), Instant.parse("2026-08-06T12:00:00Z"),
                List.of("Confirme o frete."), QualidadeResultado.PARCIAL));

        var resposta = service.conversar(request("Estou pagando caro por 10 kg de açúcar demerara?", null));

        assertThat(resposta.getDados()).isInstanceOf(DadosAssistenteDTO.ComparacaoMercado.class);
        assertThat(resposta.getResposta().replace('\u00A0', ' ')).contains("R$ 59,00", "R$ 54,00", "R$ 5,00");
        verify(gateway).gerarPlano(any());
        verify(executor, times(1)).executar(any(), any());
    }

    @Test void extracaoDeMercadoInsuficienteNaoFazNovaChamadaPagaParaRedacao() {
        var argumentos = new ArgumentosComparacaoMercado(7L, LocalDate.parse("2026-05-09"),
                LocalDate.parse("2026-08-06"), "kg", new BigDecimal("10"), "Marília", "SP");
        when(gateway.gerarPlano(any())).thenReturn(new RespostaModelo<>(new PlanoOrquestracao(
                "1.0", IntencaoOrquestrador.COMPARAR_PRECO_MERCADO,
                List.of(new ChamadaFerramenta(FerramentaPermitida.COMPARAR_PRECO_MERCADO, argumentos)),
                ModoResposta.ANALITICA), metadata()));
        when(executor.executar(any(), any())).thenReturn(new ResultadoFerramenta(
                FerramentaPermitida.COMPARAR_PRECO_MERCADO, StatusResultado.SUCESSO,
                Map.ofEntries(
                        Map.entry("materiaPrimaId", 7L), Map.entry("unidade", "kg"),
                        Map.entry("quantidadeAlvo", new BigDecimal("10")),
                        Map.entry("precoInternoUnitario", new BigDecimal("5.90")),
                        Map.entry("custoInternoComparavel", new BigDecimal("59")),
                        Map.entry("situacao", "INSUFICIENTE"),
                        Map.entry("pesquisadoEm", Instant.parse("2026-08-06T12:00:00Z")),
                        Map.entry("fontes", List.of()), Map.entry("ofertas", List.of())),
                argumentos.inicio(), argumentos.fim(), Instant.parse("2026-08-06T12:00:00Z"),
                List.of("O OpenRouter não conseguiu validar os preços."), QualidadeResultado.PARCIAL));

        var resposta = service.conversar(request("Estou pagando caro por 10 kg de açúcar demerara?", null));

        assertThat(resposta.getResposta()).contains("OpenRouter", "não conseguiu validar os preços");
        verify(gateway).gerarPlano(any());
        verify(gateway, never()).gerarRespostaFinal(any());
        verify(executor, times(1)).executar(any(), any());
    }

    @Test void fallbackDeMercadoUsaNomeDoInsumoValidadoSemTextoFixoDeOutroProduto() {
        var argumentos = new ArgumentosComparacaoMercado(12L, LocalDate.parse("2026-05-19"),
                LocalDate.parse("2026-08-16"), "L", BigDecimal.ONE, "Marília", "SP");
        when(gateway.gerarPlano(any())).thenReturn(new RespostaModelo<>(new PlanoOrquestracao(
                "1.0", IntencaoOrquestrador.COMPARAR_PRECO_MERCADO,
                List.of(new ChamadaFerramenta(FerramentaPermitida.COMPARAR_PRECO_MERCADO, argumentos)),
                ModoResposta.ANALITICA), metadata()));
        when(gateway.gerarRespostaFinal(any())).thenThrow(new OrquestradorException(
                CodigoErroOrquestrador.TIMEOUT, HttpStatus.GATEWAY_TIMEOUT, "timeout"));
        when(executor.executar(any(), any())).thenReturn(new ResultadoFerramenta(
                FerramentaPermitida.COMPARAR_PRECO_MERCADO, StatusResultado.SUCESSO,
                Map.ofEntries(
                        Map.entry("materiaPrimaId", 12L), Map.entry("materiaPrima", "Leite integral"),
                        Map.entry("unidade", "L"), Map.entry("quantidadeAlvo", BigDecimal.ONE),
                        Map.entry("precoInternoUnitario", new BigDecimal("5.20")),
                        Map.entry("custoInternoComparavel", new BigDecimal("5.20")),
                        Map.entry("menorCustoExterno", new BigDecimal("6.48")),
                        Map.entry("economiaEstimada", BigDecimal.ZERO),
                        Map.entry("diferencaExternaMenosInterna", new BigDecimal("1.28")),
                        Map.entry("percentualDiferenca", new BigDecimal("24.62")),
                        Map.entry("situacao", "CUSTO_INTERNO_MENOR"),
                        Map.entry("pesquisadoEm", Instant.parse("2026-08-16T23:17:00Z")),
                        Map.entry("fontes", List.of()), Map.entry("ofertas", List.of())),
                argumentos.inicio(), argumentos.fim(), Instant.parse("2026-08-16T23:17:00Z"),
                List.of("Confirme o frete."), QualidadeResultado.PARCIAL));

        var resposta = service.conversar(request("Estou pagando caro no leite?", null));

        assertThat(resposta.getResposta()).contains("não está pagando caro por Leite integral")
                .doesNotContain("açúcar", "Açúcar");
        assertThat((DadosAssistenteDTO.ComparacaoMercado) resposta.getDados())
                .extracting(DadosAssistenteDTO.ComparacaoMercado::materiaPrima)
                .isEqualTo("Leite integral");
    }

    @Test void consultaDePrecoDeInsumoResolvidaNaoChamaPlanejamento() {
        var argumentos = new ArgumentosComparacaoMercado(5L, LocalDate.parse("2026-05-19"),
                LocalDate.parse("2026-08-16"), "L", null, "Marília", "SP");
        when(resolvedorMercado.resolver("Estou pagando caro no leite?", 11L)).thenReturn(
                new ChamadaFerramenta(FerramentaPermitida.COMPARAR_PRECO_MERCADO, argumentos));
        when(executor.executar(any(), any())).thenReturn(new ResultadoFerramenta(
                FerramentaPermitida.COMPARAR_PRECO_MERCADO, StatusResultado.SUCESSO,
                Map.ofEntries(Map.entry("materiaPrimaId", 5L), Map.entry("materiaPrima", "Leite integral"),
                        Map.entry("unidade", "L"), Map.entry("quantidadeAlvo", BigDecimal.ONE),
                        Map.entry("precoInternoUnitario", new BigDecimal("5.20")),
                        Map.entry("custoInternoComparavel", new BigDecimal("5.20")),
                        Map.entry("situacao", "INSUFICIENTE"),
                        Map.entry("pesquisadoEm", Instant.parse("2026-08-16T23:17:00Z")),
                        Map.entry("fontes", List.of()), Map.entry("ofertas", List.of())),
                argumentos.inicio(), argumentos.fim(), Instant.parse("2026-08-16T23:17:00Z"),
                List.of("Não encontrei oferta externa comparável."), QualidadeResultado.PARCIAL));

        var resposta = service.conversar(request("Estou pagando caro no leite?", null));

        assertThat(resposta.getOrigem()).isEqualTo("CAMINHO_RAPIDO");
        assertThat(resposta.getResposta().replace('\u00A0', ' ')).contains("Leite integral", "R$ 5,20");
        verify(gateway, never()).gerarPlano(any());
        verify(classificadorRentabilidade, never()).classificar(anyString(), anyLong());
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

    @Test void comparaVendasDoMesPassadoComMesAtualComPlanoEstruturado() {
        when(gateway.gerarPlano(any())).thenReturn(new RespostaModelo<>(
                new PlanoOrquestracao("1.0", IntencaoOrquestrador.COMPARAR_VENDAS_PERIODOS,
                        List.of(
                                new ChamadaFerramenta(FerramentaPermitida.RESUMO_VENDAS,
                                        new ArgumentosPeriodo(LocalDate.parse("2026-07-01"), LocalDate.parse("2026-07-06"))),
                                new ChamadaFerramenta(FerramentaPermitida.RESUMO_VENDAS,
                                        new ArgumentosPeriodo(LocalDate.parse("2026-08-01"), LocalDate.parse("2026-08-06")))),
                        ModoResposta.ANALITICA), metadata()));
        when(gateway.gerarRespostaFinal(any())).thenThrow(new OrquestradorException(
                CodigoErroOrquestrador.TIMEOUT, HttpStatus.GATEWAY_TIMEOUT, "timeout"));
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
        verify(gateway).gerarPlano(any());
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
