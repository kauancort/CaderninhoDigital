package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.request.CompraMateriaPrimaRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.ItemCompraMateriaPrimaRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.CompraMateriaPrimaResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ItemCompraMateriaPrimaResponseDTO;
import com.InovaSkill.CaderninhoDigital.entity.CompraMateriaPrima;
import com.InovaSkill.CaderninhoDigital.entity.Fornecedor;
import com.InovaSkill.CaderninhoDigital.entity.ItemCompraMateriaPrima;
import com.InovaSkill.CaderninhoDigital.entity.MateriaPrima;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.enums.StatusPagamento;
import com.InovaSkill.CaderninhoDigital.enums.OrigemMovimentacaoEstoque;
import com.InovaSkill.CaderninhoDigital.enums.TipoMovimentacaoEstoque;
import com.InovaSkill.CaderninhoDigital.exception.BusinessException;
import com.InovaSkill.CaderninhoDigital.exception.ResourceNotFoundException;
import com.InovaSkill.CaderninhoDigital.repository.CompraMateriaPrimaRepository;
import com.InovaSkill.CaderninhoDigital.repository.FornecedorRepository;
import com.InovaSkill.CaderninhoDigital.repository.MateriaPrimaRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CompraMateriaPrimaService {

    private final CompraMateriaPrimaRepository compraRepository;
    private final FornecedorRepository fornecedorRepository;
    private final MateriaPrimaRepository materiaPrimaRepository;
    private final UsuarioAcessoService usuarioAcessoService;
    private final MovimentacaoEstoqueService movimentacaoEstoqueService;
    private final HistoricoValorService historicoValorService;
    private final AuditoriaService auditoriaService;

    @Transactional
    public CompraMateriaPrimaResponseDTO criar(Long usuarioId, CompraMateriaPrimaRequestDTO dto) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        Fornecedor fornecedor = buscarFornecedorOpcional(dto.getFornecedorId());
        CompraMateriaPrima compra = CompraMateriaPrima.builder()
                .fornecedor(fornecedor)
                .gestor(gestor)
                .dataCompra(dto.getDataCompra())
                .formaPagamento(dto.getFormaPagamento())
                .statusPagamento(dto.getStatusPagamento() != null ? dto.getStatusPagamento() : StatusPagamento.PENDENTE)
                .observacao(dto.getObservacao())
                .valorTotal(BigDecimal.ZERO)
                .itens(new ArrayList<>())
                .build();

        BigDecimal total = BigDecimal.ZERO;
        for (ItemCompraMateriaPrimaRequestDTO itemDto : dto.getItens()) {
            MateriaPrima materiaPrima = buscarMateriaPrimaDoGestor(itemDto.getMateriaPrimaId(), gestor);
            BigDecimal estoqueAnterior = materiaPrima.getEstoqueAtual();
            BigDecimal custoAnterior = materiaPrima.getCustoMedio();
            BigDecimal valorTotal = itemDto.getValorUnitario().multiply(itemDto.getQuantidade());
            atualizarEstoqueECusto(materiaPrima, itemDto.getQuantidade(), itemDto.getValorUnitario());
            historicoValorService.registrarCusto(
                    materiaPrima, gestor, custoAnterior, "Custo médio recalculado pela compra", "COMPRA");
            if (custoAnterior.compareTo(materiaPrima.getCustoMedio()) != 0) auditoriaService.registrar(gestor, "MATERIA_PRIMA", materiaPrima.getId(), "ALTERACAO_CUSTO", custoAnterior, materiaPrima.getCustoMedio(), "Compra de matéria-prima", "COMPRA");
            movimentacaoEstoqueService.registrarMateriaPrima(
                    materiaPrima, gestor, estoqueAnterior, materiaPrima.getEstoqueAtual(),
                    TipoMovimentacaoEstoque.ENTRADA, OrigemMovimentacaoEstoque.COMPRA,
                    dto.getObservacao());
            ItemCompraMateriaPrima item = ItemCompraMateriaPrima.builder()
                    .compra(compra)
                    .materiaPrima(materiaPrima)
                    .quantidade(itemDto.getQuantidade())
                    .valorUnitario(itemDto.getValorUnitario())
                    .valorTotal(valorTotal)
                    .build();
            compra.getItens().add(item);
            total = total.add(valorTotal);
        }

        compra.setValorTotal(total);
        CompraMateriaPrima salva = compraRepository.save(compra);
        auditoriaService.registrar(gestor, "COMPRA", salva.getId(), "CRIACAO", null, salva.getValorTotal(), dto.getObservacao(), "COMPRA");
        return toResponse(salva);
    }

    public List<CompraMateriaPrimaResponseDTO> listar(Long usuarioId) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        return compraRepository.findAllByOrderByDataCompraDesc().stream().map(this::toResponse).toList();
    }

    public CompraMateriaPrimaResponseDTO buscar(Long usuarioId, Long id) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        CompraMateriaPrima compra = compraRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Compra de matéria-prima não encontrada"));
        return toResponse(compra);
    }

    private Fornecedor buscarFornecedorOpcional(Long fornecedorId) {
        if (fornecedorId == null) {
            return null;
        }
        return fornecedorRepository.findById(fornecedorId)
                .orElseThrow(() -> new ResourceNotFoundException("Fornecedor não encontrado"));
    }

    private MateriaPrima buscarMateriaPrimaDoGestor(Long materiaPrimaId, Usuario gestor) {
        MateriaPrima materiaPrima = materiaPrimaRepository.findById(materiaPrimaId)
                .orElseThrow(() -> new ResourceNotFoundException("Matéria-prima não encontrada"));
        return materiaPrima;
    }

    private void atualizarEstoqueECusto(MateriaPrima materiaPrima, BigDecimal quantidadeCompra, BigDecimal valorUnitarioCompra) {
        BigDecimal estoqueAnterior = materiaPrima.getEstoqueAtual();
        BigDecimal custoTotalAnterior = estoqueAnterior.multiply(materiaPrima.getCustoMedio());
        BigDecimal custoTotalCompra = quantidadeCompra.multiply(valorUnitarioCompra);
        BigDecimal novoEstoque = estoqueAnterior.add(quantidadeCompra);
        BigDecimal novoCustoMedio = novoEstoque.compareTo(BigDecimal.ZERO) == 0
                ? BigDecimal.ZERO
                : custoTotalAnterior.add(custoTotalCompra).divide(novoEstoque, 2, RoundingMode.HALF_UP);
        materiaPrima.setEstoqueAtual(novoEstoque);
        materiaPrima.setCustoMedio(novoCustoMedio);
    }

    private CompraMateriaPrimaResponseDTO toResponse(CompraMateriaPrima compra) {
        return CompraMateriaPrimaResponseDTO.builder()
                .id(compra.getId())
                .fornecedorId(compra.getFornecedor() != null ? compra.getFornecedor().getId() : null)
                .fornecedorNome(compra.getFornecedor() != null ? compra.getFornecedor().getNome() : null)
                .dataCompra(compra.getDataCompra())
                .formaPagamento(compra.getFormaPagamento())
                .statusPagamento(compra.getStatusPagamento())
                .valorTotal(compra.getValorTotal())
                .observacao(compra.getObservacao())
                .criadoEm(compra.getCriadoEm())
                .itens(compra.getItens().stream().map(this::toItemResponse).toList())
                .build();
    }

    private ItemCompraMateriaPrimaResponseDTO toItemResponse(ItemCompraMateriaPrima item) {
        return ItemCompraMateriaPrimaResponseDTO.builder()
                .id(item.getId())
                .materiaPrimaId(item.getMateriaPrima().getId())
                .materiaPrimaNome(item.getMateriaPrima().getNome())
                .quantidade(item.getQuantidade())
                .valorUnitario(item.getValorUnitario())
                .valorTotal(item.getValorTotal())
                .build();
    }
}
