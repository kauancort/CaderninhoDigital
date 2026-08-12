package com.InovaSkill.CaderninhoDigital.ai.orchestration;

import com.InovaSkill.CaderninhoDigital.ai.contract.FerramentaPermitida;
import com.InovaSkill.CaderninhoDigital.ai.contract.ResultadoFerramenta;
import com.InovaSkill.CaderninhoDigital.dto.response.DadosAssistenteDTO;
import com.InovaSkill.CaderninhoDigital.exception.CodigoErroOrquestrador;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class MapeadorDadosAssistente {
    public DadosAssistenteDTO mapear(List<ResultadoFerramenta> resultados, Map<String, Object> consolidado) {
        if (resultados.size() == 1) return simples(resultados.getFirst());
        if (resultados.stream().allMatch(r -> r.ferramenta() == FerramentaPermitida.RESUMO_VENDAS)) {
            return temporal(consolidado);
        }
        return financeira(consolidado);
    }

    private DadosAssistenteDTO simples(ResultadoFerramenta resultado) {
        Map<String, Object> d = resultado.dadosAgregados();
        return switch (resultado.ferramenta()) {
            case RESUMO_ESTOQUE -> new DadosAssistenteDTO.Estoque("ESTOQUE", texto(d, "criterio"),
                    inteiro(d, "itensAvaliados"), inteiro(d, "itensCriticos"), itens(d.get("itens")),
                    inteiro(d, "dadosInsuficientes"));
            case RESUMO_VENDAS -> vendas(d);
            case RESUMO_GASTOS -> gastos(d);
            case RESUMO_RECEBIVEIS -> new DadosAssistenteDTO.Recebiveis("RECEBIVEIS",
                    decimal(d, "totalEmAberto"), decimal(d, "totalVencido"), decimal(d, "totalAVencer"),
                    longo(d, "quantidadeCobrancas"), faixa(d.get("atraso1a7Dias")), faixa(d.get("atraso8a30Dias")),
                    faixa(d.get("atrasoAcima30Dias")));
            case ANALISE_CUSTO_PRODUTO -> new DadosAssistenteDTO.CustoProduto("CUSTO_PRODUTO",
                    longoNulo(d.get("produtoId")), decimalNulo(d.get("custoAtualConhecido")),
                    decimalNulo(d.get("custoUnitarioFicha")), decimalNulo(d.get("rendimentoBase")),
                    inteiro(d, "componentes"), inteiro(d, "componentesSemCusto"), instante(d.get("dataBaseCusto")));
            case ANALISE_COMPRAS_INSUMO -> compras(d);
            case COMPARAR_PRECO_MERCADO -> mercado(d);
            default -> throw invalido();
        };
    }

    private DadosAssistenteDTO financeira(Map<String, Object> c) {
        Map<String, Object> comp = mapa(c.get("comparacao"));
        return new DadosAssistenteDTO.ComparacaoVendasGastos("COMPARACAO_VENDAS_GASTOS",
                vendas(mapa(c.get("vendas"))), gastos(mapa(c.get("gastos"))),
                new DadosAssistenteDTO.ComparacaoFinanceira(decimal(comp, "vendas"), decimal(comp, "gastos"),
                        decimal(comp, "diferenca"), decimalNulo(comp.get("percentualVendasSobreGastos"))));
    }

    private DadosAssistenteDTO temporal(Map<String, Object> c) {
        Map<String, Object> anterior = mapa(c.get("periodoAnterior"));
        Map<String, Object> atual = mapa(c.get("periodoAtual"));
        Map<String, Object> comp = mapa(c.get("comparacao"));
        return new DadosAssistenteDTO.ComparacaoVendasPeriodos("COMPARACAO_VENDAS_PERIODOS",
                new DadosAssistenteDTO.PeriodoVendas(data(anterior.get("inicio")), data(anterior.get("fim")),
                        vendas(mapa(anterior.get("dados")))),
                new DadosAssistenteDTO.PeriodoVendas(data(atual.get("inicio")), data(atual.get("fim")),
                        vendas(mapa(atual.get("dados")))),
                new DadosAssistenteDTO.ComparacaoTemporal(decimal(comp, "vendasPeriodoAnterior"),
                        decimal(comp, "vendasPeriodoAtual"), decimal(comp, "diferenca"),
                        decimalNulo(comp.get("variacaoPercentual")), longo(comp, "diasPeriodoAnterior"),
                        longo(comp, "diasPeriodoAtual"), Boolean.TRUE.equals(comp.get("coberturaEquivalente"))));
    }

    private DadosAssistenteDTO.Vendas vendas(Map<String, Object> d) {
        return new DadosAssistenteDTO.Vendas("VENDAS", decimal(d, "valorTotalValido"),
                longo(d, "quantidadeVendas"), decimal(d, "ticketMedio"), longo(d, "quantidadeItens"));
    }
    private DadosAssistenteDTO.Gastos gastos(Map<String, Object> d) {
        return new DadosAssistenteDTO.Gastos("GASTOS", decimal(d, "totalGastos"), longo(d, "quantidadeLancamentos"));
    }
    private DadosAssistenteDTO.ComprasInsumo compras(Map<String, Object> d) {
        @SuppressWarnings("unchecked")
        List<com.InovaSkill.CaderninhoDigital.ai.cost.AnaliseComprasInsumoService.Item> origem =
                d.get("itens") instanceof List<?> lista
                        ? (List<com.InovaSkill.CaderninhoDigital.ai.cost.AnaliseComprasInsumoService.Item>) lista
                        : List.of();
        List<DadosAssistenteDTO.ItemCompraInsumo> itens = origem.stream().map(i ->
                new DadosAssistenteDTO.ItemCompraInsumo(i.materiaPrimaId(), i.unidade(), i.quantidadeTotal(),
                        i.valorTotal(), i.precoMedioPonderado(), i.menorPreco(), i.maiorPreco(),
                        i.amplitudePrecoPercentual(), i.quantidadeCompras(), i.quantidadeMediaPorCompra(),
                        i.primeiraCompra(), i.ultimaCompra(), i.intervaloMedioDias(),
                        i.frequenciaObservada(), i.historicoSuficiente())).toList();
        var s = (com.InovaSkill.CaderninhoDigital.ai.cost.AnaliseComprasInsumoService.SimulacaoMensal)
                d.get("simulacaoMensal");
        var simulacao = new DadosAssistenteDTO.SimulacaoComprasMensal(s.pedidosSimulados(), s.custoHistorico(),
                s.custoSimuladoSemDesconto(), s.economiaComprovada(), s.economiaComprovavel(), s.limitacao());
        return new DadosAssistenteDTO.ComprasInsumo("COMPRAS_INSUMO", longoNulo(d.get("materiaPrimaId")),
                decimal(d, "valorTotal"), inteiro(d, "insumosAnalisados"), itens, simulacao);
    }
    private DadosAssistenteDTO.ComparacaoMercado mercado(Map<String,Object> d) {
        @SuppressWarnings("unchecked")
        List<com.InovaSkill.CaderninhoDigital.ai.search.ComparacaoMercadoService.Oferta> origem =
                d.get("ofertas") instanceof List<?> lista
                        ? (List<com.InovaSkill.CaderninhoDigital.ai.search.ComparacaoMercadoService.Oferta>) lista
                        : List.of();
        var ofertas = origem.stream().map(o -> new DadosAssistenteDTO.OfertaMercado(o.titulo(), o.url(),
                o.dominio(), o.precoUnitario(), o.quantidadeCalculada(), o.custoTotal(), o.freteIncluido())).toList();
        return new DadosAssistenteDTO.ComparacaoMercado("COMPARACAO_MERCADO", longoNulo(d.get("materiaPrimaId")),
                texto(d,"unidade"), decimalNulo(d.get("quantidadeAlvo")), decimalNulo(d.get("precoInternoUnitario")),
                decimalNulo(d.get("custoInternoComparavel")),
                decimalNulo(d.get("menorCustoExterno")), decimalNulo(d.get("economiaEstimada")),
                decimalNulo(d.get("diferencaExternaMenosInterna")),decimalNulo(d.get("percentualDiferenca")),
                texto(d,"situacao"),
                instante(d.get("pesquisadoEm")), ofertas);
    }
    private DadosAssistenteDTO.FaixaRecebiveis faixa(Object v) {
        Map<String,Object> d = mapa(v);
        return new DadosAssistenteDTO.FaixaRecebiveis(decimal(d, "valor"), longo(d, "quantidade"));
    }
    @SuppressWarnings("unchecked") private Map<String, Object> mapa(Object v) { if (v instanceof Map<?, ?> m) return (Map<String,Object>) m; throw invalido(); }
    private List<DadosAssistenteDTO.ItemEstoque> itens(Object v) {
        if (!(v instanceof List<?> lista)) return List.of();
        return lista.stream().map(item -> {
            if (item instanceof com.InovaSkill.CaderninhoDigital.ai.stock.ConsultaEstoqueCriticoService.Item i) {
                return new DadosAssistenteDTO.ItemEstoque(i.nome(), i.unidade(), i.quantidadeAtual(), i.estoqueMinimo());
            }
            throw invalido();
        }).toList();
    }
    private String texto(Map<String,Object> d, String k) { Object v=d.get(k); return v == null ? null : v.toString(); }
    private int inteiro(Map<String,Object> d,String k) { return (int) longo(d,k); }
    private long longo(Map<String,Object> d,String k) { Long v=longoNulo(d.get(k)); return v == null ? 0 : v; }
    private Long longoNulo(Object v) { return v instanceof Number n ? n.longValue() : null; }
    private BigDecimal decimal(Map<String,Object> d,String k) { BigDecimal v=decimalNulo(d.get(k)); return v == null ? BigDecimal.ZERO : v; }
    private BigDecimal decimalNulo(Object v) { return v instanceof BigDecimal b ? b : v instanceof Number n ? new BigDecimal(n.toString()) : null; }
    private LocalDate data(Object v) { return v instanceof LocalDate d ? d : v instanceof String s ? LocalDate.parse(s) : null; }
    private Instant instante(Object v) { return v instanceof Instant i ? i : v instanceof String s ? Instant.parse(s) : null; }
    private OrquestradorException invalido() { return new OrquestradorException(CodigoErroOrquestrador.ERRO_INTERNO, HttpStatus.INTERNAL_SERVER_ERROR, "Formato interno de resultado inválido"); }
}
