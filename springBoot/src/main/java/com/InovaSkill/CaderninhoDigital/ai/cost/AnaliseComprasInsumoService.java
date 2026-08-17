package com.InovaSkill.CaderninhoDigital.ai.cost;

import com.InovaSkill.CaderninhoDigital.ai.contract.QualidadeResultado;
import com.InovaSkill.CaderninhoDigital.exception.ResourceNotFoundException;
import com.InovaSkill.CaderninhoDigital.repository.CompraMateriaPrimaRepository;
import com.InovaSkill.CaderninhoDigital.repository.MateriaPrimaRepository;
import com.InovaSkill.CaderninhoDigital.repository.projection.AnaliseCompraInsumoProjection;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AnaliseComprasInsumoService {
    private final CompraMateriaPrimaRepository compras;
    private final MateriaPrimaRepository materias;

    public AnaliseComprasInsumoService(CompraMateriaPrimaRepository compras,
            MateriaPrimaRepository materias) {
        this.compras = compras; this.materias = materias;
    }

    @Transactional(readOnly = true)
    public Resultado analisar(Long empresaId, Long materiaPrimaId, LocalDate inicio, LocalDate fim) {
        List<Item> itens;
        if (materiaPrimaId != null) {
            var materia = materias.buscarAcessivelParaAnalise(materiaPrimaId, empresaId)
                    .orElseThrow(() -> new ResourceNotFoundException("Matéria-prima não encontrada"));
            itens = List.of(item(materiaPrimaId, materia.getUnidadeMedida(),
                    compras.analisarInsumo(materiaPrimaId, empresaId, inicio, fim), inicio, fim));
        } else {
            itens = compras.analisarInsumos(empresaId, inicio, fim).stream()
                    .map(r -> item(r.getMateriaPrimaId(), r.getUnidade(), r, inicio, fim)).toList();
        }
        BigDecimal total = itens.stream().map(Item::valorTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        long comprasDistintas = itens.stream().mapToLong(Item::quantidadeCompras).sum();
        boolean suficiente = !itens.isEmpty() && itens.stream().anyMatch(i -> i.quantidadeCompras() >= 2);
        var avisos = new ArrayList<String>();
        if (itens.isEmpty() || comprasDistintas == 0) avisos.add("Não há compras no período informado.");
        if (!suficiente) avisos.add("Histórico insuficiente para avaliar frequência e variação de preços.");
        avisos.add("Frete, desconto operacional, pedido mínimo e perdas não são registrados e não foram estimados.");
        avisos.add("A simulação mensal mantém quantidade e preços históricos; não representa promessa de economia.");
        int meses = Math.max(1, (int) Math.ceil((ChronoUnit.DAYS.between(inicio, fim) + 1) / 30.0));
        var simulacao = new SimulacaoMensal(meses, total, total, BigDecimal.ZERO, false,
                "Sem preço futuro, frete ou desconto comparável, não é possível afirmar economia.");
        return new Resultado(materiaPrimaId, inicio, fim, total, itens.size(), List.copyOf(itens), simulacao,
                List.copyOf(avisos), suficiente ? QualidadeResultado.PARCIAL : QualidadeResultado.INSUFICIENTE);
    }

    private Item item(Long id, String unidade, AnaliseCompraInsumoProjection r, LocalDate inicio, LocalDate fim) {
        BigDecimal quantidade = zero(r.getQuantidadeTotal());
        BigDecimal valor = zero(r.getValorTotal());
        long numero = r.getQuantidadeCompras() == null ? 0 : r.getQuantidadeCompras();
        BigDecimal medio = quantidade.signum() == 0 ? null : valor.divide(quantidade, 2, RoundingMode.HALF_UP);
        BigDecimal quantidadeMedia = numero == 0 ? null
                : quantidade.divide(BigDecimal.valueOf(numero), 3, RoundingMode.HALF_UP);
        Long intervalo = numero < 2 || r.getPrimeiraCompra() == null || r.getUltimaCompra() == null ? null
                : Math.max(1, Math.round((double) ChronoUnit.DAYS.between(r.getPrimeiraCompra(), r.getUltimaCompra())
                        / (numero - 1)));
        BigDecimal amplitude = percentualAmplitude(r.getMenorPreco(), r.getMaiorPreco());
        return new Item(id, unidade, quantidade, valor, medio, r.getMenorPreco(), r.getMaiorPreco(), amplitude,
                numero, quantidadeMedia, r.getPrimeiraCompra(), r.getUltimaCompra(), intervalo,
                frequencia(intervalo), numero >= 2);
    }

    private BigDecimal percentualAmplitude(BigDecimal minimo, BigDecimal maximo) {
        if (minimo == null || maximo == null || minimo.signum() <= 0) return null;
        return maximo.subtract(minimo).divide(minimo, 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP);
    }

    private String frequencia(Long dias) {
        if (dias == null) return "INSUFICIENTE";
        if (dias <= 10) return "SEMANAL";
        if (dias <= 20) return "QUINZENAL";
        if (dias <= 40) return "MENSAL";
        return "ESPORADICA";
    }

    private BigDecimal zero(BigDecimal valor) { return valor == null ? BigDecimal.ZERO : valor; }

    public record Item(Long materiaPrimaId, String unidade, BigDecimal quantidadeTotal, BigDecimal valorTotal,
            BigDecimal precoMedioPonderado, BigDecimal menorPreco, BigDecimal maiorPreco,
            BigDecimal amplitudePrecoPercentual, long quantidadeCompras, BigDecimal quantidadeMediaPorCompra,
            LocalDate primeiraCompra, LocalDate ultimaCompra, Long intervaloMedioDias,
            String frequenciaObservada, boolean historicoSuficiente) {}
    public record SimulacaoMensal(int pedidosSimulados, BigDecimal custoHistorico,
            BigDecimal custoSimuladoSemDesconto, BigDecimal economiaComprovada, boolean economiaComprovavel,
            String limitacao) {}
    public record Resultado(Long materiaPrimaId, LocalDate periodoInicio, LocalDate periodoFim,
            BigDecimal valorTotal, int insumosAnalisados, List<Item> itens, SimulacaoMensal simulacaoMensal,
            List<String> avisos, QualidadeResultado qualidade) {}
}
