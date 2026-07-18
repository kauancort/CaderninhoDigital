package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.request.CategoriaProdutoRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.CategoriaProdutoResponseDTO;
import com.InovaSkill.CaderninhoDigital.entity.CategoriaProduto;
import com.InovaSkill.CaderninhoDigital.exception.BusinessException;
import com.InovaSkill.CaderninhoDigital.exception.ResourceNotFoundException;
import com.InovaSkill.CaderninhoDigital.repository.CategoriaProdutoRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor
public class CategoriaProdutoService {
    private final CategoriaProdutoRepository repository;
    private final UsuarioAcessoService acesso;

    public List<CategoriaProdutoResponseDTO> listar(Long usuarioId) {
        acesso.buscarGestor(usuarioId);
        return repository.findAllByOrderByNomeAsc().stream().map(this::toResponse).toList();
    }
    @Transactional public CategoriaProdutoResponseDTO criar(Long usuarioId, CategoriaProdutoRequestDTO dto) {
        acesso.buscarGestor(usuarioId);
        if (repository.existsByNomeIgnoreCase(dto.getNome().trim())) throw new BusinessException("Já existe uma categoria com esse nome");
        return toResponse(repository.save(CategoriaProduto.builder().nome(dto.getNome().trim())
                .descricao(dto.getDescricao()).ativo(dto.getAtivo()).categoriaPai(pai(dto.getCategoriaPaiId())).build()));
    }
    @Transactional public CategoriaProdutoResponseDTO atualizar(Long usuarioId, Long id, CategoriaProdutoRequestDTO dto) {
        acesso.buscarGestor(usuarioId);
        var categoria = buscar(id);
        if (repository.existsByNomeIgnoreCaseAndIdNot(dto.getNome().trim(), id)) throw new BusinessException("Já existe uma categoria com esse nome");
        if (id.equals(dto.getCategoriaPaiId())) throw new BusinessException("Uma categoria não pode ser sua própria categoria pai");
        categoria.setNome(dto.getNome().trim()); categoria.setDescricao(dto.getDescricao());
        categoria.setAtivo(dto.getAtivo() == null ? categoria.getAtivo() : dto.getAtivo());
        categoria.setCategoriaPai(pai(dto.getCategoriaPaiId()));
        return toResponse(repository.save(categoria));
    }
    private CategoriaProduto pai(Long id) { return id == null ? null : buscar(id); }
    private CategoriaProduto buscar(Long id) { return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Categoria não encontrada")); }
    private CategoriaProdutoResponseDTO toResponse(CategoriaProduto c) { return new CategoriaProdutoResponseDTO(c.getId(), c.getNome(), c.getDescricao(), c.getAtivo(), c.getCategoriaPai() == null ? null : c.getCategoriaPai().getId(), c.getCategoriaPai() == null ? null : c.getCategoriaPai().getNome()); }
}
