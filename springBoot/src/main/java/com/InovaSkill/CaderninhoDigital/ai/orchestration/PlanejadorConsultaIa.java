package com.InovaSkill.CaderninhoDigital.ai.orchestration;

import com.InovaSkill.CaderninhoDigital.ai.contract.PlanoOrquestracao;
import com.InovaSkill.CaderninhoDigital.ai.contract.ArgumentosComparacaoMercado;
import com.InovaSkill.CaderninhoDigital.ai.contract.ArgumentosCompraInsumo;
import com.InovaSkill.CaderninhoDigital.ai.contract.ArgumentosFerramenta;
import com.InovaSkill.CaderninhoDigital.ai.contract.ArgumentosPeriodo;
import com.InovaSkill.CaderninhoDigital.ai.contract.ArgumentosProdutoPeriodo;
import com.InovaSkill.CaderninhoDigital.ai.contract.ArgumentosRentabilidadeProduto;
import com.InovaSkill.CaderninhoDigital.ai.contract.ChamadaFerramenta;
import com.InovaSkill.CaderninhoDigital.ai.contract.FerramentaPermitida;
import com.InovaSkill.CaderninhoDigital.ai.contract.IntencaoOrquestrador;
import com.InovaSkill.CaderninhoDigital.ai.gateway.*;
import com.InovaSkill.CaderninhoDigital.ai.observability.ControleOperacionalIa;
import com.InovaSkill.CaderninhoDigital.ai.privacy.PoliticaDadosIa;
import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import com.InovaSkill.CaderninhoDigital.exception.CodigoErroOrquestrador;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.text.Normalizer;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import lombok.extern.slf4j.Slf4j;

@Component
@Slf4j
public class PlanejadorConsultaIa {
    private final ModeloGateway gateway;
    private final PoliticaDadosIa politica;
    private final AiOrchestratorProperties properties;
    private final ContextoPlanejamentoService contextoService;
    private final ObjectMapper mapper;
    private final Clock clock;

    private static final Pattern REFERENCIA_TEMPORAL = Pattern.compile(
            "\\b(hoje|ontem|semana|mes|mensal|ano|trimestre|semestre|periodo|ultim[oa]s?|"
                    + "desde|entre|janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|"
                    + "outubro|novembro|dezembro|\\d{1,2}[/-]\\d{1,2}|\\d{4})\\b");

    public PlanejadorConsultaIa(ModeloGateway gateway, PoliticaDadosIa politica,
            AiOrchestratorProperties properties, ContextoPlanejamentoService contextoService, ObjectMapper mapper,
            Clock clock) {
        this.gateway = gateway; this.politica = politica; this.properties = properties;
        this.contextoService = contextoService; this.mapper = mapper; this.clock = clock;
    }

    public PlanoOrquestracao planejar(String mensagem, Long usuarioId, ControleOperacionalIa.Sessao sessao) {
        var contexto = contextoService.carregar(usuarioId);
        var solicitacao = solicitacao(mensagem, contexto, false);
        try {
            sessao.antesModelo();
            var resposta = gateway.gerarPlano(solicitacao);
            sessao.metadados(resposta.metadados(), "planejamento");
            log.info("evento=PLANO_GERADO modelo={} ferramentas={} status=SUCESSO",
                    resposta.metadados().modeloEfetivo(), resposta.conteudo().chamadas().size());
            return normalizar(resposta.conteudo(), mensagem);
        } catch (OrquestradorException primeiraFalha) {
            if (primeiraFalha.getCodigo() != CodigoErroOrquestrador.PLANO_INVALIDO
                    || properties.getLimits().getPlanRepairs() < 1) throw primeiraFalha;
            sessao.antesModelo();
            var resposta = gateway.gerarPlano(solicitacao(mensagem, contexto, true));
            sessao.metadados(resposta.metadados(), "planejamento");
            return normalizar(resposta.conteudo(), mensagem);
        }
    }

