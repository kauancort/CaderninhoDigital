package com.InovaSkill.CaderninhoDigital.ai.profit;

import com.InovaSkill.CaderninhoDigital.ai.contract.QualidadeResultado;
import com.InovaSkill.CaderninhoDigital.ai.search.ExtracaoOfertasMercado;
import com.InovaSkill.CaderninhoDigital.ai.search.InterpretadorOfertasMercado;
import com.InovaSkill.CaderninhoDigital.ai.search.PesquisaPrecosGateway;
import com.InovaSkill.CaderninhoDigital.ai.search.PesquisaCustosIndiretosGateway;
import com.InovaSkill.CaderninhoDigital.ai.search.ResultadoPesquisaPrecos;
import com.InovaSkill.CaderninhoDigital.ai.search.SolicitacaoPesquisaCustosIndiretos;
import com.InovaSkill.CaderninhoDigital.ai.search.SolicitacaoPesquisaPrecos;
import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import com.InovaSkill.CaderninhoDigital.entity.ItemVenda;
import com.InovaSkill.CaderninhoDigital.enums.ModalidadeVenda;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import com.InovaSkill.CaderninhoDigital.exception.ResourceNotFoundException;
import com.InovaSkill.CaderninhoDigital.repository.ProducaoRepository;
import com.InovaSkill.CaderninhoDigital.repository.ProdutoRepository;
import com.InovaSkill.CaderninhoDigital.repository.VendaRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Slf4j
public class AnaliseRentabilidadeProdutoService {
    private static final List<String> CUSTOS_NAO_DISPONIVEIS = List.of(
            "energia", "gás", "mão de obra", "impostos", "transporte", "perdas");
    private static final Pattern PESO = Pattern.compile("(?i)(\\d+(?:[.,]\\d+)?)\\s*(kg|g|gramas?)\\b");
    private final ProdutoRepository produtos;
    private final ProducaoRepository producoes;
    private final VendaRepository vendas;
    private final PesquisaPrecosGateway pesquisa;
    private final PesquisaCustosIndiretosGateway pesquisaCustosIndiretos;
    private final InterpretadorOfertasMercado interpretador;
    private final EstimadorCustosIndiretosService estimadorCustosIndiretos;
    private final AiOrchestratorProperties properties;
    private final Clock clock;

