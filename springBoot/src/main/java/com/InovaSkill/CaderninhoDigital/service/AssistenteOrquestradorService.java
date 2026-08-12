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

    public AssistenteOrquestradorService(AiOrchestratorProperties properties, ModeloGateway gateway,
            PoliticaPlanoOrquestracao politicaPlano, ResolvedorDeterministicoOrquestracao resolvedor,
            ExecutorPlanoOrquestracao executorPlano, ConsolidadorResultadosOrquestracao consolidador,
            MapeadorDadosAssistente mapeadorDados, PoliticaDadosIa politica, ObjectMapper mapper,
            ControleOperacionalIa controle, PoliticaRespostaAnalitica politicaResposta,
            ResolvedorConsultaMercado resolvedorMercado) {
        this.properties = properties; this.gateway = gateway; this.politicaPlano = politicaPlano;
        this.resolvedor = resolvedor; this.executorPlano = executorPlano; this.consolidador = consolidador;
        this.mapeadorDados = mapeadorDados;
        this.politica = politica; this.mapper = mapper; this.controle = controle;
        this.politicaResposta = politicaResposta;
        this.resolvedorMercado = resolvedorMercado;
    }

    public ConversaResponseDTO conversar(ConversaRequestDTO request) {
        if (!properties.getFeatures().isOrchestrator() || !properties.getFeatures().isTools()) {
            throw new OrquestradorException(CodigoErroOrquestrador.PROVEDOR_INDISPONIVEL,
                    HttpStatus.SERVICE_UNAVAILABLE, "Assistente temporariamente indisponível");
        }
        String correlacao = request.getCorrelacao() == null ? UUID.randomUUID().toString() : request.getCorrelacao();
        request.setCorrelacao(correlacao);
        var sessao = controle.iniciar(usuarioId(), correlacao);
        try {
            politica.validarEntradaChat(request.getMensagem());
            List<ResultadoFerramenta> resultados;
            ChamadaFerramenta mercadoDireto = request.getAcaoRapida() == null
                    ? resolvedorMercado.resolver(request.getMensagem()) : null;
            PlanoOrquestracao planoDeterministico = request.getAcaoRapida() == null && mercadoDireto == null
                    ? resolvedor.comparacaoDireta(request.getMensagem()) : null;
            boolean comparacaoDireta = planoDeterministico != null;
            ChamadaFerramenta chamadaDeterministica = mercadoDireto != null ? mercadoDireto : planoDeterministico == null
                    ? request.getAcaoRapida() != null
                            ? resolvedor.acaoRapida(request.getAcaoRapida())
                            : resolvedor.consultaDireta(request.getMensagem())
                    : null;
            boolean caminhoRapido = chamadaDeterministica != null;
            if (caminhoRapido) {
                var chamada = chamadaDeterministica;
                sessao.intencao(politicaPlano.intencaoEsperada(chamada.ferramenta()).name());
                resultados = executarFerramentas(List.of(chamada), correlacao, sessao);
            } else {
                PlanoOrquestracao plano = planoDeterministico != null
                        ? planoDeterministico : planejar(request.getMensagem(), sessao);
                politicaPlano.validar(plano); sessao.intencao(plano.intencao().name());
                resultados = executarFerramentas(plano.chamadas(), correlacao, sessao);
            }
            resultados.forEach(resultado -> sessao.ferramenta(resultado.ferramenta().name()));
            Map<String, Object> dados = consolidador.consolidar(resultados);
            boolean mercadoComRedacaoIa = resultados.size() == 1
                    && resultados.getFirst().ferramenta() == FerramentaPermitida.COMPARAR_PRECO_MERCADO
                    && !"INSUFICIENTE".equals(String.valueOf(
                            resultados.getFirst().dadosAgregados().get("situacao")));
            String texto = caminhoRapido && !mercadoComRedacaoIa ? respostaDeterministica(resultados.getFirst())
                    : comparacaoDireta ? respostaDeterministica(resultados, dados)
                    : gerarRespostaOuFallback(resultados, dados, sessao);
            sessao.concluir("SUCESSO", null);
            return resposta(texto, resultados, dados,
                    caminhoRapido && !mercadoComRedacaoIa ? "CAMINHO_RAPIDO" : "ORQUESTRADOR", correlacao);
        } catch (OrquestradorException exception) {
            sessao.concluir("ERRO", exception.getCodigo()); throw exception;
        } catch (RuntimeException exception) {
            sessao.concluir("ERRO", CodigoErroOrquestrador.ERRO_INTERNO); throw exception;
        }
    }

    private PlanoOrquestracao planejar(String mensagem, ControleOperacionalIa.Sessao sessao) {
        var solicitacao = solicitacaoPlano(mensagem, false);
        try {
            sessao.antesModelo(); var resposta = gateway.gerarPlano(solicitacao); sessao.metadados(resposta.metadados(), "planejamento");
            return resposta.conteudo();
        } catch (OrquestradorException primeiraFalha) {
            if (primeiraFalha.getCodigo() != CodigoErroOrquestrador.PLANO_INVALIDO
                    || properties.getLimits().getPlanRepairs() < 1) throw primeiraFalha;
            sessao.antesModelo(); var resposta = gateway.gerarPlano(solicitacaoPlano(mensagem, true));
            sessao.metadados(resposta.metadados(), "planejamento"); return resposta.conteudo();
        }
    }

    private SolicitacaoModelo solicitacaoPlano(String mensagem, boolean reparo) {
        String sistema = "Planejador " + properties.getPromptVersion()
                + ". Use somente: CONSULTAR_ESTOQUE/RESUMO_ESTOQUE com argumentos {tipo:'SEM_FILTRO'}; "
                + "CONSULTAR_VENDAS/RESUMO_VENDAS, CONSULTAR_GASTOS/RESUMO_GASTOS ou "
                + "CONSULTAR_RECEBIVEIS/RESUMO_RECEBIVEIS com argumentos {tipo:'PERIODO',inicio,fim} em ISO-8601"
                + "; ANALISAR_CUSTO_PRODUTO/ANALISE_CUSTO_PRODUTO com {tipo:'PRODUTO',produtoId}; "
                + "ANALISAR_COMPRAS_INSUMO/ANALISE_COMPRAS_INSUMO com "
                + "{tipo:'COMPRA_INSUMO',materiaPrimaId opcional,inicio,fim}"
                + (properties.getFeatures().isSearch()
                        ? "; COMPARAR_PRECO_MERCADO com {tipo:'COMPARACAO_MERCADO',materiaPrimaId,inicio,fim,unidade,quantidadeAlvo,cidade,uf}. "
                                + "Quando a localização não for informada, use cidade:'"
                                + properties.getSearch().getDefaultCity() + "' e uf:'"
                                + properties.getSearch().getDefaultState() + "'"
                        : "")
                + ". Use uma ou no máximo duas chamadas. Duas chamadas são permitidas somente para "
                + "COMPARAR_VENDAS_GASTOS, usando RESUMO_VENDAS e RESUMO_GASTOS com o mesmo período. "
                + "Para comparar vendas entre períodos use COMPARAR_VENDAS_PERIODOS com duas chamadas "
                + "RESUMO_VENDAS e períodos diferentes. "
                + "Para comparação use modoResposta ANALITICA. schemaVersion " + properties.getSchemaVersion()
                + ". Nunca gere SQL, URL, endpoint, classe ou campos extras. Devolva somente JSON."
                + (reparo ? " Repare o JSON e devolva somente o contrato válido." : "");
        var solicitacao = new SolicitacaoModelo(List.of(
                new MensagemModelo(PapelMensagemModelo.SYSTEM, sistema),
                new MensagemModelo(PapelMensagemModelo.USER, politica.delimitarEntradaNaoConfiavel(mensagem))));
        politica.validarSolicitacaoModelo(solicitacao);
        return solicitacao;
    }

    private String gerarRespostaOuFallback(List<ResultadoFerramenta> resultados, Map<String, Object> dados,
            ControleOperacionalIa.Sessao sessao) {
        try {
            String dadosJson = mapper.writeValueAsString(dadosSegurosParaModelo(dados));
            String modo = dados.containsKey("comparacao") ? "comparativo"
                    : resultados.getFirst().ferramenta() == FerramentaPermitida.COMPARAR_PRECO_MERCADO
                            ? "recomendação controlada" : "informativo";
            boolean possuiAvisos = resultados.stream().anyMatch(r -> !r.avisos().isEmpty());
            var solicitacao = new SolicitacaoModelo(List.of(
                    new MensagemModelo(PapelMensagemModelo.SYSTEM,
                            "Modo " + modo + ". Separe fatos, interpretação, oportunidade, riscos e próximo passo "
                            + "quando forem aplicáveis. Explique de forma simples somente os dados fornecidos, sem acrescentar números. "
                            + "Uma diferença positiva entre vendas e gastos não deve ser chamada de lucro. "
                            + "Não oculte diferenças de cobertura, qualidade ou avisos. Sugira somente revisar frequência, "
                            + "confirmar frete, confirmar pedido mínimo ou consultar duas áreas por vez."),
                    new MensagemModelo(PapelMensagemModelo.USER, dadosJson)));
            politica.validarSolicitacaoModelo(solicitacao);
            sessao.antesModelo(); var resposta = gateway.gerarRespostaFinal(solicitacao); sessao.metadados(resposta.metadados(), "redacao");
            String protegido = politica.protegerRespostaTexto(resposta.conteudo());
            return politicaResposta.validar(protegido, dadosSegurosParaModelo(dados), possuiAvisos);
        } catch (OrquestradorException | JsonProcessingException exception) {
            sessao.fallback();
            return respostaDeterministica(resultados, dados);
        }
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
            case ANALISE_COMPRAS_INSUMO -> "Foram analisados " + resultado.dadosAgregados().get("insumosAnalisados")
                    + " insumos, com compras que totalizaram R$ " + resultado.dadosAgregados().get("valorTotal")
                    + ". Não é possível afirmar economia futura sem preço, frete ou desconto comparável.";
            case COMPARAR_PRECO_MERCADO -> "INSUFICIENTE".equals(
                    String.valueOf(resultado.dadosAgregados().get("situacao")))
                    && !resultado.avisos().isEmpty() ? resultado.avisos().getFirst()
                    : respostaMercado(resultado.dadosAgregados());
            default -> "Consulta concluída.";
        };
    }

    private String respostaMercado(Map<String,Object> dados) {
        String situacao=String.valueOf(dados.get("situacao"));
        if("INSUFICIENTE".equals(situacao)) return "A análise interna foi concluída, mas não há oferta externa comparável suficiente. Consulte os avisos.";
        String base="Para "+dados.get("quantidadeAlvo")+" "+dados.get("unidade")+", seu custo atual é "
                +moeda(dados.get("custoInternoComparavel"))+" e a melhor oferta externa encontrada custa "
                +moeda(dados.get("menorCustoExterno"))+". ";
        if("CUSTO_INTERNO_MENOR".equals(situacao)) return base+"Seu custo atual é menor por "
                +moeda(dados.get("diferencaExternaMenosInterna"))+" ("+dados.get("percentualDiferenca")+"%). Não há economia em trocar pela oferta pesquisada. Confirme frete e validade antes de decidir.";
        if("OFERTA_EXTERNA_MENOR".equals(situacao)) return base+"A oferta externa indica economia potencial de "
                +moeda(dados.get("economiaEstimada"))+" ("+dados.get("percentualDiferenca")+"%). Confirme frete, validade e pedido mínimo antes de decidir.";
        return base+"Os custos são equivalentes. Confirme frete, validade e pedido mínimo antes de decidir.";
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