    private SolicitacaoModelo solicitacao(String mensagem, ContextoPlanejamentoService.Contexto contexto,
            boolean reparo) {
        String catalogo;
        try {
            catalogo = mapper.writeValueAsString(java.util.Map.of(
                    "produtos", contexto.produtos(), "materiasPrimas", contexto.materiasPrimas()));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Não foi possível preparar o catálogo permitido", exception);
        }
        LocalDate hoje = LocalDate.now(clock);
        String sistema = "Você planeja consultas empresariais. Hoje é " + hoje + " no fuso "
                + clock.getZone() + ". Escolha apenas IDs presentes no catálogo e apenas "
                + "ferramentas do schema. Ferramentas: RESUMO_ESTOQUE; RESUMO_VENDAS, RESUMO_GASTOS e "
                + "RESUMO_RECEBIVEIS por período; ANALISE_CUSTO_PRODUTO por produto; ANALISE_MARGEM_PRODUTO "
                + "por produto e período; ANALISAR_RENTABILIDADE_PRODUTO por produto, período, modalidade e preço opcionais; "
                + "ANALISE_COMPRAS_INSUMO por matéria-prima opcional e período"
                + (properties.getFeatures().isSearch() ? "; COMPARAR_PRECO_MERCADO por matéria-prima, período, "
                        + "quantidade opcional e localização. Use mercado somente quando a pergunta pedir preço externo, "
                        + "fornecedor, oferta, economia de compra ou se está pagando caro" : "")
                + ". Para perguntas abertas, combine até " + properties.getLimits().getToolsPerPlan()
                + " ferramentas sem repetir chamadas idênticas. Não gere SQL, empresaId, URL, credencial, classe ou campos extras. "
                + "Nunca estime números ausentes. Use datas ISO-8601. Se não houver período explícito, use os últimos 90 dias; "
                + "para comparação entre meses, use períodos completos e equivalentes. Local padrão: "
                + properties.getSearch().getDefaultCity() + "/" + properties.getSearch().getDefaultState()
                + ". schemaVersion=" + properties.getSchemaVersion() + ". Catálogo permitido: " + catalogo
                + ". Devolva somente JSON válido no schema."
                + (reparo ? " Corrija o plano anterior implicitamente e devolva apenas o contrato válido." : "");
        var solicitacao = new SolicitacaoModelo(List.of(
                new MensagemModelo(PapelMensagemModelo.SYSTEM, sistema),
                new MensagemModelo(PapelMensagemModelo.USER, politica.delimitarEntradaNaoConfiavel(mensagem))));
        politica.validarSolicitacaoModelo(solicitacao);
        return solicitacao;
    }

    private PlanoOrquestracao normalizar(PlanoOrquestracao plano, String mensagem) {
        if (plano == null || plano.chamadas() == null) return plano;
        LocalDate fimPadrao = LocalDate.now(clock);
        LocalDate inicioPadrao = fimPadrao.minusDays(89);
        List<ChamadaFerramenta> unicasOriginais = List.copyOf(new LinkedHashSet<>(plano.chamadas()));
        boolean periodoPadrao = unicasOriginais.size() == 1 && !possuiReferenciaTemporal(mensagem);
        List<ChamadaFerramenta> unicas = unicasOriginais.stream()
                .map(chamada -> periodoPadrao ? aplicarPeriodoPadrao(chamada, inicioPadrao, fimPadrao) : chamada)
                .toList();
        if (unicas.size() != plano.chamadas().size() || periodoPadrao) {
            log.info("evento=PLANO_NORMALIZADO duplicatasRemovidas={} periodoPadrao={} inicio={} fim={}",
                    plano.chamadas().size() - unicas.size(), periodoPadrao,
                    periodoPadrao ? inicioPadrao : null, periodoPadrao ? fimPadrao : null);
        }
        IntencaoOrquestrador intencao = unicas.size() == 1
                ? intencaoDaFerramenta(unicas.getFirst().ferramenta()) : plano.intencao();
        if (intencao != plano.intencao()) {
            log.info("evento=PLANO_NORMALIZADO intencaoOriginal={} intencaoValidada={}",
                    plano.intencao(), intencao);
        }
        return new PlanoOrquestracao(plano.schemaVersion(), intencao, unicas, plano.modoResposta());
    }

