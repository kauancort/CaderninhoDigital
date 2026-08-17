package com.InovaSkill.CaderninhoDigital.ai.search;

import com.InovaSkill.CaderninhoDigital.ai.contract.QualidadeResultado;
import com.InovaSkill.CaderninhoDigital.ai.cost.HistoricoPrecosInsumoService;
import com.InovaSkill.CaderninhoDigital.exception.ResourceNotFoundException;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import com.InovaSkill.CaderninhoDigital.repository.MateriaPrimaRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class ComparacaoMercadoService {
    private static final BigDecimal MESES_ESTOQUE_ELEVADO = BigDecimal.valueOf(3);
    private static final Pattern UNIDADE_EXPLICITA_EVIDENCIA = Pattern.compile(
            "(?i)(?:\\d+(?:[.,]\\d+)?)\\s*(kg|quilo(?:s)?|g|grama(?:s)?|l|litro(?:s)?|ml|mililitro(?:s)?|unidade(?:s)?)\\b");
    private final HistoricoPrecosInsumoService historico;
    private final MateriaPrimaRepository materias;
    private final PesquisaPrecosGateway pesquisa;
    private final InterpretadorOfertasMercado interpretador;
    private final Clock clock;

    public ComparacaoMercadoService(HistoricoPrecosInsumoService historico,
            MateriaPrimaRepository materias, PesquisaPrecosGateway pesquisa,
            InterpretadorOfertasMercado interpretador, Clock clock) {
        this.historico = historico; this.materias = materias; this.pesquisa = pesquisa;
        this.interpretador = interpretador; this.clock = clock;
    }

    public Resultado comparar(Long usuarioId, Long empresaId, Long materiaPrimaId, LocalDate inicio, LocalDate fim,
            String unidadeSolicitada, BigDecimal quantidadeSolicitada, String cidade, String uf) {
        var materia = materias.buscarAcessivelParaAnalise(materiaPrimaId, empresaId)
                .orElseThrow(() -> new ResourceNotFoundException("Matéria-prima não encontrada"));
        String unidade = materia.getUnidadeMedida();
        if (unidadeSolicitada != null && !unidadeSolicitada.isBlank()
                && !unidade.equalsIgnoreCase(unidadeSolicitada)) {
            throw new IllegalArgumentException("Unidade não corresponde ao cadastro da matéria-prima");
        }
        var metricas = historico.analisar(empresaId, materiaPrimaId, fim);
        BigDecimal quantidade = quantidadeSolicitada != null ? quantidadeSolicitada
                : metricas.ultimaCompra() == null ? null : metricas.ultimaCompra().quantidade();
        BigDecimal precoInterno = metricas.ultimaCompra() == null ? null : metricas.ultimaCompra().precoUnitario();
        if (quantidade == null || quantidade.signum() <= 0) {
            return resultadoInterno(materiaPrimaId, materia.getNome(), unidade, null, precoInterno, metricas,
                    "Informe a quantidade desejada; o histórico não possui uma compra anterior que possa servir de referência.");
        }
        ResultadoPesquisaPrecos externa;
        try {
            externa = pesquisa.pesquisar(new SolicitacaoPesquisaPrecos(
                    materia.getNome(), unidade, quantidade, cidade, uf));
        } catch (OrquestradorException e) {
            log.warn("evento=PESQUISA_EXTERNA_EXECUTADA tipo=COMPARACAO_MERCADO status=ERRO codigo={}",
                    e.getCodigo());
            return resultadoInterno(materiaPrimaId, materia.getNome(), unidade, quantidade, precoInterno, metricas,
                    "A pesquisa de mercado no Tavily está indisponível; a análise histórica interna foi preservada.");
        }
        log.info("evento=PESQUISA_EXTERNA_EXECUTADA tipo=COMPARACAO_MERCADO status=SUCESSO fontes={}",
                externa.fontes().size());
        InterpretadorOfertasMercado.ResultadoInterpretacao interpretacao;
        try {
            interpretacao = interpretador.interpretarDetalhado(externa.fontes(), materia.getNome(), usuarioId);
            if (interpretacao == null) {
                var legadas = interpretador.interpretar(externa.fontes(), materia.getNome(), usuarioId);
                interpretacao = new InterpretadorOfertasMercado.ResultadoInterpretacao(
                        legadas == null ? List.of() : List.copyOf(legadas), fontesDerivadas(externa.fontes(), legadas));
            }
        } catch (OrquestradorException exception) {
            log.warn("Interpretação de ofertas não concluída: codigo={} fontes={}",
                    exception.getCodigo(), externa.fontes().size());
            String motivo = motivoFalhaInterpretacao(exception, externa.fontes().size());
            return new Resultado(materiaPrimaId, materia.getNome(), unidade, quantidade, precoInterno, custo(precoInterno, quantidade),
                    null, null, null, null, "INSUFICIENTE", externa.pesquisadoEm(),
                    fontesNaoConcluidas(externa.fontes(), motivo), List.of(), List.of(motivo),
                    precoInterno == null ? QualidadeResultado.INSUFICIENTE : QualidadeResultado.PARCIAL, metricas);
        } catch (RuntimeException exception) {
            log.warn("Interpretação de ofertas falhou sem código controlado: tipo={} fontes={}",
                    exception.getClass().getSimpleName(), externa.fontes().size());
            String motivo = "As fontes foram preservadas, mas não foi possível validar seus preços com segurança.";
            return new Resultado(materiaPrimaId, materia.getNome(), unidade, quantidade, precoInterno, custo(precoInterno, quantidade),
                    null, null, null, null, "INSUFICIENTE", externa.pesquisadoEm(),
                    fontesNaoConcluidas(externa.fontes(), motivo), List.of(), List.of(motivo),
                    precoInterno == null ? QualidadeResultado.INSUFICIENTE : QualidadeResultado.PARCIAL, metricas);
        }

        java.util.LinkedHashMap<String, Oferta> ofertasUnicas = new java.util.LinkedHashMap<>();
        List<String> avisos = new ArrayList<>(externa.avisos());
        for (var interpretada : interpretacao.ofertas()) {
            Oferta oferta = normalizar(interpretada, unidade, quantidade, metricas.consumoMedioMensal());
            if (oferta == null) avisos.add(interpretada.fonte().dominio()
                    + ": oferta ignorada por preço ambíguo, vencido ou unidade incompatível.");
            else ofertasUnicas.putIfAbsent(oferta.url() + "|" + oferta.precoUnitario() + "|"
                    + oferta.quantidadeCalculada() + "|" + oferta.pedidoMinimo(), oferta);
        }
        List<Oferta> ofertas = new ArrayList<>(ofertasUnicas.values());
        ofertas.sort(Comparator.comparing((Oferta o) -> !o.status().contains(StatusOferta.COMPATIVEL_COM_QUANTIDADE))
                .thenComparing(Oferta::precoUnitario));
        if (ofertas.size() > 5) ofertas = new ArrayList<>(ofertas.subList(0, 5));
        long fontesIncompletas = interpretacao.fontes().stream()
                .filter(f -> f.status() != ResultadoFontePesquisa.Status.VALIDADA).count();
        if (fontesIncompletas > 0) avisos.add(fontesIncompletas
                + " fonte(s) não foram usadas; a conclusão considera somente ofertas validadas.");
        Oferta melhorOferta = ofertas.stream()
                .filter(o -> o.status().contains(StatusOferta.COMPATIVEL_COM_QUANTIDADE))
                .min(Comparator.comparing(Oferta::custoTotal)).orElse(null);
        BigDecimal custoAtual = custo(precoInterno, quantidade);
        BigDecimal melhor = melhorOferta == null ? null : melhorOferta.custoTotal();
        BigDecimal diferenca = custoAtual == null || melhor == null ? null
                : melhor.subtract(custoAtual).setScale(2, RoundingMode.HALF_UP);
        BigDecimal economia = diferenca == null ? null : diferenca.negate().max(BigDecimal.ZERO);
        BigDecimal percentual = diferenca == null || custoAtual.signum() == 0 ? null
                : diferenca.abs().divide(custoAtual, 4, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP);
        String situacao = diferenca == null
                ? ofertas.isEmpty() ? "INSUFICIENTE" : "SOMENTE_PEDIDO_MINIMO_MAIOR"
                : diferenca.signum() > 0 ? "CUSTO_INTERNO_MENOR"
                : diferenca.signum() < 0 ? "OFERTA_EXTERNA_MENOR" : "EQUIVALENTE";
        avisos.add("Frete ausente não foi estimado; confirme frete, validade e pedido mínimo antes de decidir.");
        QualidadeResultado qualidade = precoInterno != null && !ofertas.isEmpty()
                ? QualidadeResultado.PARCIAL : QualidadeResultado.INSUFICIENTE;
        log.info("evento=CALCULOS_CONCLUIDOS tipo=COMPARACAO_MERCADO ofertas={} status={}",
                ofertas.size(), situacao);
        return new Resultado(materiaPrimaId, materia.getNome(), unidade, quantidade, precoInterno, custoAtual, melhor, economia,
                diferenca, percentual, situacao, externa.pesquisadoEm(), interpretacao.fontes(),
                List.copyOf(ofertas), List.copyOf(avisos), qualidade, metricas);
    }

    /** Compatibilidade para chamadas internas antigas, em que usuário e empresa eram o mesmo escopo. */
    public Resultado comparar(Long usuarioId, Long materiaPrimaId, LocalDate inicio, LocalDate fim,
            String unidade, BigDecimal quantidade, String cidade, String uf) {
        return comparar(usuarioId, usuarioId, materiaPrimaId, inicio, fim, unidade, quantidade, cidade, uf);
    }

    private Resultado resultadoInterno(Long materiaPrimaId, String materiaPrima, String unidade, BigDecimal quantidade,
            BigDecimal precoInterno, HistoricoPrecosInsumoService.Resultado metricas, String aviso) {
        return new Resultado(materiaPrimaId, materiaPrima, unidade, quantidade, precoInterno, custo(precoInterno, quantidade),
                null, null, null, null, "INSUFICIENTE", java.time.Instant.now(clock), List.of(), List.of(),
                List.of(aviso), precoInterno == null ? QualidadeResultado.INSUFICIENTE : QualidadeResultado.PARCIAL,
                metricas);
    }

    private BigDecimal custo(BigDecimal unitario, BigDecimal quantidade) {
        return unitario == null || quantidade == null ? null
                : unitario.multiply(quantidade).setScale(2, RoundingMode.HALF_UP);
    }

    private String motivoFalhaInterpretacao(OrquestradorException exception, int fontes) {
        return switch (exception.getCodigo()) {
            case LIMITE_EXCEDIDO -> "Encontrei " + fontes + " fontes, mas o limite do OpenRouter foi atingido durante a validação.";
            case TIMEOUT -> "Encontrei " + fontes + " fontes, mas o OpenRouter demorou além do limite para validar os preços.";
            case PLANO_INVALIDO -> "Encontrei " + fontes + " fontes, mas os preços não vieram no formato seguro esperado.";
            case PROVEDOR_INDISPONIVEL -> "Encontrei " + fontes + " fontes, mas o OpenRouter está temporariamente indisponível.";
            default -> "Encontrei fontes, mas não foi possível validar seus preços com segurança.";
        };
    }

    private Oferta normalizar(InterpretadorOfertasMercado.OfertaInterpretada interpretada,
            String unidadeAlvo, BigDecimal quantidadeAlvo, BigDecimal consumoMensal) {
        var dados = interpretada.dados();
        if (dados.validade() != null && dados.validade().isBefore(LocalDate.now(clock))) return null;
        ExtracaoOfertasMercado.Unidade alvo = unidade(unidadeAlvo);
        if (alvo == null) return null;
        if (!evidenciaCompativelComUnidade(dados.evidenciaPreco(), alvo)) return null;
        BigDecimal unitario;
        if (dados.tipoPreco() == ExtracaoOfertasMercado.TipoPreco.UNITARIO) {
            BigDecimal fator = converter(BigDecimal.ONE, dados.unidadePreco(), alvo);
            if (fator == null || fator.signum() == 0) return null;
            unitario = dados.precoAnunciado().divide(fator, 6, RoundingMode.HALF_UP);
        } else {
            BigDecimal embalagem = converter(dados.quantidadeEmbalagem(), dados.unidadeEmbalagem(), alvo);
            if (embalagem == null || embalagem.signum() <= 0) return null;
            unitario = dados.precoAnunciado().divide(embalagem, 6, RoundingMode.HALF_UP);
        }
        BigDecimal minimo = dados.pedidoMinimo() == null ? null
                : converter(dados.pedidoMinimo(), dados.unidadePedidoMinimo(), alvo);
        if (dados.pedidoMinimo() != null && minimo == null) return null;
        BigDecimal embalagem = dados.quantidadeEmbalagem() == null ? null
                : converter(dados.quantidadeEmbalagem(), dados.unidadeEmbalagem(), alvo);
        if (dados.quantidadeEmbalagem() != null && embalagem == null) return null;
        BigDecimal minimoEfetivo = maior(minimo, embalagem);
        BigDecimal quantidadeCompra = quantidadeAlvo;
        if (embalagem != null) quantidadeCompra = quantidadeAlvo.divide(embalagem, 0, RoundingMode.CEILING)
                .multiply(embalagem);
        if (minimoEfetivo != null && minimoEfetivo.compareTo(quantidadeCompra) > 0)
            quantidadeCompra = minimoEfetivo;
        BigDecimal frete = dados.frete() == null ? BigDecimal.ZERO : dados.frete();
        BigDecimal custoMercadoria = unitario.multiply(quantidadeCompra);
        BigDecimal custoTotal = custoMercadoria.add(frete).setScale(2, RoundingMode.HALF_UP);
        BigDecimal mesesCobertura = minimoEfetivo == null || consumoMensal == null || consumoMensal.signum() <= 0 ? null
                : minimoEfetivo.divide(consumoMensal, 2, RoundingMode.HALF_UP);
        EnumSet<StatusOferta> status = EnumSet.noneOf(StatusOferta.class);
        if (minimoEfetivo == null || minimoEfetivo.compareTo(quantidadeAlvo) <= 0)
            status.add(StatusOferta.COMPATIVEL_COM_QUANTIDADE);
        else status.add(StatusOferta.PEDIDO_MINIMO_ACIMA_DA_QUANTIDADE);
        if (mesesCobertura != null && mesesCobertura.compareTo(MESES_ESTOQUE_ELEVADO) > 0)
            status.add(StatusOferta.ESTOQUE_EXCESSIVO_PROVAVEL);
        if (dados.frete() == null) status.add(StatusOferta.FRETE_DESCONHECIDO);
        else if (custoMercadoria.signum() > 0
                && dados.frete().divide(custoMercadoria, 4, RoundingMode.HALF_UP)
                        .compareTo(new BigDecimal("0.20")) > 0)
            status.add(StatusOferta.FRETE_ALTO);
        if (dados.confianca() == ExtracaoOfertasMercado.Confianca.BAIXA)
            status.add(StatusOferta.INFORMACOES_INSUFICIENTES);
        return new Oferta(interpretada.fonte().titulo(), interpretada.fonte().url().toString(),
                interpretada.fonte().dominio(), unitario.setScale(4, RoundingMode.HALF_UP), quantidadeCompra,
                custoTotal, dados.frete() != null, minimoEfetivo,
                status.contains(StatusOferta.COMPATIVEL_COM_QUANTIDADE), dados.localizacao(), dados.validade(),
                dados.evidenciaPreco(), dados.evidenciaPedidoMinimo(), dados.confianca().name(),
                mesesCobertura, List.copyOf(status), dados.marca(), dados.fornecedor());
    }

    /**
     * A unidade extraída pela IA não prevalece sobre a evidência copiada da fonte.
     * Se a evidência explicita massa para uma consulta em volume (ou vice-versa),
     * a oferta é ambígua e não participa dos cálculos.
     */
    private boolean evidenciaCompativelComUnidade(String evidencia, ExtracaoOfertasMercado.Unidade alvo) {
        if (evidencia == null || evidencia.isBlank()) return true;
        Set<GrupoUnidade> grupos = new HashSet<>();
        var matcher = UNIDADE_EXPLICITA_EVIDENCIA.matcher(evidencia);
        while (matcher.find()) {
            ExtracaoOfertasMercado.Unidade encontrada = unidade(matcher.group(1));
            if (encontrada != null) grupos.add(grupo(encontrada));
        }
        if (grupos.isEmpty()) return true;
        return grupos.size() == 1 && grupos.contains(grupo(alvo));
    }

    private GrupoUnidade grupo(ExtracaoOfertasMercado.Unidade unidade) {
        return switch (unidade) {
            case KG, G -> GrupoUnidade.MASSA;
            case L, ML -> GrupoUnidade.VOLUME;
            case UNIDADE -> GrupoUnidade.CONTAGEM;
        };
    }

    private enum GrupoUnidade { MASSA, VOLUME, CONTAGEM }

    private BigDecimal maior(BigDecimal primeiro, BigDecimal segundo) {
        if (primeiro == null) return segundo;
        if (segundo == null) return primeiro;
        return primeiro.max(segundo);
    }

    private ExtracaoOfertasMercado.Unidade unidade(String valor) {
        try { return ExtracaoOfertasMercado.Unidade.valueOf(valor.trim().toUpperCase()); }
        catch (RuntimeException exception) { return null; }
    }

    private BigDecimal converter(BigDecimal valor, ExtracaoOfertasMercado.Unidade origem,
            ExtracaoOfertasMercado.Unidade alvo) {
        if (valor == null || origem == null || alvo == null) return null;
        if (origem == alvo) return valor;
        if (origem == ExtracaoOfertasMercado.Unidade.G && alvo == ExtracaoOfertasMercado.Unidade.KG)
            return valor.divide(BigDecimal.valueOf(1000), 6, RoundingMode.HALF_UP);
        if (origem == ExtracaoOfertasMercado.Unidade.KG && alvo == ExtracaoOfertasMercado.Unidade.G)
            return valor.multiply(BigDecimal.valueOf(1000));
        if (origem == ExtracaoOfertasMercado.Unidade.ML && alvo == ExtracaoOfertasMercado.Unidade.L)
            return valor.divide(BigDecimal.valueOf(1000), 6, RoundingMode.HALF_UP);
        if (origem == ExtracaoOfertasMercado.Unidade.L && alvo == ExtracaoOfertasMercado.Unidade.ML)
            return valor.multiply(BigDecimal.valueOf(1000));
        return null;
    }

    private List<ResultadoFontePesquisa> fontesNaoConcluidas(List<FontePesquisaPreco> fontes, String motivo) {
        List<ResultadoFontePesquisa> resultado = new ArrayList<>();
        for (int i = 0; i < fontes.size(); i++) {
            var fonte = fontes.get(i);
            resultado.add(new ResultadoFontePesquisa("fonte-" + (i + 1), fonte.titulo(), fonte.url().toString(),
                    fonte.dominio(), ResultadoFontePesquisa.Status.NAO_CONCLUIDA, motivo));
        }
        return List.copyOf(resultado);
    }

    private List<ResultadoFontePesquisa> fontesDerivadas(List<FontePesquisaPreco> fontes,
            List<InterpretadorOfertasMercado.OfertaInterpretada> ofertas) {
        List<ResultadoFontePesquisa> resultado = new ArrayList<>();
        for (int i = 0; i < fontes.size(); i++) {
            var fonte = fontes.get(i);
            boolean validada = ofertas != null && ofertas.stream().anyMatch(item -> item.fonte().equals(fonte));
            resultado.add(new ResultadoFontePesquisa("fonte-" + (i + 1), fonte.titulo(), fonte.url().toString(),
                    fonte.dominio(), validada ? ResultadoFontePesquisa.Status.VALIDADA
                            : ResultadoFontePesquisa.Status.REJEITADA,
                    validada ? null : "Nenhuma oferta foi retornada pela interpretação."));
        }
        return List.copyOf(resultado);
    }

    public enum StatusOferta {
        COMPATIVEL_COM_QUANTIDADE,
        PEDIDO_MINIMO_ACIMA_DA_QUANTIDADE,
        ESTOQUE_EXCESSIVO_PROVAVEL,
        FRETE_DESCONHECIDO,
        FRETE_ALTO,
        INFORMACOES_INSUFICIENTES
    }

    public record Oferta(String titulo, String url, String dominio, BigDecimal precoUnitario,
            BigDecimal quantidadeCalculada, BigDecimal custoTotal, boolean freteIncluido,
            BigDecimal pedidoMinimo, boolean compativelQuantidadeAlvo, String localizacao,
            LocalDate validade, String evidenciaPreco, String evidenciaPedidoMinimo, String confianca,
            BigDecimal mesesCoberturaPedidoMinimo, List<StatusOferta> status, String marca, String fornecedor) {
        public Oferta(String titulo, String url, String dominio, BigDecimal precoUnitario,
                BigDecimal quantidadeCalculada, BigDecimal custoTotal, boolean freteIncluido,
                BigDecimal pedidoMinimo, boolean compativelQuantidadeAlvo, String localizacao,
                LocalDate validade, String evidenciaPreco, String evidenciaPedidoMinimo, String confianca) {
            this(titulo, url, dominio, precoUnitario, quantidadeCalculada, custoTotal, freteIncluido,
                    pedidoMinimo, compativelQuantidadeAlvo, localizacao, validade, evidenciaPreco,
                    evidenciaPedidoMinimo, confianca, null,
                    compativelQuantidadeAlvo ? List.of(StatusOferta.COMPATIVEL_COM_QUANTIDADE) : List.of(),
                    null, null);
        }
    }

    public record Resultado(Long materiaPrimaId, String materiaPrima, String unidade, BigDecimal quantidadeAlvo,
            BigDecimal precoInternoUnitario, BigDecimal custoInternoComparavel, BigDecimal menorCustoExterno,
            BigDecimal economiaEstimada, BigDecimal diferencaExternaMenosInterna,
            BigDecimal percentualDiferenca, String situacao, java.time.Instant pesquisadoEm,
            List<ResultadoFontePesquisa> fontes, List<Oferta> ofertas, List<String> avisos,
            QualidadeResultado qualidade, HistoricoPrecosInsumoService.Resultado metricasHistoricas) {
        public Resultado(Long materiaPrimaId, String unidade, BigDecimal quantidadeAlvo,
                BigDecimal precoInternoUnitario, BigDecimal custoInternoComparavel, BigDecimal menorCustoExterno,
                BigDecimal economiaEstimada, BigDecimal diferencaExternaMenosInterna,
                BigDecimal percentualDiferenca, String situacao, java.time.Instant pesquisadoEm,
                List<ResultadoFontePesquisa> fontes, List<Oferta> ofertas, List<String> avisos,
                QualidadeResultado qualidade) {
            this(materiaPrimaId, null, unidade, quantidadeAlvo, precoInternoUnitario, custoInternoComparavel,
                    menorCustoExterno, economiaEstimada, diferencaExternaMenosInterna, percentualDiferenca,
                    situacao, pesquisadoEm, fontes, ofertas, avisos, qualidade, null);
        }
        public Resultado(Long materiaPrimaId, String unidade, BigDecimal quantidadeAlvo,
                BigDecimal precoInternoUnitario, BigDecimal custoInternoComparavel, BigDecimal menorCustoExterno,
                BigDecimal economiaEstimada, BigDecimal diferencaExternaMenosInterna,
                BigDecimal percentualDiferenca, String situacao, java.time.Instant pesquisadoEm,
                List<Oferta> ofertas, List<String> avisos, QualidadeResultado qualidade) {
            this(materiaPrimaId, null, unidade, quantidadeAlvo, precoInternoUnitario, custoInternoComparavel,
                    menorCustoExterno, economiaEstimada, diferencaExternaMenosInterna, percentualDiferenca,
                    situacao, pesquisadoEm, List.of(), ofertas, avisos, qualidade, null);
        }
    }
}
