package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.request.ProdutoRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ProdutoResponseDTO;
import com.InovaSkill.CaderninhoDigital.entity.Produto;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.exception.BusinessException;
import com.InovaSkill.CaderninhoDigital.exception.ResourceNotFoundException;
import com.InovaSkill.CaderninhoDigital.repository.ProdutoRepository;
import java.math.BigDecimal;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ProdutoService {

    private final ProdutoRepository produtoRepository;
    private final UsuarioAcessoService usuarioAcessoService;

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
        return toResponse(produtoRepository.save(produto));
    }

    public List<ProdutoResponseDTO> listar(Long usuarioId) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        return produtoRepository.findByGestorOrderByNomeAsc(gestor).stream().map(this::toResponse).toList();
    }

    public ProdutoResponseDTO buscar(Long usuarioId, Long id) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        Produto produto = buscarEntidade(id);
        validarDono(produto, gestor);
        return toResponse(produto);
    }

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

    private ProdutoResponseDTO toResponse(Produto produto) {
        return ProdutoResponseDTO.builder()
                .id(produto.getId())
                .nome(produto.getNome())
                .descricao(produto.getDescricao())
                .unidadeMedida(produto.getUnidadeMedida())
                .precoVenda(produto.getPrecoVenda())
                .estoqueAtual(produto.getEstoqueAtual())
                .ativo(produto.getAtivo())
                .build();
    }
}