    private IntencaoOrquestrador intencaoDaFerramenta(FerramentaPermitida ferramenta) {
        return switch (ferramenta) {
            case RESUMO_ESTOQUE -> IntencaoOrquestrador.CONSULTAR_ESTOQUE;
            case RESUMO_VENDAS -> IntencaoOrquestrador.CONSULTAR_VENDAS;
            case RESUMO_GASTOS -> IntencaoOrquestrador.CONSULTAR_GASTOS;
            case RESUMO_RECEBIVEIS -> IntencaoOrquestrador.CONSULTAR_RECEBIVEIS;
            case ANALISE_CUSTO_PRODUTO -> IntencaoOrquestrador.ANALISAR_CUSTO_PRODUTO;
            case ANALISE_MARGEM_PRODUTO -> IntencaoOrquestrador.ANALISAR_MARGEM_PRODUTO;
            case ANALISAR_RENTABILIDADE_PRODUTO -> IntencaoOrquestrador.ANALISAR_RENTABILIDADE_PRODUTO;
            case ANALISE_COMPRAS_INSUMO -> IntencaoOrquestrador.ANALISAR_COMPRAS_INSUMO;
            case COMPARAR_PRECO_MERCADO -> IntencaoOrquestrador.COMPARAR_PRECO_MERCADO;
            default -> IntencaoOrquestrador.DESCONHECIDA;
        };
    }

    private ChamadaFerramenta aplicarPeriodoPadrao(ChamadaFerramenta chamada, LocalDate inicio, LocalDate fim) {
        ArgumentosFerramenta argumentos = chamada.argumentos();
        if (argumentos instanceof ArgumentosPeriodo) argumentos = new ArgumentosPeriodo(inicio, fim);
        else if (argumentos instanceof ArgumentosCompraInsumo atual)
            argumentos = new ArgumentosCompraInsumo(atual.materiaPrimaId(), inicio, fim);
        else if (argumentos instanceof ArgumentosProdutoPeriodo atual)
            argumentos = new ArgumentosProdutoPeriodo(atual.produtoId(), inicio, fim);
        else if (argumentos instanceof ArgumentosRentabilidadeProduto atual)
            argumentos = new ArgumentosRentabilidadeProduto(atual.produtoId(), inicio, fim,
                    atual.modalidade(), atual.precoConsultado());
        else if (argumentos instanceof ArgumentosComparacaoMercado atual)
            argumentos = normalizarMercado(atual, inicio, fim);
        return new ChamadaFerramenta(chamada.ferramenta(), argumentos);
    }

    private ArgumentosComparacaoMercado normalizarMercado(ArgumentosComparacaoMercado atual,
            LocalDate inicio, LocalDate fim) {
        String uf = atual.uf() == null ? properties.getSearch().getDefaultState()
                : atual.uf().trim().toUpperCase(Locale.ROOT);
        if (!uf.matches("[A-Z]{2}")) uf = properties.getSearch().getDefaultState();
        String cidade = atual.cidade() == null ? properties.getSearch().getDefaultCity() : atual.cidade().trim();
        cidade = cidade.replaceFirst("(?iu)\\s*[,/]\\s*" + Pattern.quote(uf) + "\\s*$", "").trim();
        if (!cidade.matches("[\\p{L}0-9 .,'-]{1,100}")) cidade = properties.getSearch().getDefaultCity();
        return new ArgumentosComparacaoMercado(atual.materiaPrimaId(), inicio, fim, atual.unidade(),
                atual.quantidadeAlvo(), cidade, uf);
    }

    private boolean possuiReferenciaTemporal(String mensagem) {
        if (mensagem == null) return false;
        String normalizada = Normalizer.normalize(mensagem, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
        return REFERENCIA_TEMPORAL.matcher(normalizada).find();
    }
}
