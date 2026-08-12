package com.InovaSkill.CaderninhoDigital.dto.response;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public sealed interface DadosAssistenteDTO permits DadosAssistenteDTO.Estoque,
        DadosAssistenteDTO.Vendas, DadosAssistenteDTO.Gastos, DadosAssistenteDTO.Recebiveis,
        DadosAssistenteDTO.CustoProduto, DadosAssistenteDTO.ComprasInsumo,
        DadosAssistenteDTO.ComparacaoVendasGastos, DadosAssistenteDTO.ComparacaoVendasPeriodos,
        DadosAssistenteDTO.ComparacaoMercado {

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
            LocalDate validade, String evidenciaPreco, String evidenciaPedidoMinimo, String confianca) {}

    record ComparacaoMercado(String tipo, Long materiaPrimaId, String unidade, BigDecimal quantidadeAlvo,
            BigDecimal precoInternoUnitario, BigDecimal custoInternoComparavel, BigDecimal menorCustoExterno,
            BigDecimal economiaEstimada, BigDecimal diferencaExternaMenosInterna,
            BigDecimal percentualDiferenca, String situacao,
            Instant pesquisadoEm, List<OfertaMercado> ofertas) implements DadosAssistenteDTO {}

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
