package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.response.InsightResponseDTO;
import com.InovaSkill.CaderninhoDigital.entity.CompraMateriaPrima;
import com.InovaSkill.CaderninhoDigital.entity.Insight;
import com.InovaSkill.CaderninhoDigital.entity.Lancamento;
import com.InovaSkill.CaderninhoDigital.entity.MateriaPrima;
import com.InovaSkill.CaderninhoDigital.entity.Producao;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.entity.Venda;
import com.InovaSkill.CaderninhoDigital.enums.StatusPagamento;
import com.InovaSkill.CaderninhoDigital.enums.TipoInsight;
import com.InovaSkill.CaderninhoDigital.enums.TipoLancamento;
import com.InovaSkill.CaderninhoDigital.exception.ResourceNotFoundException;
import com.InovaSkill.CaderninhoDigital.repository.CompraMateriaPrimaRepository;
import com.InovaSkill.CaderninhoDigital.repository.InsightRepository;
import com.InovaSkill.CaderninhoDigital.repository.LancamentoRepository;
import com.InovaSkill.CaderninhoDigital.repository.MateriaPrimaRepository;
import com.InovaSkill.CaderninhoDigital.repository.ProducaoRepository;
import com.InovaSkill.CaderninhoDigital.repository.UsuarioRepository;
import com.InovaSkill.CaderninhoDigital.repository.VendaRepository;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class InsightService {

    private final InsightRepository insightRepository;
    private final LancamentoRepository lancamentoRepository;
    private final VendaRepository vendaRepository;
    private final CompraMateriaPrimaRepository compraMateriaPrimaRepository;
    private final ProducaoRepository producaoRepository;
    private final MateriaPrimaRepository materiaPrimaRepository;
    private final UsuarioRepository usuarioRepository;

    public List<InsightResponseDTO> listar(Long usuarioId) {
        Usuario gestor = buscarUsuario(usuarioId);
        return insightRepository.findByGestorOrderByCriadoEmDesc(gestor).stream()
                .map(this::toResponse)
                .toList();
    }

    public List<InsightResponseDTO> gerar(Long usuarioId) {
        Usuario gestor = buscarUsuario(usuarioId);
        List<Lancamento> lancamentos = lancamentoRepository.findByGestorOrderByDataLancamentoDesc(gestor);
        List<Venda> vendas = vendaRepository.findByGestorOrderByDataVendaDesc(gestor);
        List<CompraMateriaPrima> compras = compraMateriaPrimaRepository.findByGestorOrderByDataCompraDesc(gestor);
        List<Producao> producoes = producaoRepository.findByGestorOrderByDataProducaoDesc(gestor);
        List<MateriaPrima> materiasPrimas = materiaPrimaRepository.findByGestorOrderByNomeAsc(gestor);

        List<Insight> insights = new ArrayList<>();
        BigDecimal totalVendas = vendas.stream().map(Venda::getValorTotal).reduce(BigDecimal.ZERO, BigDecimal::add)
                .add(somarPorTipo(lancamentos, TipoLancamento.VENDA));
        BigDecimal totalCompras = compras.stream().map(CompraMateriaPrima::getValorTotal).reduce(BigDecimal.ZERO, BigDecimal::add)
                .add(somarPorTipo(lancamentos, TipoLancamento.COMPRA_PRODUTO));
        BigDecimal totalGastos = somarPorTipo(lancamentos, TipoLancamento.GASTO_GERAL);
        long pendentesLegados = lancamentos.stream()
                .filter(lancamento -> lancamento.getStatusPagamento() == StatusPagamento.PENDENTE
                        || lancamento.getStatusPagamento() == StatusPagamento.ATRASADO)
                .count();
        long pendentesVendas = vendas.stream()
                .filter(venda -> venda.getStatusPagamento() == StatusPagamento.PENDENTE
                        || venda.getStatusPagamento() == StatusPagamento.ATRASADO)
                .count();
        long pendentesCompras = compras.stream()
                .filter(compra -> compra.getStatusPagamento() == StatusPagamento.PENDENTE
                        || compra.getStatusPagamento() == StatusPagamento.ATRASADO)
                .count();
        long pendentes = pendentesLegados + pendentesVendas + pendentesCompras;
        long itensAbaixoDoMinimo = materiasPrimas.stream()
                .filter(materiaPrima -> materiaPrima.getEstoqueAtual().compareTo(materiaPrima.getEstoqueMinimo()) < 0)
                .count();
        long totalRegistros = lancamentos.size() + vendas.size() + compras.size() + producoes.size();

        insights.add(novoInsight(
                TipoInsight.RESUMO_GERAL,
                "Resumo operacional",
                "Foram encontrados " + totalRegistros + " registros operacionais para análise.",
                gestor
        ));

        if (totalCompras.add(totalGastos).compareTo(totalVendas) > 0) {
            insights.add(novoInsight(
                    TipoInsight.ALERTA_CUSTO,
                    "Custos acima das vendas",
                    "Compras e gastos gerais estão maiores que o total de vendas. Revise os custos recentes.",
                    gestor
            ));
        }

        if (pendentes > 0) {
            insights.add(novoInsight(
                    TipoInsight.ALERTA_VENDA,
                    "Pagamentos pendentes",
                    "Existem " + pendentes + " lançamentos pendentes ou atrasados. Priorize a conferência desses pagamentos.",
                    gestor
            ));
        }

        if (itensAbaixoDoMinimo > 0) {
            insights.add(novoInsight(
                    TipoInsight.SUGESTAO_COMPRA,
                    "Estoque baixo de matéria-prima",
                    "Existem " + itensAbaixoDoMinimo + " matérias-primas abaixo do estoque mínimo.",
                    gestor
            ));
        }

        if (totalVendas.compareTo(BigDecimal.ZERO) > 0 && totalCompras.compareTo(BigDecimal.ZERO) == 0) {
            insights.add(novoInsight(
                    TipoInsight.SUGESTAO_COMPRA,
                    "Revisar estoque de insumos",
                    "Há vendas registradas sem compras recentes. Verifique se o estoque de matéria-prima está atualizado.",
                    gestor
            ));
        }

        return insightRepository.saveAll(insights).stream()
                .map(this::toResponse)
                .toList();
    }

    private Usuario buscarUsuario(Long usuarioId) {
        return usuarioRepository.findById(usuarioId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado"));
    }

    private BigDecimal somarPorTipo(List<Lancamento> lancamentos, TipoLancamento tipo) {
        return lancamentos.stream()
                .filter(lancamento -> lancamento.getTipo() == tipo)
                .map(Lancamento::getValorTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private Insight novoInsight(TipoInsight tipo, String titulo, String mensagem, Usuario gestor) {
        return Insight.builder()
                .tipo(tipo)
                .titulo(titulo)
                .mensagem(mensagem)
                .gestor(gestor)
                .build();
    }

    private InsightResponseDTO toResponse(Insight insight) {
        return InsightResponseDTO.builder()
                .id(insight.getId())
                .tipo(insight.getTipo())
                .titulo(insight.getTitulo())
                .mensagem(insight.getMensagem())
                .criadoEm(insight.getCriadoEm())
                .build();
    }
}
