package com.InovaSkill.CaderninhoDigital.ai.search;

import com.InovaSkill.CaderninhoDigital.ai.contract.QualidadeResultado;
import com.InovaSkill.CaderninhoDigital.ai.cost.AnaliseComprasInsumoService;
import com.InovaSkill.CaderninhoDigital.exception.ResourceNotFoundException;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import com.InovaSkill.CaderninhoDigital.repository.MateriaPrimaRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class ComparacaoMercadoService {
    private final AnaliseComprasInsumoService analiseInterna;
    private final MateriaPrimaRepository materias;
    private final PesquisaPrecosGateway pesquisa;
    private final InterpretadorOfertasMercado interpretador;
    private final Clock clock;

    public ComparacaoMercadoService(AnaliseComprasInsumoService analiseInterna,
            MateriaPrimaRepository materias, PesquisaPrecosGateway pesquisa,
            InterpretadorOfertasMercado interpretador, Clock clock) {
        this.analiseInterna = analiseInterna; this.materias = materias; this.pesquisa = pesquisa;
        this.interpretador = interpretador; this.clock = clock;
    }

    public Resultado comparar(Long usuarioId, Long materiaPrimaId, LocalDate inicio, LocalDate fim,
            String unidade, BigDecimal quantidade, String cidade, String uf) {
        var materia = materias.findById(materiaPrimaId)
                .orElseThrow(() -> new ResourceNotFoundException("Matéria-prima não encontrada"));
        if (!materia.getUnidadeMedida().equalsIgnoreCase(unidade)) {
            throw new IllegalArgumentException("Unidade não corresponde ao cadastro da matéria-prima");
        }
        var interna = analiseInterna.analisar(usuarioId, materiaPrimaId, inicio, fim);
        BigDecimal precoInterno = interna.itens().isEmpty() ? null : interna.itens().getFirst().precoMedioPonderado();
        ResultadoPesquisaPrecos externa;
        try {
            externa = pesquisa.pesquisar(new SolicitacaoPesquisaPrecos(
                    materia.getNome(), unidade, quantidade, cidade, uf));
        } catch (OrquestradorException e) {
            return new Resultado(materiaPrimaId, unidade, quantidade, precoInterno,
                    precoInterno == null ? null : precoInterno.multiply(quantidade).setScale(2, RoundingMode.HALF_UP),
                    null, null, null, null, "INSUFICIENTE", java.time.Instant.now(clock), List.of(),
                    List.of("Pesquisa externa indisponível; a análise interna foi preservada."),
                    precoInterno == null ? QualidadeResultado.INSUFICIENTE : QualidadeResultado.PARCIAL);
        }
        List<Oferta> ofertas = new ArrayList<>(); List<String> descartes = new ArrayList<>();
        InterpretadorOfertasMercado.ResultadoInterpretacao interpretacao;
        try {
            interpretacao = interpretador.interpretarDetalhado(externa.fontes(), materia.getNome(), usuarioId);
            // Mantém compatibilidade com integrações/fixtures que ainda implementam
            // apenas o contrato plano; o caminho principal sempre usa o detalhado.
            if (interpretacao == null) {
                List<InterpretadorOfertasMercado.OfertaInterpretada> ofertasLegadas =
                        interpretador.interpretar(externa.fontes(), materia.getNome(), usuarioId);
                interpretacao = new InterpretadorOfertasMercado.ResultadoInterpretacao(
                        ofertasLegadas == null ? List.of() : List.copyOf(ofertasLegadas),
                        fontesDerivadas(externa.fontes(), ofertasLegadas));
            }
        } catch (OrquestradorException exception) {
            log.warn("Interpretação de ofertas não concluída: codigo={} fontes={}",
                    exception.getCodigo(), externa.fontes().size());
            String motivo = switch (exception.getCodigo()) {
                case LIMITE_EXCEDIDO -> "Encontrei " + externa.fontes().size()
                        + " fontes, mas não consegui confirmar os preços porque o limite de uso do serviço de IA do OpenRouter foi atingido. "
                        + "Os valores não foram comparados para evitar uma resposta incorreta. Tente novamente mais tarde.";
                case TIMEOUT -> "Encontrei " + externa.fontes().size()
                        + " fontes, mas o serviço de IA do OpenRouter demorou além do limite ao interpretar os preços. "
                        + "Os valores não foram comparados para evitar uma resposta incorreta. Tente novamente.";
                case PLANO_INVALIDO -> "Encontrei " + externa.fontes().size()
                        + " fontes, mas o serviço de IA não conseguiu organizar os preços e as unidades no formato esperado. "
                        + "Os valores não foram comparados para evitar uma resposta incorreta.";
                case PROVEDOR_INDISPONIVEL -> "Encontrei " + externa.fontes().size()
                        + " fontes, mas o serviço de IA do OpenRouter está temporariamente indisponível. "
                        + "Os valores não foram comparados para evitar uma resposta incorreta. Tente novamente mais tarde.";
                default -> "Encontrei " + externa.fontes().size()
                        + " fontes, mas não foi possível validar seus preços com segurança. "
                        + "Os valores não foram comparados para evitar uma resposta incorreta.";
            };
            return new Resultado(materiaPrimaId, unidade, quantidade, precoInterno,
                    precoInterno == null ? null : precoInterno.multiply(quantidade).setScale(2, RoundingMode.HALF_UP),
                    null, null, null, null, "INSUFICIENTE", externa.pesquisadoEm(), fontesNaoConcluidas(externa.fontes(), motivo), List.of(),
                    List.of(motivo),
                    precoInterno == null ? QualidadeResultado.INSUFICIENTE : QualidadeResultado.PARCIAL);
        } catch (RuntimeException exception) {
            log.warn("Interpretação de ofertas falhou sem código controlado: tipo={} fontes={}",
                    exception.getClass().getSimpleName(), externa.fontes().size());
            String motivo = "Encontrei " + externa.fontes().size()
                    + " fontes, mas não foi possível validar seus preços com segurança. "
                    + "Os valores não foram comparados para evitar uma resposta incorreta.";
            return new Resultado(materiaPrimaId, unidade, quantidade, precoInterno,
                    precoInterno == null ? null : precoInterno.multiply(quantidade).setScale(2, RoundingMode.HALF_UP),
                    null, null, null, null, "INSUFICIENTE", externa.pesquisadoEm(), fontesNaoConcluidas(externa.fontes(), motivo), List.of(),
                    List.of(motivo),
                    precoInterno == null ? QualidadeResultado.INSUFICIENTE : QualidadeResultado.PARCIAL);
        }
        for (var interpretada : interpretacao.ofertas()) {
            var oferta = normalizar(interpretada, unidade, quantidade);
            if (oferta == null) descartes.add(interpretada.fonte().dominio()
                    + ": oferta ambígua ou unidade incompatível.");
            else ofertas.add(oferta);
        }
        ofertas.sort(java.util.Comparator.comparing((Oferta o) -> !o.compativelQuantidadeAlvo())
                .thenComparing(Oferta::custoTotal));
        List<String> avisos = new ArrayList<>(externa.avisos()); avisos.addAll(descartes);
        BigDecimal melhor = ofertas.stream().filter(Oferta::compativelQuantidadeAlvo)
                .map(Oferta::custoTotal).findFirst().orElse(null);
        BigDecimal custoAtual = precoInterno == null ? null : precoInterno.multiply(quantidade).setScale(2, RoundingMode.HALF_UP);
        boolean coberturaIncompleta = interpretacao.fontes().stream()
                .anyMatch(fonte -> fonte.status() == ResultadoFontePesquisa.Status.NAO_CONCLUIDA);
        if (coberturaIncompleta) {
            avisos.add(0, "Nem todas as fontes pesquisadas foram validadas; os valores externos foram mantidos apenas para consulta e não houve conclusão de melhor oferta ou economia.");
        }
        if (coberturaIncompleta) melhor = null;
        BigDecimal economia = custoAtual == null || melhor == null ? null
                : custoAtual.subtract(melhor).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
        BigDecimal diferenca = custoAtual == null || melhor == null ? null
                : melhor.subtract(custoAtual).setScale(2,RoundingMode.HALF_UP);
        BigDecimal percentual = diferenca == null || custoAtual.signum()==0 ? null
                : diferenca.abs().divide(custoAtual,4,RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100))
                        .setScale(2,RoundingMode.HALF_UP);
        String situacao = coberturaIncompleta || diferenca == null ? "INSUFICIENTE" : diferenca.signum()>0 ? "CUSTO_INTERNO_MENOR"
                : diferenca.signum()<0 ? "OFERTA_EXTERNA_MENOR" : "EQUIVALENTE";
        avisos.add("Frete e pedido mínimo entram no cálculo somente quando aparecem explicitamente na fonte; valores ausentes não foram estimados.");
        QualidadeResultado qualidade = !coberturaIncompleta && precoInterno != null && !ofertas.isEmpty()
                ? QualidadeResultado.PARCIAL : QualidadeResultado.INSUFICIENTE;
        return new Resultado(materiaPrimaId, unidade, quantidade, precoInterno, custoAtual, melhor, economia,
                diferenca, percentual, situacao,
                externa.pesquisadoEm(), interpretacao.fontes(), List.copyOf(ofertas), List.copyOf(avisos), qualidade);
    }

    private List<ResultadoFontePesquisa> fontesNaoConcluidas(List<FontePesquisaPreco> fontes, String motivo) {
        List<ResultadoFontePesquisa> resultado = new ArrayList<>();
        for (int i = 0; i < fontes.size(); i++) {
            FontePesquisaPreco fonte = fontes.get(i);
            resultado.add(new ResultadoFontePesquisa("fonte-" + (i + 1), fonte.titulo(), fonte.url().toString(),
                    fonte.dominio(), ResultadoFontePesquisa.Status.NAO_CONCLUIDA, motivo));
        }
        return List.copyOf(resultado);
    }

    private List<ResultadoFontePesquisa> fontesDerivadas(List<FontePesquisaPreco> fontes,
            List<InterpretadorOfertasMercado.OfertaInterpretada> ofertas) {
        List<ResultadoFontePesquisa> resultado = new ArrayList<>();
        for (int i = 0; i < fontes.size(); i++) {
            FontePesquisaPreco fonte = fontes.get(i);
            boolean validada = ofertas != null && ofertas.stream().anyMatch(item -> item.fonte().equals(fonte));
            resultado.add(new ResultadoFontePesquisa("fonte-" + (i + 1), fonte.titulo(), fonte.url().toString(),
                    fonte.dominio(), validada ? ResultadoFontePesquisa.Status.VALIDADA
                            : ResultadoFontePesquisa.Status.REJEITADA,
                    validada ? null : "Nenhuma oferta foi retornada pela interpretação."));
        }
        return List.copyOf(resultado);
    }

    private Oferta normalizar(InterpretadorOfertasMercado.OfertaInterpretada interpretada,
            String unidadeAlvo, BigDecimal quantidadeAlvo) {
        var dados = interpretada.dados();
        if (dados.validade() != null && dados.validade().isBefore(LocalDate.now(clock))) return null;
        ExtracaoOfertasMercado.Unidade alvo = unidade(unidadeAlvo);
        if (alvo == null) return null;
        BigDecimal unitario;
        if (dados.tipoPreco() == ExtracaoOfertasMercado.TipoPreco.UNITARIO) {
            BigDecimal fator = fatorParaUnidadeAlvo(dados.unidadePreco(), alvo);
            if (fator == null) return null;
            unitario = dados.precoAnunciado().divide(fator, 6, RoundingMode.HALF_UP);
        } else {
            if (dados.quantidadeEmbalagem() == null || dados.unidadeEmbalagem() == null) return null;
            BigDecimal embalagem = converter(dados.quantidadeEmbalagem(), dados.unidadeEmbalagem(), alvo);
            if (embalagem == null || embalagem.signum() <= 0) return null;
            unitario = dados.precoAnunciado().divide(embalagem, 6, RoundingMode.HALF_UP);
        }
        BigDecimal minimo = dados.pedidoMinimo() == null ? null
                : converter(dados.pedidoMinimo(), dados.unidadePedidoMinimo(), alvo);
        if (dados.pedidoMinimo() != null && minimo == null) return null;
        boolean compativel = minimo == null || minimo.compareTo(quantidadeAlvo) <= 0;
        BigDecimal frete = dados.frete() == null ? BigDecimal.ZERO : dados.frete();
        BigDecimal custo = unitario.multiply(quantidadeAlvo).add(frete).setScale(2, RoundingMode.HALF_UP);
        return new Oferta(interpretada.fonte().titulo(), interpretada.fonte().url().toString(),
                interpretada.fonte().dominio(), unitario.setScale(4, RoundingMode.HALF_UP), quantidadeAlvo,
                custo, dados.frete() != null, minimo, compativel, dados.localizacao(),
                dados.validade(), dados.evidenciaPreco(), dados.evidenciaPedidoMinimo(), dados.confianca().name());
    }

    private ExtracaoOfertasMercado.Unidade unidade(String unidade) {
        try { return ExtracaoOfertasMercado.Unidade.valueOf(unidade.trim().toUpperCase()); }
        catch (RuntimeException exception) { return null; }
    }

    private BigDecimal fatorParaUnidadeAlvo(ExtracaoOfertasMercado.Unidade origem,
            ExtracaoOfertasMercado.Unidade alvo) {
        return converter(BigDecimal.ONE, origem, alvo);
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

    public record Oferta(String titulo, String url, String dominio, BigDecimal precoUnitario,
            BigDecimal quantidadeCalculada, BigDecimal custoTotal, boolean freteIncluido,
            BigDecimal pedidoMinimo, boolean compativelQuantidadeAlvo, String localizacao,
            LocalDate validade, String evidenciaPreco, String evidenciaPedidoMinimo, String confianca) {}
    public record Resultado(Long materiaPrimaId, String unidade, BigDecimal quantidadeAlvo,
            BigDecimal precoInternoUnitario, BigDecimal custoInternoComparavel, BigDecimal menorCustoExterno,
            BigDecimal economiaEstimada, BigDecimal diferencaExternaMenosInterna,
            BigDecimal percentualDiferenca, String situacao,
            java.time.Instant pesquisadoEm, List<ResultadoFontePesquisa> fontes, List<Oferta> ofertas,
            List<String> avisos, QualidadeResultado qualidade) {
        public Resultado(Long materiaPrimaId, String unidade, BigDecimal quantidadeAlvo,
                BigDecimal precoInternoUnitario, BigDecimal custoInternoComparavel, BigDecimal menorCustoExterno,
                BigDecimal economiaEstimada, BigDecimal diferencaExternaMenosInterna,
                BigDecimal percentualDiferenca, String situacao,
                java.time.Instant pesquisadoEm, List<Oferta> ofertas, List<String> avisos,
                QualidadeResultado qualidade) {
            this(materiaPrimaId, unidade, quantidadeAlvo, precoInternoUnitario, custoInternoComparavel,
                    menorCustoExterno, economiaEstimada, diferencaExternaMenosInterna, percentualDiferenca,
                    situacao, pesquisadoEm, List.of(), ofertas, avisos, qualidade);
        }
    }
}
