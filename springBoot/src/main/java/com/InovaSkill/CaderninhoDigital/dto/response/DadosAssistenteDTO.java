package com.InovaSkill.CaderninhoDigital.dto.response;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public sealed interface DadosAssistenteDTO permits DadosAssistenteDTO.Estoque,
        DadosAssistenteDTO.Vendas, DadosAssistenteDTO.Gastos, DadosAssistenteDTO.Recebiveis,
        DadosAssistenteDTO.CustoProduto, DadosAssistenteDTO.ComprasInsumo,
        DadosAssistenteDTO.MargemProduto, DadosAssistenteDTO.AnaliseComposta,
        DadosAssistenteDTO.ComparacaoVendasGastos, DadosAssistenteDTO.ComparacaoVendasPeriodos,
        DadosAssistenteDTO.ComparacaoMercado, DadosAssistenteDTO.RentabilidadeProduto {

    String tipo();

    record ItemEstoque(String nome, String unidade, BigDecimal quantidadeAtual, BigDecimal estoqueMinimo) {}

    record Estoque(String tipo, String criterio, int itensAvaliados, int itensCriticos,
            List<ItemEstoque> itens, int dadosInsuficientes) implements DadosAssistenteDTO {}

    record Vendas(String tipo, BigDecimal valorTotalValido, long quantidadeVendas,
            BigDecimal ticketMedio, long quantidadeItens) implements DadosAssistenteDTO {}

    record Gastos(String tipo, BigDecimal totalGastos, long quantidadeLancamentos) implements DadosAssistenteDTO {}

    record FaixaRecebiveis(BigDecimal valor, long quantidade) {}

    record Recebiveis(String tipo, BigDecimal totalEmAberto, BigDecimal totalVencido,
            BigDecimal totalAVencer, long quantidadeCobrancas, FaixaRecebiveis atraso1a7Dias,
            FaixaRecebiveis atraso8a30Dias, FaixaRecebiveis atrasoAcima30Dias) implements DadosAssistenteDTO {}

    record CustoProduto(String tipo, Long produtoId, BigDecimal custoAtualConhecido,
            BigDecimal custoUnitarioFicha, BigDecimal rendimentoBase, int componentes,
            int componentesSemCusto, Instant dataBaseCusto) implements DadosAssistenteDTO {}

    record ComponenteCusto(String nome, BigDecimal custoConhecido, BigDecimal participacaoPercentual) {}

    record MargemProduto(String tipo, Long produtoId, String produto, BigDecimal quantidadeProduzida,
            BigDecimal custoProducaoConhecido, BigDecimal custoUnitarioConhecido,
            BigDecimal quantidadeVendida, BigDecimal receitaVendas, BigDecimal precoMedioVenda,
            BigDecimal margemBrutaConhecidaUnitaria, BigDecimal margemBrutaConhecidaTotal,
            String situacao, List<ComponenteCusto> componentes,
            List<String> custosNaoModelados) implements DadosAssistenteDTO {}

    record RentabilidadeProduto(String tipo, Long produtoId, String produto, LocalDate periodoInicio,
            LocalDate periodoFim, Object custo, Object vendas, List<?> modalidades,
            Object principalComponenteCusto, Object mercado, Object estimativaCustosIndiretos, String situacao,
            String informacaoNecessaria) implements DadosAssistenteDTO {}

    record AnaliseComposta(String tipo, java.util.Map<String, Object> resultados) implements DadosAssistenteDTO {}

    record ItemCompraInsumo(Long materiaPrimaId, String unidade, BigDecimal quantidadeTotal,
            BigDecimal valorTotal, BigDecimal precoMedioPonderado, BigDecimal menorPreco,
            BigDecimal maiorPreco, BigDecimal amplitudePrecoPercentual, long quantidadeCompras,
            BigDecimal quantidadeMediaPorCompra, LocalDate primeiraCompra, LocalDate ultimaCompra,
            Long intervaloMedioDias, String frequenciaObservada, boolean historicoSuficiente) {}

    record SimulacaoComprasMensal(int pedidosSimulados, BigDecimal custoHistorico,
            BigDecimal custoSimuladoSemDesconto, BigDecimal economiaComprovada,
            boolean economiaComprovavel, String limitacao) {}

    record ComprasInsumo(String tipo, Long materiaPrimaId, BigDecimal valorTotal,
            int insumosAnalisados, List<ItemCompraInsumo> itens,
            SimulacaoComprasMensal simulacaoMensal) implements DadosAssistenteDTO {}

    record OfertaMercado(String titulo, String url, String dominio, BigDecimal precoUnitario,
            BigDecimal quantidadeCalculada, BigDecimal custoTotal, boolean freteIncluido,
            BigDecimal pedidoMinimo, boolean compativelQuantidadeAlvo, String localizacao,
            LocalDate validade, String evidenciaPreco, String evidenciaPedidoMinimo, String confianca,
            BigDecimal mesesCoberturaPedidoMinimo, List<String> status, String marca, String fornecedor) {}

    record MetricasHistoricasCompra(BigDecimal ultimaCompraPreco, LocalDate ultimaCompraData,
            BigDecimal media30Dias, BigDecimal media90Dias, BigDecimal media6Meses,
            BigDecimal menorPreco6Meses, BigDecimal maiorPreco6Meses,
            BigDecimal quantidade6Meses, BigDecimal consumoMedioMensal, String tendencia) {}

    record FonteMercado(String fonteId, String titulo, String url, String dominio,
            String status, String motivo) {}

    record ComparacaoMercado(String tipo, Long materiaPrimaId, String materiaPrima, String unidade, BigDecimal quantidadeAlvo,
            BigDecimal precoInternoUnitario, BigDecimal custoInternoComparavel, BigDecimal menorCustoExterno,
            BigDecimal economiaEstimada, BigDecimal diferencaExternaMenosInterna,
            BigDecimal percentualDiferenca, String situacao,
            Instant pesquisadoEm, MetricasHistoricasCompra metricasHistoricas,
            List<FonteMercado> fontes, List<OfertaMercado> ofertas) implements DadosAssistenteDTO {}

    record ComparacaoFinanceira(BigDecimal vendas, BigDecimal gastos, BigDecimal diferenca,
            BigDecimal percentualVendasSobreGastos) {}

    record ComparacaoVendasGastos(String tipo, Vendas vendas, Gastos gastos,
            ComparacaoFinanceira comparacao) implements DadosAssistenteDTO {}

    record PeriodoVendas(LocalDate inicio, LocalDate fim, Vendas dados) {}

    record ComparacaoTemporal(BigDecimal vendasPeriodoAnterior, BigDecimal vendasPeriodoAtual,
            BigDecimal diferenca, BigDecimal variacaoPercentual, long diasPeriodoAnterior,
            long diasPeriodoAtual, boolean coberturaEquivalente) {}

    record ComparacaoVendasPeriodos(String tipo, PeriodoVendas periodoAnterior, PeriodoVendas periodoAtual,
            ComparacaoTemporal comparacao) implements DadosAssistenteDTO {}
}
