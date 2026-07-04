package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.request.FornecedorRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.FornecedorResponseDTO;
import com.InovaSkill.CaderninhoDigital.entity.Fornecedor;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.exception.BusinessException;
import com.InovaSkill.CaderninhoDigital.exception.ResourceNotFoundException;
import com.InovaSkill.CaderninhoDigital.repository.FornecedorRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class FornecedorService {

    private final FornecedorRepository fornecedorRepository;
    private final UsuarioAcessoService usuarioAcessoService;

    public FornecedorResponseDTO criar(Long usuarioId, FornecedorRequestDTO dto) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        Fornecedor fornecedor = Fornecedor.builder()
                .nome(dto.getNome())
                .email(dto.getEmail())
                .telefone(dto.getTelefone())
                .documento(dto.getDocumento())
                .endereco(dto.getEndereco())
                .ativo(dto.getAtivo())
                .gestor(gestor)
                .build();
        return toResponse(fornecedorRepository.save(fornecedor));
    }

    public List<FornecedorResponseDTO> listar(Long usuarioId) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        return fornecedorRepository.findByGestorOrderByNomeAsc(gestor).stream().map(this::toResponse).toList();
    }

    public FornecedorResponseDTO buscar(Long usuarioId, Long id) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        Fornecedor fornecedor = buscarEntidade(id);
        validarDono(fornecedor, gestor);
        return toResponse(fornecedor);
    }

    public FornecedorResponseDTO atualizar(Long usuarioId, Long id, FornecedorRequestDTO dto) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        Fornecedor fornecedor = buscarEntidade(id);
        validarDono(fornecedor, gestor);
        fornecedor.setNome(dto.getNome());
        fornecedor.setEmail(dto.getEmail());
        fornecedor.setTelefone(dto.getTelefone());
        fornecedor.setDocumento(dto.getDocumento());
        fornecedor.setEndereco(dto.getEndereco());
        fornecedor.setAtivo(dto.getAtivo() != null ? dto.getAtivo() : fornecedor.getAtivo());
        return toResponse(fornecedorRepository.save(fornecedor));
    }

    public void deletar(Long usuarioId, Long id) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        Fornecedor fornecedor = buscarEntidade(id);
        validarDono(fornecedor, gestor);
        fornecedorRepository.delete(fornecedor);
    }

    private Fornecedor buscarEntidade(Long id) {
        return fornecedorRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Fornecedor não encontrado"));
    }

    private void validarDono(Fornecedor fornecedor, Usuario gestor) {
        if (!fornecedor.getGestor().getId().equals(gestor.getId())) {
            throw new BusinessException("Este fornecedor não pertence ao usuário informado");
        }
    }

    private FornecedorResponseDTO toResponse(Fornecedor fornecedor) {
        return FornecedorResponseDTO.builder()
                .id(fornecedor.getId())
                .nome(fornecedor.getNome())
                .email(fornecedor.getEmail())
                .telefone(fornecedor.getTelefone())
                .documento(fornecedor.getDocumento())
                .endereco(fornecedor.getEndereco())
                .ativo(fornecedor.getAtivo())
                .build();
    }
}
