package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.ai.contract.*;
import com.InovaSkill.CaderninhoDigital.ai.gateway.*;
import com.InovaSkill.CaderninhoDigital.ai.orchestration.ConsolidadorResultadosOrquestracao;
import com.InovaSkill.CaderninhoDigital.ai.orchestration.ExecutorPlanoOrquestracao;
import com.InovaSkill.CaderninhoDigital.ai.orchestration.PoliticaPlanoOrquestracao;
import com.InovaSkill.CaderninhoDigital.ai.orchestration.ResolvedorDeterministicoOrquestracao;
import com.InovaSkill.CaderninhoDigital.ai.orchestration.MapeadorDadosAssistente;
import com.InovaSkill.CaderninhoDigital.ai.orchestration.PoliticaRespostaAnalitica;
import com.InovaSkill.CaderninhoDigital.ai.orchestration.ResolvedorConsultaMercado;
import com.InovaSkill.CaderninhoDigital.ai.orchestration.PlanejadorConsultaIa;
import com.InovaSkill.CaderninhoDigital.ai.orchestration.ContextoPlanejamentoService;
import com.InovaSkill.CaderninhoDigital.ai.orchestration.ClassificadorRentabilidadeProduto;
import com.InovaSkill.CaderninhoDigital.ai.privacy.PoliticaDadosIa;
import com.InovaSkill.CaderninhoDigital.ai.observability.ControleOperacionalIa;
import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import com.InovaSkill.CaderninhoDigital.dto.request.ConversaRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ConversaResponseDTO;
import com.InovaSkill.CaderninhoDigital.exception.CodigoErroOrquestrador;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Instant;
import java.time.LocalDate;
import java.text.NumberFormat;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.UUID;
import com.InovaSkill.CaderninhoDigital.security.UsuarioPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class AssistenteOrquestradorService {
    private final AiOrchestratorProperties properties;
    private final ModeloGateway gateway;
    private final PoliticaPlanoOrquestracao politicaPlano;
    private final ResolvedorDeterministicoOrquestracao resolvedor;
    private final ExecutorPlanoOrquestracao executorPlano;
    private final ConsolidadorResultadosOrquestracao consolidador;
    private final MapeadorDadosAssistente mapeadorDados;
    private final PoliticaDadosIa politica;
    private final ObjectMapper mapper;
    private final ControleOperacionalIa controle;
    private final PoliticaRespostaAnalitica politicaResposta;
    private final ResolvedorConsultaMercado resolvedorMercado;
    private final PlanejadorConsultaIa planejador;
    private final ContextoPlanejamentoService contextoPlanejamento;
    private final ClassificadorRentabilidadeProduto classificadorRentabilidade;

    public AssistenteOrquestradorService(AiOrchestratorProperties properties, ModeloGateway gateway,
            PoliticaPlanoOrquestracao politicaPlano, ResolvedorDeterministicoOrquestracao resolvedor,
            ExecutorPlanoOrquestracao executorPlano, ConsolidadorResultadosOrquestracao consolidador,
            MapeadorDadosAssistente mapeadorDados, PoliticaDadosIa politica, ObjectMapper mapper,
            ControleOperacionalIa controle, PoliticaRespostaAnalitica politicaResposta,
            ResolvedorConsultaMercado resolvedorMercado, PlanejadorConsultaIa planejador,
            ContextoPlanejamentoService contextoPlanejamento,
            ClassificadorRentabilidadeProduto classificadorRentabilidade) {
        this.properties = properties; this.gateway = gateway; this.politicaPlano = politicaPlano;
        this.resolvedor = resolvedor; this.executorPlano = executorPlano; this.consolidador = consolidador;
        this.mapeadorDados = mapeadorDados;
        this.politica = politica; this.mapper = mapper; this.controle = controle;
        this.politicaResposta = politicaResposta;
        this.resolvedorMercado = resolvedorMercado;
        this.planejador = planejador;
        this.contextoPlanejamento = contextoPlanejamento;
        this.classificadorRentabilidade = classificadorRentabilidade;
    }

    public ConversaResponseDTO conversar(ConversaRequestDTO request) {
        if (!properties.getFeatures().isOrchestrator() || !properties.getFeatures().isTools()) {
            throw new OrquestradorException(CodigoErroOrquestrador.PROVEDOR_INDISPONIVEL,
                    HttpStatus.SERVICE_UNAVAILABLE, "Assistente temporariamente indisponível");
        }
        String correlacao = request.getCorrelacao() == null ? UUID.randomUUID().toString() : request.getCorrelacao();
        request.setCorrelacao(correlacao);
        Long usuarioId = usuarioId();
        Long empresaId = contextoPlanejamento.empresaId(usuarioId);
        var sessao = controle.iniciar(usuarioId, empresaId, correlacao);
        try {
            politica.validarEntradaChat(request.getMensagem());
            List<ResultadoFerramenta> resultados = null;
            ChamadaFerramenta chamadaDeterministica = request.getAcaoRapida() != null
                    ? resolvedor.acaoRapida(request.getAcaoRapida())
                    : resolvedorMercado.resolver(request.getMensagem(), empresaId);
            if (chamadaDeterministica == null && request.getAcaoRapida() == null)
                chamadaDeterministica = classificadorRentabilidade.classificar(request.getMensagem(), empresaId);
            if (chamadaDeterministica == null && request.getAcaoRapida() == null)
                chamadaDeterministica = resolvedor.consultaDireta(request.getMensagem());
            boolean caminhoRapido = chamadaDeterministica != null;
            boolean fallbackPlanejamento = false;
            if (caminhoRapido) {
                var chamada = chamadaDeterministica;
                sessao.intencao(politicaPlano.intencaoEsperada(chamada.ferramenta()).name());
                resultados = executarFerramentas(List.of(chamada), correlacao, sessao);
            } else {
                PlanoOrquestracao plano = null;
                try {
                    plano = planejador.planejar(request.getMensagem(), usuarioId, sessao);
                } catch (OrquestradorException falhaPlanejamento) {
                    org.slf4j.LoggerFactory.getLogger(AssistenteOrquestradorService.class).warn(
                            "evento=FALLBACK_UTILIZADO etapa=PLANEJAMENTO codigo={} requestId={}",
                            falhaPlanejamento.getCodigo(), correlacao);
                    ChamadaFerramenta mercado = resolvedorMercado.resolver(request.getMensagem(), empresaId);
                    PlanoOrquestracao comparacao = mercado == null ? resolvedor.comparacaoDireta(request.getMensagem()) : null;
                    List<ChamadaFerramenta> fallback = mercado != null ? List.of(mercado)
                            : comparacao != null ? comparacao.chamadas() : List.of();
                    if (fallback.isEmpty()) throw falhaPlanejamento;
                    fallbackPlanejamento = true; sessao.fallback();
                    sessao.intencao(mercado != null ? IntencaoOrquestrador.COMPARAR_PRECO_MERCADO.name()
                            : comparacao.intencao().name());
                    resultados = executarFerramentas(fallback, correlacao, sessao);
                }
                if (!fallbackPlanejamento) {
                    politicaPlano.validar(plano);
                    sessao.planoValidado(plano.chamadas().size());
                    sessao.intencao(plano.intencao().name());
                    resultados = executarFerramentas(plano.chamadas(), correlacao, sessao);
                }
            }
            if (resultados == null) {
                throw new OrquestradorException(CodigoErroOrquestrador.ERRO_INTERNO,
                        HttpStatus.INTERNAL_SERVER_ERROR, "Nenhum resultado foi produzido");
            }
            resultados.forEach(resultado -> sessao.ferramenta(resultado.ferramenta().name()));
            Map<String, Object> dados = consolidador.consolidar(resultados);
            boolean consultaAnalitica = resultados.size() > 1 || resultados.stream().anyMatch(r ->
                    r.ferramenta() == FerramentaPermitida.COMPARAR_PRECO_MERCADO
                    || r.ferramenta() == FerramentaPermitida.ANALISE_MARGEM_PRODUTO
                    || r.ferramenta() == FerramentaPermitida.ANALISAR_RENTABILIDADE_PRODUTO
                    || r.ferramenta() == FerramentaPermitida.ANALISE_COMPRAS_INSUMO
                    || r.ferramenta() == FerramentaPermitida.ANALISE_CUSTO_PRODUTO);
            boolean permiteRedacaoIa = resultados.stream().noneMatch(this::resultadoSemBaseParaRedacaoIa);
            String texto = !consultaAnalitica || !permiteRedacaoIa
                    ? respostaDeterministica(resultados, dados)
                    : gerarRespostaOuFallback(resultados, dados, sessao);
            sessao.concluir("SUCESSO", null);
            return resposta(texto, resultados, dados,
                    caminhoRapido ? "CAMINHO_RAPIDO" : fallbackPlanejamento ? "FALLBACK" : "ORQUESTRADOR",
                    correlacao);
        } catch (OrquestradorException exception) {
            sessao.concluir("ERRO", exception.getCodigo()); throw exception;
        } catch (RuntimeException exception) {
            sessao.concluir("ERRO", CodigoErroOrquestrador.ERRO_INTERNO); throw exception;
        }
    }

    private boolean resultadoSemBaseParaRedacaoIa(ResultadoFerramenta resultado) {
        if (resultado.qualidade() == QualidadeResultado.INSUFICIENTE) return true;
        return resultado.ferramenta() == FerramentaPermitida.COMPARAR_PRECO_MERCADO
                && "INSUFICIENTE".equals(String.valueOf(resultado.dadosAgregados().get("situacao")));
    }

    private String gerarRespostaOuFallback(List<ResultadoFerramenta> resultados, Map<String, Object> dados,
            ControleOperacionalIa.Sessao sessao) {
        try {
            String modo = dados.containsKey("comparacao") ? "comparativo"
                    : resultados.getFirst().ferramenta() == FerramentaPermitida.COMPARAR_PRECO_MERCADO
                            ? "recomendação controlada" : "informativo";
            boolean possuiAvisos = resultados.stream().anyMatch(r -> !r.avisos().isEmpty());
            boolean rentabilidade = resultados.stream().anyMatch(r ->
                    r.ferramenta() == FerramentaPermitida.ANALISAR_RENTABILIDADE_PRODUTO);
            JsonNode dadosModelo = rentabilidade ? dadosRentabilidadeParaModelo(dados) : dadosSegurosParaModelo(dados);
            String dadosJson = mapper.writeValueAsString(dadosModelo);
            String prompt = rentabilidade
                    ? "Você é o assistente empresarial do Caderninho Digital. Os dados foram calculados e validados "
                            + "pelo sistema e os valores já estão arredondados. Não recalcule, não altere valores e não "
                            + "invente dados ou números. Não use lista numerada. Comece dizendo explicitamente se há prejuízo "
                            + "considerando os custos cadastrados. Informe com R$ o custo conhecido por unidade, o preço médio "
                            + "real e a margem conhecida por unidade; informe também o percentual. Explique modalidades, mercado "
                            + "e principal atenção. Se houver cenário externo de custos indiretos calculado, explique-o separadamente "
                            + "como estimativa, com custo total e margem estimados, sem tratá-lo como dado real. Nunca chame margem "
                            + "conhecida de lucro líquido quando há custos não disponíveis. Se os custos foram estimados de forma agregada, "
                            + "diga que o rateio individual não foi determinado; não diga que energia, gás, mão de obra, transporte e perdas "
                            + "não foram estimados. Impostos permanecem sem estimativa quando falta o regime tributário. Termine lembrando que "
                            + "a margem conhecida não é lucro líquido e que o cenário externo é apenas indicativo. Seja objetivo."
                    : "Você é o assistente empresarial do Caderninho Digital. Público: gestores com pouca familiaridade "
                            + "com tecnologia. Modo " + modo + ". Explique em poucas frases, com linguagem simples. "
                            + "Use somente os fatos e cálculos fornecidos; não altere valores, não faça novos cálculos, não invente "
                            + "preço, frete, fornecedor, causa ou URL. Diferencie fato, cálculo do backend e interpretação. "
                            + "Nunca chame margem bruta conhecida ou diferença entre vendas e gastos de lucro líquido. "
                            + "Informe custos ausentes, fontes incompletas, pedido mínimo, cobertura de estoque e frete desconhecido. "
                            + "O campo materiaPrima contém o nome validado no cadastro: use exatamente esse insumo e nunca o troque "
                            + "por outro. Preserve URLs exatamente como recebidas. Destaque oportunidade, risco e um próximo passo prático.";
            var solicitacao = new SolicitacaoModelo(List.of(
                    new MensagemModelo(PapelMensagemModelo.SYSTEM, prompt),
                    new MensagemModelo(PapelMensagemModelo.USER, dadosJson)));
            politica.validarSolicitacaoModelo(solicitacao);
            sessao.antesModelo(); var resposta = gateway.gerarRespostaFinal(solicitacao); sessao.metadados(resposta.metadados(), "redacao");
            String protegido = politica.protegerRespostaTexto(resposta.conteudo());
            return politicaResposta.validar(protegido, dadosModelo, possuiAvisos);
        } catch (JsonProcessingException | RuntimeException exception) {
            org.slf4j.LoggerFactory.getLogger(AssistenteOrquestradorService.class).warn(
                    "evento=FALLBACK_UTILIZADO etapa=RESPOSTA_FINAL tipoErro={}",
                    exception.getClass().getSimpleName());
            sessao.fallback();
            return respostaDeterministica(resultados, dados);
        }
    }

    private JsonNode dadosRentabilidadeParaModelo(Map<String, Object> dados) {
        Map<String, Object> resumo = new LinkedHashMap<>();
        resumo.put("produto", dados.get("produto"));
        resumo.put("situacao", dados.get("situacao"));
        resumo.put("informacaoNecessaria", dados.get("informacaoNecessaria"));
        if (dados.get("custo") instanceof com.InovaSkill.CaderninhoDigital.ai.profit.AnaliseRentabilidadeProdutoService.Custo custo) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("custoConhecidoUnidade", arredondar(custo.custoConhecidoUnidade()));
            item.put("criterio", custo.criterio());
            item.put("custosConsiderados", custo.custosConsiderados());
            item.put("custosNaoDisponiveis", custo.custosNaoDisponiveis());
            resumo.put("custo", item);
        }
        if (dados.get("vendas") instanceof com.InovaSkill.CaderninhoDigital.ai.profit.AnaliseRentabilidadeProdutoService.Vendas vendas) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("precoCadastradoUnidade", arredondar(vendas.precoCadastradoUnidade()));
            item.put("precoMedioReal", arredondar(vendas.precoMedioReal()));
            item.put("menorPrecoReal", arredondar(vendas.menorPrecoReal()));
            item.put("maiorPrecoReal", arredondar(vendas.maiorPrecoReal()));
            item.put("quantidadeVendida", arredondar(vendas.quantidadeVendida()));
            item.put("receita", arredondar(vendas.receita()));
            resumo.put("vendas", item);
        }
        if (dados.get("modalidades") instanceof List<?> lista) {
            List<Map<String, Object>> modalidades = new ArrayList<>();
            for (Object valor : lista) {
                if (!(valor instanceof com.InovaSkill.CaderninhoDigital.ai.profit.AnaliseRentabilidadeProdutoService.Modalidade m)) continue;
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("tipo", m.tipo());
                item.put("unidadesPorModalidade", arredondar(m.unidadesPorModalidade()));
                item.put("preco", arredondar(m.preco()));
                item.put("precoEquivalenteUnidade", arredondar(m.precoEquivalenteUnidade()));
                item.put("margemConhecidaUnidade", arredondar(m.margemConhecidaUnidade()));
                item.put("margemPercentual", arredondar(m.margemPercentual()));
                modalidades.add(item);
            }
            resumo.put("modalidades", modalidades);
        }
        if (dados.get("principalComponenteCusto") instanceof com.InovaSkill.CaderninhoDigital.ai.profit.AnaliseRentabilidadeProdutoService.ComponenteCusto componente) {
            resumo.put("principalComponenteCusto", Map.of(
                    "nome", componente.nome(), "percentual", arredondar(componente.percentual())));
        }
        if (dados.get("mercado") instanceof com.InovaSkill.CaderninhoDigital.ai.profit.AnaliseRentabilidadeProdutoService.Mercado mercado) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("menorPrecoComparavel", arredondar(mercado.menorPrecoComparavel()));
            item.put("mediana", arredondar(mercado.mediana()));
            item.put("maiorPrecoComparavel", arredondar(mercado.maiorPrecoComparavel()));
            item.put("referenciasValidas", mercado.referenciasValidas());
            item.put("posicao", mercado.posicao());
            item.put("aviso", mercado.aviso());
            resumo.put("mercado", item);
        }
        if (dados.get("estimativaCustosIndiretos") instanceof com.InovaSkill.CaderninhoDigital.ai.profit.AnaliseRentabilidadeProdutoService.EstimativaCustosIndiretos estimativa) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("status", estimativa.status());
            item.put("criterio", estimativa.criterio());
            item.put("precoBaseUnidade", arredondar(estimativa.precoBaseUnidade()));
            item.put("custoIndiretoEstimadoUnidade", arredondar(estimativa.custoIndiretoEstimadoUnidade()));
            item.put("custoTotalEstimadoUnidade", arredondar(estimativa.custoTotalEstimadoUnidade()));
            item.put("margemEstimadaUnidade", arredondar(estimativa.margemEstimadaUnidade()));
            item.put("margemEstimadaPercentual", arredondar(estimativa.margemEstimadaPercentual()));
            item.put("custosNaoEstimados", estimativa.custosNaoEstimados());
            item.put("aviso", estimativa.aviso());
            List<Map<String, Object>> componentes = new ArrayList<>();
            for (var componente : estimativa.componentes()) {
                Map<String, Object> c = new LinkedHashMap<>();
                c.put("nome", componente.nome());
                c.put("medianaPercentual", arredondar(componente.medianaPercentual()));
                c.put("valorEstimadoUnidade", arredondar(componente.valorEstimadoUnidade()));
                c.put("referenciasValidas", componente.referenciasValidas());
                c.put("confianca", componente.confianca());
                componentes.add(c);
            }
            item.put("componentes", componentes);
            resumo.put("estimativaCustosIndiretos", item);
        }
        return mapper.valueToTree(resumo);
    }

    private BigDecimal arredondar(BigDecimal valor) {
        return valor == null ? null : valor.setScale(2, java.math.RoundingMode.HALF_UP);
    }

    JsonNode dadosSegurosParaModelo(Map<String, Object> dados) {
        JsonNode copia = mapper.valueToTree(dados);
        removerIdentificadoresInternos(copia);
        return copia;
    }

    private List<ResultadoFerramenta> executarFerramentas(List<ChamadaFerramenta> chamadas, String correlacao,
            ControleOperacionalIa.Sessao sessao) {
        long inicio = System.nanoTime();
        try { return executorPlano.executar(chamadas, correlacao); }
        finally { sessao.ferramentasConcluidas(System.nanoTime() - inicio); }
    }

    private void removerIdentificadoresInternos(JsonNode node) {
        if (node instanceof ObjectNode objeto) {
            List<String> remover = new ArrayList<>();
            objeto.fieldNames().forEachRemaining(nome -> {
                if (nome.toLowerCase(Locale.ROOT).endsWith("id")) remover.add(nome);
            });
            remover.forEach(objeto::remove);
            objeto.elements().forEachRemaining(this::removerIdentificadoresInternos);
        } else if (node.isArray()) {
            node.elements().forEachRemaining(this::removerIdentificadoresInternos);
        }
    }

    private String respostaDeterministica(List<ResultadoFerramenta> resultados, Map<String, Object> dados) {
        if (resultados.size() == 1) return respostaDeterministica(resultados.getFirst());
        if (dados.containsKey("resultados")) return respostaCompostaDeterministica(dados, resultados.size());
        Map<?, ?> comparacao = (Map<?, ?>) dados.get("comparacao");
        if (comparacao.containsKey("vendasPeriodoAnterior")) {
            String cobertura = Boolean.TRUE.equals(comparacao.get("coberturaEquivalente"))
                    ? "Foram comparados " + comparacao.get("diasPeriodoAtual") + " dias em cada período. "
                    : "Os períodos têm quantidades diferentes de dias. ";
            return cobertura + "No período anterior, as vendas totalizaram " + moeda(comparacao.get("vendasPeriodoAnterior"))
                    + ". No período atual, totalizaram " + moeda(comparacao.get("vendasPeriodoAtual"))
                    + ". A variação foi " + moeda(comparacao.get("diferenca")) + ".";
        }
        return "No período, as vendas totalizaram " + moeda(comparacao.get("vendas"))
                + " e os gastos " + moeda(comparacao.get("gastos"))
                + ". A diferença entre vendas e gastos foi " + moeda(comparacao.get("diferenca"))
                + ". Essa diferença não representa necessariamente lucro líquido.";
    }

    private String respostaCompostaDeterministica(Map<String, Object> dados, int quantidadeResultados) {
        if (dados.get("calculosBackend") instanceof List<?> calculos && !calculos.isEmpty()
                && calculos.getFirst() instanceof Map<?, ?> primeiro) {
            String texto = "Foram reunidos " + quantidadeResultados + " resultados. No período de "
                    + primeiro.get("periodoInicio") + " até " + primeiro.get("periodoFim")
                    + ", as vendas totalizaram " + moeda(primeiro.get("vendas"))
                    + " e os gastos " + moeda(primeiro.get("gastos"))
                    + ". A diferença foi " + moeda(primeiro.get("diferencaVendasMenosGastos")) + ".";
            if (calculos.size() > 1) texto += " A comparação com o outro período está nos dados apresentados.";
            return texto + " Essa diferença não representa lucro líquido.";
        }
        return "Foram reunidos " + quantidadeResultados
                + " resultados empresariais. Os fatos e cálculos disponíveis estão apresentados abaixo; "
                + "os avisos indicam os dados que não puderam ser confirmados.";
    }

    private String moeda(Object valor) {
        return NumberFormat.getCurrencyInstance(Locale.forLanguageTag("pt-BR")).format(decimal(valor));
    }

    private BigDecimal decimal(Object valor) {
        if (valor instanceof BigDecimal decimal) return decimal;
        if (valor instanceof Number numero) return new BigDecimal(numero.toString());
        throw new OrquestradorException(CodigoErroOrquestrador.ERRO_INTERNO,
                HttpStatus.INTERNAL_SERVER_ERROR, "Resultado financeiro inválido");
    }

    private String respostaDeterministica(ResultadoFerramenta resultado) {
        return switch (resultado.ferramenta()) {
            case RESUMO_ESTOQUE -> {
                int quantidade = ((Number) resultado.dadosAgregados().get("itensCriticos")).intValue();
                yield quantidade == 0 ? "Nenhum insumo está com estoque crítico no momento."
                        : quantidade + (quantidade == 1 ? " insumo está" : " insumos estão") + " com estoque crítico.";
            }
            case RESUMO_VENDAS -> "No período, foram " + resultado.dadosAgregados().get("quantidadeVendas")
                    + " vendas, totalizando R$ " + resultado.dadosAgregados().get("valorTotalValido") + ".";
            case RESUMO_GASTOS -> "No período, foram " + resultado.dadosAgregados().get("quantidadeLancamentos")
                    + " gastos gerais, totalizando R$ " + resultado.dadosAgregados().get("totalGastos") + ".";
            case RESUMO_RECEBIVEIS -> "No período, há R$ " + resultado.dadosAgregados().get("totalEmAberto")
                    + " em aberto, sendo R$ " + resultado.dadosAgregados().get("totalVencido") + " vencidos.";
            case ANALISE_CUSTO_PRODUTO -> "O custo unitário apurado pela ficha técnica é R$ "
                    + resultado.dadosAgregados().get("custoUnitarioFicha") + ". Consulte os avisos sobre as premissas.";
            case ANALISE_MARGEM_PRODUTO -> respostaMargem(resultado.dadosAgregados());
            case ANALISAR_RENTABILIDADE_PRODUTO -> respostaRentabilidade(resultado.dadosAgregados());
            case ANALISE_COMPRAS_INSUMO -> "Foram analisados " + resultado.dadosAgregados().get("insumosAnalisados")
                    + " insumos, com compras que totalizaram R$ " + resultado.dadosAgregados().get("valorTotal")
                    + ". Não é possível afirmar economia futura sem preço, frete ou desconto comparável.";
            case COMPARAR_PRECO_MERCADO -> respostaMercado(resultado.dadosAgregados(), resultado.avisos());
            default -> "Consulta concluída.";
        };
    }

    private String respostaMargem(Map<String, Object> dados) {
        Object margem = dados.get("margemBrutaConhecidaUnitaria");
        if (margem == null) return "Não há dados suficientes para calcular a margem conhecida deste produto. Consulte os avisos.";
        BigDecimal valor = decimal(margem);
        String situacao = valor.signum() < 0 ? "A margem bruta conhecida está negativa em "
                : "A margem bruta conhecida por unidade é ";
        return situacao + moeda(valor.abs())
                + ". Esse valor considera somente os custos cadastrados e não representa lucro líquido.";
    }

    private String respostaRentabilidade(Map<String, Object> dados) {
        Object faltante = dados.get("informacaoNecessaria");
        if (faltante != null && !String.valueOf(faltante).isBlank()) return String.valueOf(faltante);
        var custo = dados.get("custo") instanceof com.InovaSkill.CaderninhoDigital.ai.profit.AnaliseRentabilidadeProdutoService.Custo c
                ? c : null;
        @SuppressWarnings("unchecked")
        List<com.InovaSkill.CaderninhoDigital.ai.profit.AnaliseRentabilidadeProdutoService.Modalidade> modalidades =
                dados.get("modalidades") instanceof List<?> lista
                        ? (List<com.InovaSkill.CaderninhoDigital.ai.profit.AnaliseRentabilidadeProdutoService.Modalidade>) lista
                        : List.of();
        String produto = String.valueOf(dados.get("produto"));
        String situacao = String.valueOf(dados.get("situacao"));
        if (custo == null || custo.custoConhecidoUnidade() == null || modalidades.isEmpty())
            return "Ainda não há custo e preço suficientes para determinar a rentabilidade de " + produto + ".";
        StringBuilder texto = new StringBuilder();
        if ("MODALIDADES_DIVERGENTES".equals(situacao))
            texto.append("As modalidades de venda de ").append(produto)
                    .append(" têm margens diferentes considerando os custos cadastrados. ");
        else if ("MARGEM_CONHECIDA_NEGATIVA".equals(situacao))
            texto.append("Considerando os custos cadastrados, as vendas de ").append(produto)
                    .append(" estão com margem conhecida negativa. ");
        else texto.append("Considerando os custos cadastrados, as vendas de ").append(produto)
                    .append(" não estão no prejuízo. ");
        texto.append("O custo conhecido é ").append(moeda(custo.custoConhecidoUnidade())).append(" por unidade. ");
        for (var modalidade : modalidades) {
            if (modalidade.precoEquivalenteUnidade() == null || modalidade.margemConhecidaUnidade() == null) continue;
            texto.append("Na ").append(rotuloModalidade(modalidade.tipo())).append(", o preço médio equivalente é ")
                    .append(moeda(modalidade.precoEquivalenteUnidade())).append(" por unidade. A margem conhecida é ")
                    .append(moeda(modalidade.margemConhecidaUnidade())).append(" por unidade");
            if (modalidade.margemPercentual() != null)
                texto.append(", equivalente a ").append(modalidade.margemPercentual()).append("% do valor da venda");
            texto.append(". ");
        }
        if (dados.get("mercado") instanceof com.InovaSkill.CaderninhoDigital.ai.profit.AnaliseRentabilidadeProdutoService.Mercado mercado) {
            if (mercado.posicao() != com.InovaSkill.CaderninhoDigital.ai.profit.AnaliseRentabilidadeProdutoService.PosicaoMercado.DADOS_INSUFICIENTES)
                texto.append("Nas referências comparáveis, o preço está ")
                        .append(mercado.posicao().name().toLowerCase(Locale.ROOT).replace('_', ' ')).append(". ");
            else texto.append("Não foi possível concluir a comparação de mercado agora. ");
        }
        if (dados.get("principalComponenteCusto") instanceof com.InovaSkill.CaderninhoDigital.ai.profit.AnaliseRentabilidadeProdutoService.ComponenteCusto componente)
            texto.append("O componente que mais pesa no custo é ").append(componente.nome()).append(", com ")
                    .append(componente.percentual()).append("% do custo conhecido. ");
        if (!custo.custosNaoDisponiveis().isEmpty())
            texto.append("Esta é margem sobre custos conhecidos, não lucro líquido. ");
        if (dados.get("estimativaCustosIndiretos") instanceof com.InovaSkill.CaderninhoDigital.ai.profit.AnaliseRentabilidadeProdutoService.EstimativaCustosIndiretos estimativa) {
            if (estimativa.custoTotalEstimadoUnidade() != null && estimativa.margemEstimadaUnidade() != null) {
                texto.append("Como cenário externo indicativo, o custo total estimado é ")
                        .append(moeda(estimativa.custoTotalEstimadoUnidade())).append(" por unidade e a margem estimada é ")
                        .append(moeda(estimativa.margemEstimadaUnidade())).append(" por unidade. ");
            }
            if (!estimativa.custosNaoEstimados().isEmpty())
                texto.append("Não foi possível estimar com segurança: ")
                        .append(String.join(", ", estimativa.custosNaoEstimados())).append(". ");
            texto.append(estimativa.aviso());
        } else if (!custo.custosNaoDisponiveis().isEmpty()) {
            texto.append("Não estão disponíveis: ").append(String.join(", ", custo.custosNaoDisponiveis())).append('.');
        }
        return texto.toString();
    }

    private String rotuloModalidade(com.InovaSkill.CaderninhoDigital.enums.ModalidadeVenda modalidade) {
        return switch (modalidade) {
            case UNIDADE -> "venda por unidade";
            case CAIXA -> "venda em caixa";
            case PACOTE -> "venda em pacote";
            case DUZIA -> "venda por dúzia";
            case PESO -> "venda por peso";
            case POTE -> "venda em pote";
        };
    }

    private String respostaMercado(Map<String,Object> dados, List<String> avisos) {
        String situacao = String.valueOf(dados.get("situacao"));
        String materiaPrima = nomeMateriaPrima(dados.get("materiaPrima"));
        if ("INSUFICIENTE".equals(situacao)) {
            StringBuilder insuficiente = new StringBuilder("Não consegui determinar se você está pagando caro por ")
                    .append(materiaPrima).append(" em relação ao mercado, porque não encontrei oferta externa comparável suficiente.");
            if (dados.get("precoInternoUnitario") != null) {
                insuficiente.append(" Sua última compra foi de ").append(moeda(dados.get("precoInternoUnitario")))
                        .append(" por ").append(dados.get("unidade")).append('.');
            }
            BigDecimal media90 = mediaHistorica(dados.get("metricasHistoricas"), 90);
            if (media90 != null && dados.get("precoInternoUnitario") != null) {
                insuficiente.append(" A média ponderada dos últimos 90 dias foi ").append(moeda(media90))
                        .append(" por ").append(dados.get("unidade")).append("; a compra mais recente ")
                        .append(decimal(dados.get("precoInternoUnitario")).compareTo(media90) > 0
                                ? "ficou acima dessa média, o que merece atenção, mas não prova sozinho que o mercado está mais barato."
                                : "não ficou acima dessa média.");
            }
            if (avisos != null && !avisos.isEmpty()) insuficiente.append(' ').append(avisos.getFirst());
            return insuficiente.toString();
        }

        StringBuilder texto = new StringBuilder();
        if ("CUSTO_INTERNO_MENOR".equals(situacao)) {
            texto.append("Pelos preços que consegui validar, você não está pagando caro por ")
                    .append(materiaPrima).append(". ");
        } else if ("OFERTA_EXTERNA_MENOR".equals(situacao)) {
            texto.append("Você está pagando acima da melhor oferta de mercado que consegui validar para ")
                    .append(materiaPrima).append(". ");
        } else {
            texto.append("Seu preço de ").append(materiaPrima)
                    .append(" está próximo das ofertas de mercado que consegui validar. ");
        }

        texto.append("Seu preço atual é ").append(moeda(dados.get("precoInternoUnitario")))
                .append(" por ").append(dados.get("unidade")).append(". Para ")
                .append(numero(dados.get("quantidadeAlvo"))).append(' ').append(dados.get("unidade"))
                .append(", seu custo é ").append(moeda(dados.get("custoInternoComparavel"))).append(". ");

        {
            BigDecimal media90 = mediaHistorica(dados.get("metricasHistoricas"), 90);
            BigDecimal media6Meses = mediaHistorica(dados.get("metricasHistoricas"), 180);
            if (media90 != null) {
                texto.append("Sua média ponderada nos últimos 90 dias foi ").append(moeda(media90))
                        .append(" por ").append(dados.get("unidade")).append("; ")
                        .append(decimal(dados.get("precoInternoUnitario")).compareTo(decimal(media90)) > 0
                                ? "o preço da compra mais recente ficou um pouco acima dessa média. "
                                : "o preço da compra mais recente não ficou acima dessa média. ");
            } else if (media6Meses != null) {
                texto.append("A média ponderada disponível nos últimos seis meses foi ")
                        .append(moeda(media6Meses)).append(" por ").append(dados.get("unidade")).append(". ");
            }
        }

        if (dados.get("ofertas") instanceof List<?> ofertas && !ofertas.isEmpty()) {
            texto.append("\n\nOfertas atuais validadas:");
            int exibidas = 0;
            for (Object item : ofertas) {
                if (exibidas >= 3) continue;
                Object titulo; Object precoUnitario; Object pedidoMinimo; Object custoTotal;
                Object freteIncluido; Object compativel; Object mesesCobertura;
                if (item instanceof com.InovaSkill.CaderninhoDigital.ai.search.ComparacaoMercadoService.Oferta oferta) {
                    titulo = oferta.titulo(); precoUnitario = oferta.precoUnitario();
                    pedidoMinimo = oferta.pedidoMinimo(); custoTotal = oferta.custoTotal();
                    freteIncluido = oferta.freteIncluido(); compativel = oferta.compativelQuantidadeAlvo();
                    mesesCobertura = oferta.mesesCoberturaPedidoMinimo();
                } else if (item instanceof Map<?, ?> oferta) {
                    titulo = oferta.get("titulo"); precoUnitario = oferta.get("precoUnitario");
                    pedidoMinimo = oferta.get("pedidoMinimo"); custoTotal = oferta.get("custoTotal");
                    freteIncluido = oferta.get("freteIncluido"); compativel = oferta.get("compativelQuantidadeAlvo");
                    mesesCobertura = oferta.get("mesesCoberturaPedidoMinimo");
                } else continue;
                texto.append("\n\n- **").append(titulo).append(":** ")
                        .append(moeda(precoUnitario)).append(" por ")
                        .append(dados.get("unidade"));
                if (pedidoMinimo != null) {
                    texto.append(", pedido mínimo de ").append(numero(pedidoMinimo))
                            .append(' ').append(dados.get("unidade"));
                }
                texto.append(", total comparável de ").append(moeda(custoTotal)).append('.');
                if (!Boolean.TRUE.equals(freteIncluido)) {
                    texto.append(" O frete não foi informado.");
                }
                if (Boolean.FALSE.equals(compativel) && mesesCobertura != null) {
                    texto.append(" Esse mínimo representa cerca de ")
                            .append(numero(mesesCobertura))
                            .append(" mês(es) do seu consumo médio.");
                }
                exibidas++;
            }
        }

        texto.append("\n\n**Conclusão:** ");
        if ("CUSTO_INTERNO_MENOR".equals(situacao)) {
            texto.append("a melhor oferta externa custa ").append(moeda(dados.get("menorCustoExterno")))
                    .append(" para a quantidade comparada, ou ")
                    .append(moeda(dados.get("diferencaExternaMenosInterna")))
                    .append(" a mais que seu custo atual. Não há economia em trocar pelas ofertas encontradas agora.");
        } else if ("OFERTA_EXTERNA_MENOR".equals(situacao)) {
            texto.append("a melhor oferta custa ").append(moeda(dados.get("menorCustoExterno")))
                    .append(" para a quantidade comparada e indica uma economia potencial de ")
                    .append(moeda(dados.get("economiaEstimada"))).append(" para a quantidade comparada.");
        } else {
            texto.append("os valores são equivalentes para a quantidade comparada.");
        }
        return texto.append(" Confirme o frete, a validade da oferta e a qualidade do produto antes de decidir.")
                .toString();
    }

    private String nomeMateriaPrima(Object valor) {
        if (valor == null || valor.toString().isBlank()) return "este insumo";
        return valor.toString().trim();
    }

    private BigDecimal mediaHistorica(Object valor, int dias) {
        if (valor instanceof com.InovaSkill.CaderninhoDigital.ai.cost.HistoricoPrecosInsumoService.Resultado h) {
            var janela = dias == 90 ? h.ultimos90Dias() : h.ultimos6Meses();
            return janela == null ? null : janela.precoMedioPonderado();
        }
        if (valor instanceof Map<?, ?> h) {
            Object media = h.get(dias == 90 ? "media90Dias" : "media6Meses");
            return media == null ? null : decimal(media);
        }
        return null;
    }

    private String numero(Object valor) {
        BigDecimal decimal = decimal(valor).stripTrailingZeros();
        return NumberFormat.getNumberInstance(Locale.forLanguageTag("pt-BR")).format(decimal);
    }

    private ConversaResponseDTO resposta(String texto, List<ResultadoFerramenta> resultados,
            Map<String, Object> dados, String origem, String correlacao) {
        ResultadoFerramenta primeiro = resultados.getFirst();
        List<String> avisos = new ArrayList<>(resultados.stream()
                .flatMap(item -> item.avisos().stream()).distinct().toList());
        Object comparacao = dados.get("comparacao");
        if (comparacao instanceof Map<?, ?> valores
                && Boolean.FALSE.equals(valores.get("coberturaEquivalente"))) {
            avisos.add("Os períodos comparados possuem quantidades diferentes de dias.");
        }
        QualidadeResultado qualidade = resultados.stream().anyMatch(
                item -> item.qualidade() != QualidadeResultado.COMPLETO)
                ? QualidadeResultado.PARCIAL : QualidadeResultado.COMPLETO;
        return new ConversaResponseDTO(texto, AiOrchestratorProperties.CONTRACT_VERSION,
                StatusResultado.SUCESSO.name(), mapeadorDados.mapear(resultados, dados), List.of(), origem,
                avisos, qualidade.name(), correlacao,
                resultados.stream().map(ResultadoFerramenta::periodoInicio)
                        .filter(java.util.Objects::nonNull).min(LocalDate::compareTo).orElse(primeiro.periodoInicio()),
                resultados.stream().map(ResultadoFerramenta::periodoFim)
                        .filter(java.util.Objects::nonNull).max(LocalDate::compareTo).orElse(primeiro.periodoFim()),
                resultados.stream().map(ResultadoFerramenta::atualizadoEm).max(Instant::compareTo).orElse(primeiro.atualizadoEm()));
    }

    private Long usuarioId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof UsuarioPrincipal usuario) return usuario.id();
        throw new OrquestradorException(CodigoErroOrquestrador.NAO_AUTENTICADO,
                HttpStatus.UNAUTHORIZED, "Usuário autenticado não encontrado");
    }
}
