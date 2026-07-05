package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.request.ItemVendaRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.VendaRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ItemVendaResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.VendaResponseDTO;
import com.InovaSkill.CaderninhoDigital.entity.Cliente;
import com.InovaSkill.CaderninhoDigital.entity.ItemVenda;
import com.InovaSkill.CaderninhoDigital.entity.Produto;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.entity.Venda;
import com.InovaSkill.CaderninhoDigital.enums.StatusPagamento;
import com.InovaSkill.CaderninhoDigital.exception.BusinessException;
import com.InovaSkill.CaderninhoDigital.exception.ResourceNotFoundException;
import com.InovaSkill.CaderninhoDigital.repository.ClienteRepository;
import com.InovaSkill.CaderninhoDigital.repository.ProdutoRepository;
import com.InovaSkill.CaderninhoDigital.repository.VendaRepository;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class VendaService {

    private final VendaRepository vendaRepository;
    private final ProdutoRepository produtoRepository;
    private final ClienteRepository clienteRepository;
    private final UsuarioAcessoService usuarioAcessoService;

    @Transactional
    public VendaResponseDTO criar(Long usuarioId, VendaRequestDTO dto) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        Cliente cliente = buscarClienteOpcional(dto.getClienteId());
        Venda venda = Venda.builder()
                .cliente(cliente)
                .gestor(gestor)
                .dataVenda(dto.getDataVenda())
                .formaPagamento(dto.getFormaPagamento())
                .statusPagamento(dto.getStatusPagamento() != null ? dto.getStatusPagamento() : StatusPagamento.PENDENTE)
                .observacao(dto.getObservacao())
                .valorTotal(BigDecimal.ZERO)
                .itens(new ArrayList<>())
                .build();

        BigDecimal total = BigDecimal.ZERO;
        for (ItemVendaRequestDTO itemDto : dto.getItens()) {
            Produto produto = buscarProdutoDoGestor(itemDto.getProdutoId(), gestor);
            BigDecimal valorUnitario = itemDto.getValorUnitario() != null ? itemDto.getValorUnitario() : produto.getPrecoVenda();
            BigDecimal valorTotal = valorUnitario.multiply(itemDto.getQuantidade());
            baixarEstoque(produto, itemDto.getQuantidade());
            ItemVenda item = ItemVenda.builder()
                    .venda(venda)
                    .produto(produto)
                    .quantidade(itemDto.getQuantidade())
                    .valorUnitario(valorUnitario)
                    .valorTotal(valorTotal)
                    .build();
            venda.getItens().add(item);
            total = total.add(valorTotal);
        }

        venda.setValorTotal(total);
        return toResponse(vendaRepository.save(venda));
    }

    public List<VendaResponseDTO> listar(Long usuarioId) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        return vendaRepository.findByGestorOrderByDataVendaDesc(gestor).stream().map(this::toResponse).toList();
    }

    public VendaResponseDTO buscar(Long usuarioId, Long id) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        Venda venda = buscarVenda(id);
        validarDono(venda, gestor);
        return toResponse(venda);
    }

    private Cliente buscarClienteOpcional(Long clienteId) {
        if (clienteId == null) {
            return null;
        }
        return clienteRepository.findById(clienteId)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado"));
    }

    private Produto buscarProdutoDoGestor(Long produtoId, Usuario gestor) {
        Produto produto = produtoRepository.findById(produtoId)
                .orElseThrow(() -> new ResourceNotFoundException("Produto não encontrado"));
        if (!produto.getGestor().getId().equals(gestor.getId())) {
            throw new BusinessException("Este produto não pertence ao usuário informado");
        }
        return produto;
    }

    private void baixarEstoque(Produto produto, BigDecimal quantidade) {
        if (produto.getEstoqueAtual().compareTo(quantidade) < 0) {
            throw new BusinessException("Estoque insuficiente para o produto " + produto.getNome());
        }
        produto.setEstoqueAtual(produto.getEstoqueAtual().subtract(quantidade));
    }

    private Venda buscarVenda(Long id) {
        return vendaRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Venda não encontrada"));
    }

    private void validarDono(Venda venda, Usuario gestor) {
        if (!venda.getGestor().getId().equals(gestor.getId())) {
            throw new BusinessException("Esta venda não pertence ao usuário informado");
        }
    }

    private VendaResponseDTO toResponse(Venda venda) {
        return VendaResponseDTO.builder()
                .id(venda.getId())
                .clienteId(venda.getCliente() != null ? venda.getCliente().getId() : null)
                .clienteNome(venda.getCliente() != null ? venda.getCliente().getNome() : null)
                .dataVenda(venda.getDataVenda())
                .formaPagamento(venda.getFormaPagamento())
                .statusPagamento(venda.getStatusPagamento())
                .valorTotal(venda.getValorTotal())
                .observacao(venda.getObservacao())
                .criadoEm(venda.getCriadoEm())
                .itens(venda.getItens().stream().map(this::toItemResponse).toList())
                .build();
    }

    private ItemVendaResponseDTO toItemResponse(ItemVenda item) {
        return ItemVendaResponseDTO.builder()
                .id(item.getId())
                .produtoId(item.getProduto().getId())
                .produtoNome(item.getProduto().getNome())
                .quantidade(item.getQuantidade())
                .valorUnitario(item.getValorUnitario())
                .valorTotal(item.getValorTotal())
                .build();
    }
}