    public AnaliseRentabilidadeProdutoService(ProdutoRepository produtos, ProducaoRepository producoes,
            VendaRepository vendas, PesquisaPrecosGateway pesquisa, InterpretadorOfertasMercado interpretador,
            PesquisaCustosIndiretosGateway pesquisaCustosIndiretos,
            EstimadorCustosIndiretosService estimadorCustosIndiretos,
            AiOrchestratorProperties properties, Clock clock) {
        this.produtos = produtos;
        this.producoes = producoes;
        this.vendas = vendas;
        this.pesquisa = pesquisa;
        this.interpretador = interpretador;
        this.pesquisaCustosIndiretos = pesquisaCustosIndiretos;
        this.estimadorCustosIndiretos = estimadorCustosIndiretos;
        this.properties = properties;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Resultado analisar(Long empresaId, Long produtoId, LocalDate inicio, LocalDate fim,
            ModalidadeVenda modalidadeConsultada, BigDecimal precoConsultado) {
        var produto = produtos.buscarComGabaritoParaEmpresa(produtoId, empresaId)
                .orElseThrow(() -> new ResourceNotFoundException("Produto não encontrado"));
        var custo = calcularCusto(empresaId, produtoId, inicio, fim, produto.getCustoAtual());
        var itens = vendas.listarItensRentabilidadeProduto(empresaId, produtoId, inicio, fim);
        var resumoVendas = calcularVendas(itens, custo.custoUnitario(), produto.getPrecoVenda());
        List<Modalidade> modalidades = new ArrayList<>(resumoVendas.modalidades());
        if (modalidades.isEmpty() && produto.getPrecoVenda() != null) {
            modalidades.add(calcularModalidade(ModalidadeVenda.UNIDADE, BigDecimal.ONE,
                    produto.getPrecoVenda(), produto.getPrecoVenda(), BigDecimal.ZERO, BigDecimal.ZERO,
                    custo.custoUnitario(), "PRECO_CADASTRADO"));
        }

        String informacaoNecessaria = null;
        if (precoConsultado != null) {
            ModalidadeVenda tipo = modalidadeConsultada == null ? ModalidadeVenda.UNIDADE : modalidadeConsultada;
            BigDecimal unidades = unidadesConhecidas(tipo, modalidades);
            if (tipo != ModalidadeVenda.UNIDADE && unidades == null) {
                informacaoNecessaria = "Encontrei o preço informado, mas não encontrei quantas unidades existem na "
                        + tipo.name().toLowerCase(Locale.ROOT) + ".";
            } else {
                BigDecimal equivalente = precoConsultado.divide(unidades == null ? BigDecimal.ONE : unidades,
                        4, RoundingMode.HALF_UP);
                modalidades.removeIf(m -> m.tipo() == tipo && "PERGUNTA".equals(m.fonte()));
                modalidades.add(calcularModalidade(tipo, unidades == null ? BigDecimal.ONE : unidades,
                        precoConsultado, equivalente, BigDecimal.ZERO, BigDecimal.ZERO,
                        custo.custoUnitario(), "PERGUNTA"));
            }
        }
        if (modalidadeConsultada != null && modalidadeConsultada != ModalidadeVenda.UNIDADE
                && unidadesConhecidas(modalidadeConsultada, modalidades) == null) {
            informacaoNecessaria = "Não encontrei quantas unidades existem na "
                    + modalidadeConsultada.name().toLowerCase(Locale.ROOT)
                    + ". Preciso somente dessa informação para calcular a margem corretamente.";
        }

        modalidades.sort(Comparator.comparing(Modalidade::tipo));
        BigDecimal precoComparacao = precoParaMercado(modalidadeConsultada, modalidades,
                resumoVendas.precoMedioReal(), produto.getPrecoVenda());
        Mercado mercado = pesquisarMercado(produto.getNome(), produto.getDescricao(),
                produto.getCategoria() == null ? null : produto.getCategoria().getNome(),
                produto.getUnidadeMedida(), modalidadeConsultada, precoComparacao);
        EstimativaCustosIndiretos estimativaCustos = pesquisarCustosIndiretos(produto.getNome(),
                produto.getCategoria() == null ? null : produto.getCategoria().getNome(),
                custo, precoComparacao);
        String situacao = situacao(modalidades, informacaoNecessaria);
        List<String> avisos = new ArrayList<>();
        avisos.add("A análise usa margem conhecida, não lucro líquido.");
        if (custo.custoUnitario() == null) avisos.add("Não há custo conhecido suficiente para calcular margem.");
        if (mercado.posicao() == PosicaoMercado.DADOS_INSUFICIENTES)
            avisos.add("A comparação externa não ficou disponível; a análise interna foi preservada.");
        if (!"CALCULADA".equals(estimativaCustos.status()))
            avisos.add("A estimativa externa de custos indiretos é parcial ou insuficiente e não altera a margem conhecida.");
        if (informacaoNecessaria != null) avisos.add(informacaoNecessaria);
        QualidadeResultado qualidade = custo.custoUnitario() == null ? QualidadeResultado.INSUFICIENTE
                : QualidadeResultado.PARCIAL;
        return new Resultado(produtoId, produto.getNome(), inicio, fim, custo, resumoVendas,
                List.copyOf(modalidades), custo.componentes().isEmpty() ? null : custo.componentes().getFirst(),
                mercado, estimativaCustos, situacao, informacaoNecessaria, List.copyOf(avisos), qualidade);
    }

    private EstimativaCustosIndiretos pesquisarCustosIndiretos(String produto, String categoria,
            Custo custo, BigDecimal precoBase) {
        if (!properties.getFeatures().isSearch())
            return estimativaIndisponivel("Pesquisa externa desabilitada.", custo.custosNaoDisponiveis());
        try {
            var resultado = pesquisaCustosIndiretos.pesquisarCustosIndiretos(
                    new SolicitacaoPesquisaCustosIndiretos(produto, categoria,
                            properties.getSearch().getDefaultCity(), properties.getSearch().getDefaultState(),
                            custo.custosNaoDisponiveis()));
            EstimativaCustosIndiretos base = estimadorCustosIndiretos.estimar(
                    custo.custosNaoDisponiveis(), resultado.fontes(), precoBase);
            if (base.custoIndiretoEstimadoUnidade() == null || custo.custoUnitario() == null || precoBase == null)
                return base;
            BigDecimal total = custo.custoUnitario().add(base.custoIndiretoEstimadoUnidade())
                    .setScale(4, RoundingMode.HALF_UP);
            BigDecimal margem = precoBase.subtract(total).setScale(4, RoundingMode.HALF_UP);
            BigDecimal percentual = precoBase.signum() == 0 ? null
                    : margem.divide(precoBase, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100))
                            .setScale(2, RoundingMode.HALF_UP);
            return new EstimativaCustosIndiretos(base.status(), base.criterio(), base.precoBaseUnidade(),
                    base.custoIndiretoEstimadoUnidade(), total, margem, percentual, base.componentes(),
                    base.custosNaoEstimados(), base.aviso());
        } catch (RuntimeException falha) {
            log.warn("evento=PESQUISA_EXTERNA_EXECUTADA tipo=CUSTOS_INDIRETOS status=ERRO causa={}",
                    falha.getClass().getSimpleName());
            return estimativaIndisponivel("Tavily indisponível para estimar custos indiretos; a margem conhecida continua válida.",
                    custo.custosNaoDisponiveis());
        }
    }

