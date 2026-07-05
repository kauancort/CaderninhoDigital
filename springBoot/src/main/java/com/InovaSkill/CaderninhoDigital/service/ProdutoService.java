package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.request.GabaritoProdutoRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.ItemGabaritoProdutoRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.ProdutoRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.GabaritoProdutoResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ItemGabaritoProdutoResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ProdutoResponseDTO;
import com.InovaSkill.CaderninhoDigital.entity.MateriaPrima;
import com.InovaSkill.CaderninhoDigital.entity.Produto;
import com.InovaSkill.CaderninhoDigital.entity.ProdutoGabarito;
import com.InovaSkill.CaderninhoDigital.entity.ProdutoGabaritoItem;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.exception.BusinessException;
import com.InovaSkill.CaderninhoDigital.exception.ResourceNotFoundException;
import com.InovaSkill.CaderninhoDigital.repository.MateriaPrimaRepository;
import com.InovaSkill.CaderninhoDigital.repository.ProdutoRepository;
import java.math.BigDecimal;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProdutoService {

    private final ProdutoRepository produtoRepository;
    private final MateriaPrimaRepository materiaPrimaRepository;
    private final UsuarioAcessoService usuarioAcessoService;

    @Transactional
    public ProdutoResponseDTO criar(Long usuarioId, ProdutoRequestDTO dto) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        Produto produto = Produto.builder()
                .nome(dto.getNome())
                .descricao(dto.getDescricao())
                .unidadeMedida(dto.getUnidadeMedida())
                .precoVenda(dto.getPrecoVenda())
                .estoqueAtual(valorOuZero(dto.getEstoqueAtual()))
                .ativo(dto.getAtivo())
                .gestor(gestor)
                .build();
        if (dto.getGabarito() != null) {
            atualizarGabarito(produto, dto.getGabarito(), gestor);
        }
        return toResponse(produtoRepository.save(produto));
    }

    @Transactional(readOnly = true)
    public List<ProdutoResponseDTO> listar(Long usuarioId) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        return produtoRepository.findByGestorOrderByNomeAsc(gestor).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public ProdutoResponseDTO buscar(Long usuarioId, Long id) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        Produto produto = buscarEntidade(id);
        validarDono(produto, gestor);
        return toResponse(produto);
    }

    @Transactional
    public ProdutoResponseDTO atualizar(Long usuarioId, Long id, ProdutoRequestDTO dto) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        Produto produto = buscarEntidade(id);
        validarDono(produto, gestor);
        produto.setNome(dto.getNome());
        produto.setDescricao(dto.getDescricao());
        produto.setUnidadeMedida(dto.getUnidadeMedida());
        produto.setPrecoVenda(dto.getPrecoVenda());
        produto.setEstoqueAtual(dto.getEstoqueAtual() != null ? dto.getEstoqueAtual() : produto.getEstoqueAtual());
        produto.setAtivo(dto.getAtivo() != null ? dto.getAtivo() : produto.getAtivo());
        if (dto.getGabarito() != null) {
            atualizarGabarito(produto, dto.getGabarito(), gestor);
        }
        return toResponse(produtoRepository.save(produto));
    }

    public void deletar(Long usuarioId, Long id) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        Produto produto = buscarEntidade(id);
        validarDono(produto, gestor);
        produtoRepository.delete(produto);
    }

    public Produto buscarProdutoDoGestor(Long produtoId, Usuario gestor) {
        Produto produto = buscarEntidade(produtoId);
        validarDono(produto, gestor);
        return produto;
    }

    private Produto buscarEntidade(Long id) {
        return produtoRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Produto não encontrado"));
    }

    private void validarDono(Produto produto, Usuario gestor) {
        if (!produto.getGestor().getId().equals(gestor.getId())) {
            throw new BusinessException("Este produto não pertence ao usuário informado");
        }
    }

    private BigDecimal valorOuZero(BigDecimal valor) {
        return valor != null ? valor : BigDecimal.ZERO;
    }

    private void atualizarGabarito(Produto produto, GabaritoProdutoRequestDTO gabarito, Usuario gestor) {
        ProdutoGabarito produtoGabarito = produto.getGabarito();
        if (produtoGabarito == null) {
            produtoGabarito = ProdutoGabarito.builder()
                    .produto(produto)
                    .build();
            produto.setGabarito(produtoGabarito);
        }

        produtoGabarito.setQuantidadeBase(gabarito.getQuantidadeBase());
        produtoGabarito.setObservacao(gabarito.getObservacao());
        produtoGabarito.getItens().clear();

        for (ItemGabaritoProdutoRequestDTO itemDto : gabarito.getItens()) {
            MateriaPrima materiaPrima = materiaPrimaRepository.findById(itemDto.getMateriaPrimaId())
                    .orElseThrow(() -> new ResourceNotFoundException("Matéria-prima não encontrada"));

            if (!materiaPrima.getGestor().getId().equals(gestor.getId())) {
                throw new BusinessException("Esta matéria-prima não pertence ao usuário informado");
            }

            ProdutoGabaritoItem item = ProdutoGabaritoItem.builder()
                    .gabarito(produtoGabarito)
                    .materiaPrima(materiaPrima)
                    .quantidadeNecessaria(itemDto.getQuantidadeNecessaria())
                    .build();
            produtoGabarito.getItens().add(item);
        }
    }

    private ProdutoResponseDTO toResponse(Produto produto) {
        return ProdutoResponseDTO.builder()
                .id(produto.getId())
                .nome(produto.getNome())
                .descricao(produto.getDescricao())
                .unidadeMedida(produto.getUnidadeMedida())
                .precoVenda(produto.getPrecoVenda())
                .estoqueAtual(produto.getEstoqueAtual())
                .ativo(produto.getAtivo())
                .gabarito(toGabaritoResponse(produto))
                .build();
    }

    private GabaritoProdutoResponseDTO toGabaritoResponse(Produto produto) {
        if (produto.getGabarito() == null) {
            return null;
        }

        return GabaritoProdutoResponseDTO.builder()
                .id(produto.getGabarito().getId())
                .quantidadeBase(produto.getGabarito().getQuantidadeBase())
                .observacao(produto.getGabarito().getObservacao())
                .itens(produto.getGabarito().getItens().stream()
                        .map(this::toGabaritoItemResponse)
                        .toList())
                .build();
    }

    private ItemGabaritoProdutoResponseDTO toGabaritoItemResponse(ProdutoGabaritoItem item) {
        return ItemGabaritoProdutoResponseDTO.builder()
                .id(item.getId())
                .materiaPrimaId(item.getMateriaPrima().getId())
                .materiaPrimaNome(item.getMateriaPrima().getNome())
                .unidadeMedida(item.getMateriaPrima().getUnidadeMedida())
                .quantidadeNecessaria(item.getQuantidadeNecessaria())
                .build();
    }
}
