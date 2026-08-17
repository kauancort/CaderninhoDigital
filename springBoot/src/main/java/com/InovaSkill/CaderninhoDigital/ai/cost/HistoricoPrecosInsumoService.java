package com.InovaSkill.CaderninhoDigital.ai.cost;

import com.InovaSkill.CaderninhoDigital.repository.CompraMateriaPrimaRepository;
import com.InovaSkill.CaderninhoDigital.repository.ProducaoRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class HistoricoPrecosInsumoService {
    private final CompraMateriaPrimaRepository compras;
    private final ProducaoRepository producoes;

    public HistoricoPrecosInsumoService(CompraMateriaPrimaRepository compras, ProducaoRepository producoes) {
        this.compras = compras; this.producoes = producoes;
    }

    @Transactional(readOnly = true)
    public Resultado analisar(Long empresaId, Long materiaPrimaId, LocalDate dataReferencia) {
        LocalDate inicio6m = dataReferencia.minusMonths(6).plusDays(1);
        var itens = compras.historicoPrecos(empresaId, materiaPrimaId, inicio6m, dataReferencia);
        Janela seisMeses = janela(itens);
        Janela noventaDias = janela(itens.stream()
                .filter(i -> !i.getDataCompra().isBefore(dataReferencia.minusDays(89))).toList());
        Janela trintaDias = janela(itens.stream()
                .filter(i -> !i.getDataCompra().isBefore(dataReferencia.minusDays(29))).toList());
        UltimaCompra ultima = itens.isEmpty() ? null : new UltimaCompra(itens.getFirst().getDataCompra(),
                itens.getFirst().getQuantidade(), itens.getFirst().getValorUnitario(), itens.getFirst().getValorTotal());
        BigDecimal consumo90 = producoes.consumoMateriaPrima(empresaId, materiaPrimaId,
                dataReferencia.minusDays(89), dataReferencia);
        BigDecimal consumoMedio = consumo90 == null ? null
                : consumo90.divide(BigDecimal.valueOf(3), 3, RoundingMode.HALF_UP);
        String tendencia = tendencia(trintaDias.precoMedioPonderado(), noventaDias.precoMedioPonderado());
        return new Resultado(ultima, trintaDias, noventaDias, seisMeses, consumoMedio, tendencia);
    }

    private Janela janela(List<CompraMateriaPrimaRepository.HistoricoPrecoCompraProjection> itens) {
        BigDecimal quantidade = itens.stream().map(i -> zero(i.getQuantidade())).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal valor = itens.stream().map(i -> zero(i.getValorTotal())).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal media = quantidade.signum() == 0 ? null : valor.divide(quantidade, 4, RoundingMode.HALF_UP);
        BigDecimal minimo = itens.stream().map(CompraMateriaPrimaRepository.HistoricoPrecoCompraProjection::getValorUnitario)
                .filter(java.util.Objects::nonNull).min(BigDecimal::compareTo).orElse(null);
        BigDecimal maximo = itens.stream().map(CompraMateriaPrimaRepository.HistoricoPrecoCompraProjection::getValorUnitario)
                .filter(java.util.Objects::nonNull).max(BigDecimal::compareTo).orElse(null);
        return new Janela(media, minimo, maximo, quantidade, itens.size());
    }

    private String tendencia(BigDecimal recente, BigDecimal base) {
        if (recente == null || base == null || base.signum() == 0) return "DADOS_INSUFICIENTES";
        BigDecimal variacao = recente.subtract(base).divide(base, 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100));
        if (variacao.compareTo(BigDecimal.valueOf(2)) > 0) return "AUMENTO_RECENTE";
        if (variacao.compareTo(BigDecimal.valueOf(-2)) < 0) return "QUEDA_RECENTE";
        return "ESTAVEL";
    }

    private BigDecimal zero(BigDecimal valor) { return valor == null ? BigDecimal.ZERO : valor; }

    public record UltimaCompra(LocalDate data, BigDecimal quantidade, BigDecimal precoUnitario,
            BigDecimal valorTotal) {}
    public record Janela(BigDecimal precoMedioPonderado, BigDecimal menorPreco, BigDecimal maiorPreco,
            BigDecimal quantidadeComprada, int quantidadeRegistros) {}
    public record Resultado(UltimaCompra ultimaCompra, Janela ultimos30Dias, Janela ultimos90Dias,
            Janela ultimos6Meses, BigDecimal consumoMedioMensal, String tendencia) {}
}