    private EstimativaCustosIndiretos estimativaIndisponivel(String aviso, List<String> ausentes) {
        return new EstimativaCustosIndiretos("INDISPONIVEL", "MEDIANA_REFERENCIAS_EXTERNAS", null,
                null, null, null, null, List.of(), List.copyOf(ausentes), aviso);
    }

    private Custo calcularCusto(Long empresaId, Long produtoId, LocalDate inicio, LocalDate fim,
            BigDecimal custoAtual) {
        var historico = producoes.listarParaAnaliseMargem(empresaId, produtoId, inicio, fim);
        BigDecimal quantidade = BigDecimal.ZERO;
        BigDecimal total = BigDecimal.ZERO;
        Map<String, BigDecimal> porComponente = new LinkedHashMap<>();
        for (var producao : historico) {
            quantidade = quantidade.add(zero(producao.getQuantidadeProduzida()));
            for (var insumo : producao.getInsumos()) {
                BigDecimal valor = zero(insumo.getCustoTotal());
                total = total.add(valor);
                porComponente.merge(insumo.getMateriaPrima().getNome(), valor, BigDecimal::add);
            }
        }
        BigDecimal unitario = quantidade.signum() > 0
                ? total.divide(quantidade, 4, RoundingMode.HALF_UP) : custoAtual;
        String criterio = quantidade.signum() > 0 ? "MEDIA_PONDERADA_PRODUCOES_PERIODO"
                : custoAtual == null ? "SEM_CUSTO_CONHECIDO" : "CUSTO_ATUAL_CADASTRADO";
        BigDecimal totalCalculado = total;
        List<ComponenteCusto> componentes = porComponente.entrySet().stream()
                .map(e -> new ComponenteCusto(e.getKey(), e.getValue().setScale(2, RoundingMode.HALF_UP),
                        totalCalculado.signum() == 0 ? null : e.getValue().divide(totalCalculado, 4, RoundingMode.HALF_UP)
                                .multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP)))
                .sorted(Comparator.comparing(ComponenteCusto::custoConhecido).reversed()).toList();
        List<String> considerados = componentes.stream().map(ComponenteCusto::nome).toList();
        List<String> ausentes = CUSTOS_NAO_DISPONIVEIS.stream().filter(custoAusente -> considerados.stream()
                .map(this::normalizar).noneMatch(nome -> nome.contains(normalizar(custoAusente)))).toList();
        return new Custo(unitario, total.setScale(2, RoundingMode.HALF_UP), quantidade, criterio,
                considerados, ausentes, componentes);
    }

    private Vendas calcularVendas(List<ItemVenda> itens, BigDecimal custoUnitario, BigDecimal precoCadastrado) {
        BigDecimal quantidade = BigDecimal.ZERO;
        BigDecimal receita = BigDecimal.ZERO;
        BigDecimal menor = null;
        BigDecimal maior = null;
        Map<ModalidadeVenda, AcumuladorModalidade> grupos = new EnumMap<>(ModalidadeVenda.class);
        for (ItemVenda item : itens) {
            if (item.getQuantidade() == null || item.getQuantidade().signum() <= 0) continue;
            BigDecimal equivalente = zero(item.getValorTotal()).divide(item.getQuantidade(), 4, RoundingMode.HALF_UP);
            quantidade = quantidade.add(item.getQuantidade());
            receita = receita.add(zero(item.getValorTotal()));
            menor = menor == null ? equivalente : menor.min(equivalente);
            maior = maior == null ? equivalente : maior.max(equivalente);
            ModalidadeVenda tipo = item.getModalidadeVenda() == null ? ModalidadeVenda.UNIDADE : item.getModalidadeVenda();
            BigDecimal qtdModalidade = item.getQuantidadeModalidade();
            BigDecimal unidades = item.getUnidadesPorModalidade();
            if (tipo == ModalidadeVenda.UNIDADE) {
                if (qtdModalidade == null) qtdModalidade = item.getQuantidade();
                if (unidades == null) unidades = BigDecimal.ONE;
            }
            grupos.computeIfAbsent(tipo, k -> new AcumuladorModalidade()).adicionar(item.getQuantidade(),
                    qtdModalidade, unidades, zero(item.getValorTotal()), equivalente);
        }
        List<Modalidade> modalidades = grupos.entrySet().stream()
                .map(e -> e.getValue().resultado(e.getKey(), custoUnitario)).toList();
        BigDecimal media = quantidade.signum() == 0 ? null : receita.divide(quantidade, 4, RoundingMode.HALF_UP);
        return new Vendas(precoCadastrado, quantidade, receita.setScale(2, RoundingMode.HALF_UP), media,
                menor, maior, itens.size(), modalidades);
    }

    private Modalidade calcularModalidade(ModalidadeVenda tipo, BigDecimal unidades, BigDecimal preco,
            BigDecimal equivalente, BigDecimal quantidadeUnidades, BigDecimal receita,
            BigDecimal custoUnitario, String fonte) {
        BigDecimal margem = custoUnitario == null || equivalente == null ? null
                : equivalente.subtract(custoUnitario).setScale(4, RoundingMode.HALF_UP);
        BigDecimal percentual = margem == null || equivalente.signum() == 0 ? null
                : margem.divide(equivalente, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100))
                        .setScale(2, RoundingMode.HALF_UP);
        return new Modalidade(tipo, unidades, preco, equivalente, margem, percentual,
                quantidadeUnidades, receita, fonte);
    }

    private BigDecimal unidadesConhecidas(ModalidadeVenda tipo, List<Modalidade> modalidades) {
        if (tipo == ModalidadeVenda.UNIDADE) return BigDecimal.ONE;
        return modalidades.stream().filter(m -> m.tipo() == tipo && m.unidadesPorModalidade() != null)
                .map(Modalidade::unidadesPorModalidade).findFirst().orElse(null);
    }

    private BigDecimal precoParaMercado(ModalidadeVenda consultada, List<Modalidade> modalidades,
            BigDecimal mediaReal, BigDecimal cadastrado) {
        if (consultada != null) {
            BigDecimal encontrado = modalidades.stream().filter(m -> m.tipo() == consultada)
                    .map(Modalidade::precoEquivalenteUnidade).filter(java.util.Objects::nonNull)
                    .findFirst().orElse(null);
            if (encontrado != null) return encontrado;
        }
        return mediaReal != null ? mediaReal : cadastrado;
    }

    private Mercado pesquisarMercado(String nome, String descricao, String categoria, String unidade,
            ModalidadeVenda modalidade, BigDecimal nossoPreco) {
        if (!properties.getFeatures().isSearch()) return Mercado.indisponivel("Pesquisa externa desabilitada.");
        BigDecimal pesoGramas = pesoGramas(nome + " " + (descricao == null ? "" : descricao));
        String qualificadores = qualificadores(descricao, categoria, pesoGramas, modalidade);
        ResultadoPesquisaPrecos encontrado;
        try {
            encontrado = pesquisa.pesquisar(new SolicitacaoPesquisaPrecos(nome, "unidade", BigDecimal.ONE,
                    properties.getSearch().getDefaultCity(), properties.getSearch().getDefaultState(),
                    true, qualificadores));
        } catch (RuntimeException falha) {
            log.warn("evento=PESQUISA_EXTERNA_EXECUTADA tipo=RENTABILIDADE_PRODUTO status=ERRO causa={}",
                    falha.getClass().getSimpleName());
            return Mercado.indisponivel("Tavily indisponível; custos e margens internas continuam válidos.");
        }
        var extraido = interpretador.interpretarDeterministicamente(encontrado.fontes(), nome);
        List<ReferenciaMercado> referencias = new ArrayList<>();
        for (var oferta : extraido.ofertas()) {
            BigDecimal normalizado = normalizarPreco(oferta.dados(), pesoGramas);
            if (normalizado == null) continue;
            Comparabilidade comparabilidade = comparabilidade(nome, descricao, categoria, pesoGramas,
                    oferta.fonte().titulo() + " " + oferta.fonte().trecho(), oferta.dados());
            referencias.add(new ReferenciaMercado(oferta.fonte().titulo(), oferta.fonte().url().toString(),
                    normalizado, comparabilidade, segmento(oferta.fonte().trecho(), oferta.dados().localizacao()),
                    oferta.dados().evidenciaPreco()));
        }
        List<BigDecimal> validos = referencias.stream()
                .filter(r -> r.comparabilidade() != Comparabilidade.BAIXA)
                .map(ReferenciaMercado::precoEquivalenteUnidade).sorted().toList();
        if (validos.size() < 2 || nossoPreco == null) {
            return new Mercado(null, null, null, validos.size(), PosicaoMercado.DADOS_INSUFICIENTES,
                    encontrado.pesquisadoEm(), List.copyOf(referencias), "Poucas referências comparáveis.");
        }
        BigDecimal mediana = validos.size() % 2 == 1 ? validos.get(validos.size() / 2)
                : validos.get(validos.size() / 2 - 1).add(validos.get(validos.size() / 2))
                        .divide(BigDecimal.valueOf(2), 4, RoundingMode.HALF_UP);
        PosicaoMercado posicao = nossoPreco.compareTo(validos.getFirst()) < 0 ? PosicaoMercado.ABAIXO_DA_FAIXA
                : nossoPreco.compareTo(validos.getLast()) > 0 ? PosicaoMercado.ACIMA_DA_FAIXA
                : PosicaoMercado.DENTRO_DA_FAIXA;
        return new Mercado(validos.getFirst(), mediana, validos.getLast(), validos.size(), posicao,
                encontrado.pesquisadoEm(), List.copyOf(referencias), null);
    }

    private BigDecimal normalizarPreco(ExtracaoOfertasMercado.Oferta oferta, BigDecimal pesoReferenciaGramas) {
        if (oferta.tipoPreco() == ExtracaoOfertasMercado.TipoPreco.UNITARIO
                && oferta.unidadePreco() == ExtracaoOfertasMercado.Unidade.UNIDADE)
            return oferta.precoAnunciado().setScale(4, RoundingMode.HALF_UP);
        if (oferta.tipoPreco() != ExtracaoOfertasMercado.TipoPreco.TOTAL_EMBALAGEM
                || oferta.quantidadeEmbalagem() == null || oferta.unidadeEmbalagem() == null) return null;
        if (oferta.unidadeEmbalagem() == ExtracaoOfertasMercado.Unidade.UNIDADE)
            return oferta.precoAnunciado().divide(oferta.quantidadeEmbalagem(), 4, RoundingMode.HALF_UP);
        if (pesoReferenciaGramas == null) return null;
        BigDecimal gramas = oferta.unidadeEmbalagem() == ExtracaoOfertasMercado.Unidade.KG
                ? oferta.quantidadeEmbalagem().multiply(BigDecimal.valueOf(1000))
                : oferta.unidadeEmbalagem() == ExtracaoOfertasMercado.Unidade.G
                        ? oferta.quantidadeEmbalagem() : null;
        if (gramas == null || gramas.signum() <= 0) return null;
        return oferta.precoAnunciado().divide(gramas.divide(pesoReferenciaGramas, 6, RoundingMode.HALF_UP),
                4, RoundingMode.HALF_UP);
    }

    private Comparabilidade comparabilidade(String nome, String descricao, String categoria, BigDecimal peso,
            String texto, ExtracaoOfertasMercado.Oferta oferta) {
        String alvo = normalizar(nome + " " + (descricao == null ? "" : descricao) + " "
                + (categoria == null ? "" : categoria));
        String fonte = normalizar(texto + " " + oferta.produto());
        int pontos = 2;
        boolean artesanalAlvo = alvo.contains("artesanal");
        boolean industrialFonte = fonte.matches("(?s).*\\b(industrial|pac[oç]quita|atacado|fardo)\\b.*");
        if (artesanalAlvo && industrialFonte) pontos -= 2;
        BigDecimal pesoFonte = pesoGramas(texto);
        if (peso != null && pesoFonte != null) {
            BigDecimal razao = pesoFonte.divide(peso, 2, RoundingMode.HALF_UP);
            if (razao.compareTo(new BigDecimal("0.80")) >= 0 && razao.compareTo(new BigDecimal("1.20")) <= 0) pontos++;
            else pontos -= 2;
        } else if (peso != null) pontos--;
        if (fonte.contains(normalizar(properties.getSearch().getDefaultCity()))) pontos++;
        return pontos >= 3 ? Comparabilidade.ALTA : pontos >= 1 ? Comparabilidade.MEDIA : Comparabilidade.BAIXA;
    }

    private String segmento(String texto, String localizacao) {
        String n = normalizar(texto + " " + (localizacao == null ? "" : localizacao));
        if (n.matches("(?s).*\\b(atacado|fardo|distribuidor)\\b.*")) return "ATACADO";
        if (n.contains(normalizar(properties.getSearch().getDefaultCity()))) return "REGIONAL";
        return "ONLINE";
    }

    private String qualificadores(String descricao, String categoria, BigDecimal peso, ModalidadeVenda modalidade) {
        List<String> partes = new ArrayList<>();
        if (categoria != null && categoria.matches("[\\p{L}0-9 .'-]{1,60}")) partes.add(categoria);
        if (descricao != null && normalizar(descricao).contains("artesanal")) partes.add("artesanal");
        if (peso != null) partes.add(peso.stripTrailingZeros().toPlainString() + "g");
        if (modalidade != null) partes.add(modalidade.name().toLowerCase(Locale.ROOT));
        return String.join(" ", partes);
    }

    private BigDecimal pesoGramas(String texto) {
        Matcher matcher = PESO.matcher(texto == null ? "" : texto);
        if (!matcher.find()) return null;
        BigDecimal valor = new BigDecimal(matcher.group(1).replace(',', '.'));
        return matcher.group(2).toLowerCase(Locale.ROOT).startsWith("kg")
                ? valor.multiply(BigDecimal.valueOf(1000)) : valor;
    }

    private String situacao(List<Modalidade> modalidades, String faltante) {
        if (faltante != null) return "INFORMACAO_NECESSARIA";
        List<BigDecimal> margens = modalidades.stream().map(Modalidade::margemConhecidaUnidade)
                .filter(java.util.Objects::nonNull).toList();
        if (margens.isEmpty()) return "DADOS_INSUFICIENTES";
        boolean positiva = margens.stream().anyMatch(v -> v.signum() >= 0);
        boolean negativa = margens.stream().anyMatch(v -> v.signum() < 0);
        if (positiva && negativa) return "MODALIDADES_DIVERGENTES";
        return negativa ? "MARGEM_CONHECIDA_NEGATIVA" : "MARGEM_CONHECIDA_POSITIVA";
    }

    private BigDecimal zero(BigDecimal valor) { return valor == null ? BigDecimal.ZERO : valor; }
    private String normalizar(String valor) {
        return Normalizer.normalize(valor == null ? "" : valor, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "").toLowerCase(Locale.ROOT);
    }

    private final class AcumuladorModalidade {
        private BigDecimal unidades = BigDecimal.ZERO;
        private BigDecimal quantidadeModalidade = BigDecimal.ZERO;
        private BigDecimal receita = BigDecimal.ZERO;
        private BigDecimal unidadesPorModalidade;
        private boolean unidadesInconsistentes;
        void adicionar(BigDecimal qtdUnidades, BigDecimal qtdModalidade, BigDecimal porModalidade,
                BigDecimal valor, BigDecimal equivalente) {
            unidades = unidades.add(qtdUnidades);
            receita = receita.add(valor);
            if (qtdModalidade != null) quantidadeModalidade = quantidadeModalidade.add(qtdModalidade);
            if (porModalidade != null) {
                if (unidadesPorModalidade == null) unidadesPorModalidade = porModalidade;
                else if (unidadesPorModalidade.compareTo(porModalidade) != 0) unidadesInconsistentes = true;
            }
        }
        Modalidade resultado(ModalidadeVenda tipo, BigDecimal custo) {
            BigDecimal equivalente = unidades.signum() == 0 ? null
                    : receita.divide(unidades, 4, RoundingMode.HALF_UP);
            BigDecimal precoModalidade = quantidadeModalidade.signum() == 0 ? null
                    : receita.divide(quantidadeModalidade, 2, RoundingMode.HALF_UP);
            return calcularModalidade(tipo, unidadesInconsistentes ? null : unidadesPorModalidade,
                    precoModalidade, equivalente, unidades, receita.setScale(2, RoundingMode.HALF_UP),
                    custo, "VENDAS_REAIS");
        }
    }

    public enum Comparabilidade { ALTA, MEDIA, BAIXA }
    public enum PosicaoMercado { ABAIXO_DA_FAIXA, DENTRO_DA_FAIXA, ACIMA_DA_FAIXA, DADOS_INSUFICIENTES }
    public record ComponenteCusto(String nome, BigDecimal custoConhecido, BigDecimal percentual) {}
    public record Custo(BigDecimal custoConhecidoUnidade, BigDecimal custoProducaoConhecido,
            BigDecimal quantidadeProduzida, String criterio, List<String> custosConsiderados,
            List<String> custosNaoDisponiveis, List<ComponenteCusto> componentes) {
        BigDecimal custoUnitario() { return custoConhecidoUnidade; }
    }
    public record Vendas(BigDecimal precoCadastradoUnidade, BigDecimal quantidadeVendida,
            BigDecimal receita, BigDecimal precoMedioReal,
            BigDecimal menorPrecoReal, BigDecimal maiorPrecoReal, int itensVenda,
            List<Modalidade> modalidades) {}
    public record Modalidade(ModalidadeVenda tipo, BigDecimal unidadesPorModalidade, BigDecimal preco,
            BigDecimal precoEquivalenteUnidade, BigDecimal margemConhecidaUnidade,
            BigDecimal margemPercentual, BigDecimal quantidadeVendidaUnidades, BigDecimal receita,
            String fonte) {}
    public record ReferenciaMercado(String nome, String url, BigDecimal precoEquivalenteUnidade,
            Comparabilidade comparabilidade, String segmento, String evidencia) {}
    public record Mercado(BigDecimal menorPrecoComparavel, BigDecimal mediana, BigDecimal maiorPrecoComparavel,
            int referenciasValidas, PosicaoMercado posicao, Instant pesquisadoEm,
            List<ReferenciaMercado> referencias, String aviso) {
        static Mercado indisponivel(String aviso) {
            return new Mercado(null, null, null, 0, PosicaoMercado.DADOS_INSUFICIENTES,
                    null, List.of(), aviso);
        }
    }
    public record ReferenciaCustoIndireto(String nome, String url, BigDecimal percentualReceita,
            String evidencia) {}
    public record EstimativaComponenteIndireto(String nome, BigDecimal menorPercentual,
            BigDecimal medianaPercentual, BigDecimal maiorPercentual, String base,
            BigDecimal valorEstimadoUnidade, int referenciasValidas, String confianca,
            List<ReferenciaCustoIndireto> referencias) {}
    public record EstimativaCustosIndiretos(String status, String criterio, BigDecimal precoBaseUnidade,
            BigDecimal custoIndiretoEstimadoUnidade, BigDecimal custoTotalEstimadoUnidade,
            BigDecimal margemEstimadaUnidade, BigDecimal margemEstimadaPercentual,
            List<EstimativaComponenteIndireto> componentes, List<String> custosNaoEstimados,
            String aviso) {}
    public record Resultado(Long produtoId, String produto, LocalDate inicio, LocalDate fim, Custo custo,
            Vendas vendas, List<Modalidade> modalidades, ComponenteCusto principalComponenteCusto,
            Mercado mercado, EstimativaCustosIndiretos estimativaCustosIndiretos,
            String situacao, String informacaoNecessaria, List<String> avisos,
            QualidadeResultado qualidade) {}
}
