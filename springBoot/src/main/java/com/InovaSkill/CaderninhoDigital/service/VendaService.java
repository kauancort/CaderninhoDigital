package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.ContatoDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.ContatoRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.ItemVendaRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.VendaRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ItemVendaResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.VendaResponseDTO;
import com.InovaSkill.CaderninhoDigital.entity.Cliente;
import com.InovaSkill.CaderninhoDigital.entity.ItemVenda;
import com.InovaSkill.CaderninhoDigital.entity.Produto;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.entity.Venda;
import com.InovaSkill.CaderninhoDigital.enums.FormaPagamento;
import com.InovaSkill.CaderninhoDigital.enums.StatusPagamento;
import com.InovaSkill.CaderninhoDigital.enums.TipoCartao;
import com.InovaSkill.CaderninhoDigital.exception.BusinessException;
import com.InovaSkill.CaderninhoDigital.exception.ResourceNotFoundException;
import com.InovaSkill.CaderninhoDigital.repository.ClienteRepository;
import com.InovaSkill.CaderninhoDigital.repository.ProdutoRepository;
import com.InovaSkill.CaderninhoDigital.repository.VendaRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
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
    private final ObjectMapper objectMapper;

    @Transactional
    public VendaResponseDTO criar(Long usuarioId, VendaRequestDTO dto) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        Cliente cliente = buscarClienteOpcional(dto.getClienteId());

        StatusPagamento status = dto.getStatusPagamento() != null ? dto.getStatusPagamento() : StatusPagamento.PENDENTE;
        validarRegrasNegocio(dto, status);

        Venda venda = Venda.builder()
                .cliente(cliente)
                .gestor(gestor)
                .dataVenda(dto.getDataVenda())
                .formaPagamento(dto.getFormaPagamento())
                .statusPagamento(status)
                .observacao(dto.getObservacao())
                .dataVencimento(status == StatusPagamento.PENDENTE ? dto.getDataVencimento() : null)
                .tipoCartao(dto.getFormaPagamento() == FormaPagamento.CARTAO ? dto.getTipoCartao() : null)
                .parcelas(dto.getTipoCartao() == TipoCartao.CREDITO ? dto.getParcelas() : null)
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

    private void validarRegrasNegocio(VendaRequestDTO dto, StatusPagamento status) {
        if (status == StatusPagamento.PENDENTE && dto.getDataVencimento() == null) {
            throw new BusinessException("Informe a data de vencimento para vendas pendentes");
        }
        if (dto.getFormaPagamento() == FormaPagamento.CARTAO) {
            if (dto.getTipoCartao() == null) {
                throw new BusinessException("Informe se o pagamento no cartão foi crédito ou débito");
            }
            if (dto.getTipoCartao() == TipoCartao.CREDITO
                    && (dto.getParcelas() == null || dto.getParcelas() < 1)) {
                throw new BusinessException("Informe a quantidade de parcelas");
            }
        }
    }

    public List<VendaResponseDTO> listar(Long usuarioId) {
        usuarioAcessoService.buscarGestor(usuarioId);
        return vendaRepository.findAllByOrderByDataVendaDesc().stream().map(this::toResponse).toList();
    }

    public VendaResponseDTO buscar(Long usuarioId, Long id) {
        usuarioAcessoService.buscarGestor(usuarioId);
        Venda venda = buscarVenda(id);
        return toResponse(venda);
    }

    @Transactional
    public VendaResponseDTO adicionarContato(Long usuarioId, Long vendaId, ContatoRequestDTO dto) {
        usuarioAcessoService.buscarGestor(usuarioId);
        Venda venda = buscarVenda(vendaId);
        List<ContatoDTO> contatos = lerContatos(venda.getContatos());
        contatos.add(ContatoDTO.builder()
                .data(LocalDateTime.now())
                .tipo(dto.getTipo())
                .resposta(dto.getResposta())
                .build());
        venda.setContatos(escreverContatos(contatos));
        return toResponse(vendaRepository.save(venda));
    }

    private Cliente buscarClienteOpcional(Long clienteId) {
        if (clienteId == null) {
            return null;
        }
        return clienteRepository.findById(clienteId)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado"));
    }

    private Produto buscarProdutoDoGestor(Long produtoId, Usuario gestor) {
        return produtoRepository.findById(produtoId)
                .orElseThrow(() -> new ResourceNotFoundException("Produto não encontrado"));
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

    private List<ContatoDTO> lerContatos(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<ContatoDTO>>() {});
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private String escreverContatos(List<ContatoDTO> contatos) {
        try {
            return objectMapper.writeValueAsString(contatos);
        } catch (Exception e) {
            return "[]";
        }
    }

    private VendaResponseDTO toResponse(Venda venda) {
        boolean emAtraso = venda.getStatusPagamento() == StatusPagamento.PENDENTE
                && venda.getDataVencimento() != null
                && venda.getDataVencimento().isBefore(LocalDate.now());

        return VendaResponseDTO.builder()
                .id(venda.getId())
                .clienteId(venda.getCliente() != null ? venda.getCliente().getId() : null)
                .clienteNome(venda.getCliente() != null ? venda.getCliente().getNome() : null)
                .dataVenda(venda.getDataVenda())
                .formaPagamento(venda.getFormaPagamento())
                .statusPagamento(venda.getStatusPagamento())
                .valorTotal(venda.getValorTotal())
                .observacao(venda.getObservacao())
                .dataVencimento(venda.getDataVencimento())
                .tipoCartao(venda.getTipoCartao())
                .parcelas(venda.getParcelas())
                .emAtraso(emAtraso)
                .contatos(lerContatos(venda.getContatos()))
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