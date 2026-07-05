package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.response.DashboardResumoResponseDTO;
import com.InovaSkill.CaderninhoDigital.entity.CompraMateriaPrima;
import com.InovaSkill.CaderninhoDigital.entity.Lancamento;
import com.InovaSkill.CaderninhoDigital.entity.Producao;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.entity.Venda;
import com.InovaSkill.CaderninhoDigital.enums.StatusPagamento;
import com.InovaSkill.CaderninhoDigital.enums.TipoLancamento;
import com.InovaSkill.CaderninhoDigital.exception.ResourceNotFoundException;
import com.InovaSkill.CaderninhoDigital.repository.CompraMateriaPrimaRepository;
import com.InovaSkill.CaderninhoDigital.repository.LancamentoRepository;
import com.InovaSkill.CaderninhoDigital.repository.ProducaoRepository;
import com.InovaSkill.CaderninhoDigital.repository.UsuarioRepository;
import com.InovaSkill.CaderninhoDigital.repository.VendaRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final LancamentoRepository lancamentoRepository;
    private final UsuarioRepository usuarioRepository;
    private final VendaRepository vendaRepository;
    private final CompraMateriaPrimaRepository compraMateriaPrimaRepository;
    private final ProducaoRepository producaoRepository;

    public DashboardResumoResponseDTO resumo(Long usuarioId, LocalDate inicio, LocalDate fim) {
        Usuario gestor = usuarioRepository.findById(usuarioId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado"));

        List<Venda> vendas = vendaRepository.findByGestorAndDataVendaBetweenOrderByDataVendaDesc(gestor, inicio, fim);
        List<CompraMateriaPrima> compras = compraMateriaPrimaRepository
                .findByGestorAndDataCompraBetweenOrderByDataCompraDesc(gestor, inicio, fim);
        List<Producao> producoes = producaoRepository
                .findByGestorAndDataProducaoBetweenOrderByDataProducaoDesc(gestor, inicio, fim);
        List<Lancamento> lancamentosLegados = lancamentoRepository
                .findByGestorAndDataLancamentoBetweenOrderByDataLancamentoDesc(gestor, inicio, fim);

        BigDecimal totalVendas = vendas.stream().map(Venda::getValorTotal).reduce(BigDecimal.ZERO, BigDecimal::add)
                .add(somarPorTipo(lancamentosLegados, TipoLancamento.VENDA));
        BigDecimal totalCompras = compras.stream().map(CompraMateriaPrima::getValorTotal).reduce(BigDecimal.ZERO, BigDecimal::add)
                .add(somarPorTipo(lancamentosLegados, TipoLancamento.COMPRA_PRODUTO));
        BigDecimal totalProducao = producoes.stream().map(Producao::getCustoEstimado).reduce(BigDecimal.ZERO, BigDecimal::add)
                .add(somarPorTipo(lancamentosLegados, TipoLancamento.PRODUCAO));
        BigDecimal totalGastos = somarPorTipo(lancamentosLegados, TipoLancamento.GASTO_GERAL);

        BigDecimal pendenteVendas = vendas.stream()
                .filter(venda -> venda.getStatusPagamento() == StatusPagamento.PENDENTE
                        || venda.getStatusPagamento() == StatusPagamento.ATRASADO)
                .map(Venda::getValorTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal pendenteCompras = compras.stream()
                .filter(compra -> compra.getStatusPagamento() == StatusPagamento.PENDENTE
                        || compra.getStatusPagamento() == StatusPagamento.ATRASADO)
                .map(CompraMateriaPrima::getValorTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal pendenteLegado = lancamentosLegados.stream()
                .filter(lancamento -> lancamento.getStatusPagamento() == StatusPagamento.PENDENTE
                        || lancamento.getStatusPagamento() == StatusPagamento.ATRASADO)
                .map(Lancamento::getValorTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalPendente = pendenteVendas.add(pendenteCompras).add(pendenteLegado);

        BigDecimal saldoEstimado = totalVendas.subtract(totalCompras).subtract(totalGastos);
        long quantidadeLancamentos = vendas.size() + compras.size() + producoes.size() + lancamentosLegados.size();

        return DashboardResumoResponseDTO.builder()
                .totalVendas(totalVendas)
                .totalComprasProduto(totalCompras)
                .totalProducao(totalProducao)
                .totalGastosGerais(totalGastos)
                .saldoEstimado(saldoEstimado)
                .totalPendente(totalPendente)
                .quantidadeLancamentos(quantidadeLancamentos)
                .build();
    }

    private BigDecimal somarPorTipo(List<Lancamento> lancamentos, TipoLancamento tipo) {
        return lancamentos.stream()
                .filter(lancamento -> lancamento.getTipo() == tipo)
                .map(Lancamento::getValorTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
