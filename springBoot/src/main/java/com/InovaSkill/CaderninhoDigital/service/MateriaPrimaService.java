package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.request.MateriaPrimaRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.MateriaPrimaResponseDTO;
import com.InovaSkill.CaderninhoDigital.entity.MateriaPrima;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.exception.BusinessException;
import com.InovaSkill.CaderninhoDigital.exception.ResourceNotFoundException;
import com.InovaSkill.CaderninhoDigital.repository.MateriaPrimaRepository;
import java.math.BigDecimal;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class MateriaPrimaService {

    private final MateriaPrimaRepository materiaPrimaRepository;
    private final UsuarioAcessoService usuarioAcessoService;

    public MateriaPrimaResponseDTO criar(Long usuarioId, MateriaPrimaRequestDTO dto) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        MateriaPrima materiaPrima = MateriaPrima.builder()
                .nome(dto.getNome())
                .descricao(dto.getDescricao())
                .unidadeMedida(dto.getUnidadeMedida())
                .estoqueAtual(valorOuZero(dto.getEstoqueAtual()))
                .estoqueMinimo(valorOuZero(dto.getEstoqueMinimo()))
                .custoMedio(valorOuZero(dto.getCustoMedio()))
                .ativo(dto.getAtivo())
                .gestor(gestor)
                .build();
        return toResponse(materiaPrimaRepository.save(materiaPrima));
    }

    public List<MateriaPrimaResponseDTO> listar(Long usuarioId) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        return materiaPrimaRepository.findByGestorOrderByNomeAsc(gestor).stream().map(this::toResponse).toList();
    }

    public MateriaPrimaResponseDTO buscar(Long usuarioId, Long id) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        MateriaPrima materiaPrima = buscarEntidade(id);
        validarDono(materiaPrima, gestor);
        return toResponse(materiaPrima);
    }

    public MateriaPrimaResponseDTO atualizar(Long usuarioId, Long id, MateriaPrimaRequestDTO dto) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        MateriaPrima materiaPrima = buscarEntidade(id);
        validarDono(materiaPrima, gestor);
        materiaPrima.setNome(dto.getNome());
        materiaPrima.setDescricao(dto.getDescricao());
        materiaPrima.setUnidadeMedida(dto.getUnidadeMedida());
        materiaPrima.setEstoqueAtual(dto.getEstoqueAtual() != null ? dto.getEstoqueAtual() : materiaPrima.getEstoqueAtual());
        materiaPrima.setEstoqueMinimo(dto.getEstoqueMinimo() != null ? dto.getEstoqueMinimo() : materiaPrima.getEstoqueMinimo());
        materiaPrima.setCustoMedio(dto.getCustoMedio() != null ? dto.getCustoMedio() : materiaPrima.getCustoMedio());
        materiaPrima.setAtivo(dto.getAtivo() != null ? dto.getAtivo() : materiaPrima.getAtivo());
        return toResponse(materiaPrimaRepository.save(materiaPrima));
    }

    public void deletar(Long usuarioId, Long id) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        MateriaPrima materiaPrima = buscarEntidade(id);
        validarDono(materiaPrima, gestor);
        materiaPrimaRepository.delete(materiaPrima);
    }

    public MateriaPrima buscarMateriaPrimaDoGestor(Long materiaPrimaId, Usuario gestor) {
        MateriaPrima materiaPrima = buscarEntidade(materiaPrimaId);
        validarDono(materiaPrima, gestor);
        return materiaPrima;
    }

    private MateriaPrima buscarEntidade(Long id) {
        return materiaPrimaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Matéria-prima não encontrada"));
    }

    private void validarDono(MateriaPrima materiaPrima, Usuario gestor) {
        if (!materiaPrima.getGestor().getId().equals(gestor.getId())) {
            throw new BusinessException("Esta matéria-prima não pertence ao usuário informado");
        }
    }

    private BigDecimal valorOuZero(BigDecimal valor) {
        return valor != null ? valor : BigDecimal.ZERO;
    }

    private MateriaPrimaResponseDTO toResponse(MateriaPrima materiaPrima) {
        return MateriaPrimaResponseDTO.builder()
                .id(materiaPrima.getId())
                .nome(materiaPrima.getNome())
                .descricao(materiaPrima.getDescricao())
                .unidadeMedida(materiaPrima.getUnidadeMedida())
                .estoqueAtual(materiaPrima.getEstoqueAtual())
                .estoqueMinimo(materiaPrima.getEstoqueMinimo())
                .custoMedio(materiaPrima.getCustoMedio())
                .ativo(materiaPrima.getAtivo())
                .build();
    }
}
