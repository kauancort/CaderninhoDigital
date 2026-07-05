package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.request.FornecedorRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.FornecedorResponseDTO;
import com.InovaSkill.CaderninhoDigital.entity.Fornecedor;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
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
        usuarioAcessoService.buscarGestor(usuarioId);
        return fornecedorRepository.findAllByOrderByNomeAsc().stream().map(this::toResponse).toList();
    }

    public FornecedorResponseDTO buscar(Long usuarioId, Long id) {
        usuarioAcessoService.buscarGestor(usuarioId);
        Fornecedor fornecedor = buscarEntidade(id);
        return toResponse(fornecedor);
    }

    public FornecedorResponseDTO atualizar(Long usuarioId, Long id, FornecedorRequestDTO dto) {
        usuarioAcessoService.buscarGestor(usuarioId);
        Fornecedor fornecedor = buscarEntidade(id);
        fornecedor.setNome(dto.getNome());
        fornecedor.setEmail(dto.getEmail());
        fornecedor.setTelefone(dto.getTelefone());
        fornecedor.setDocumento(dto.getDocumento());
        fornecedor.setEndereco(dto.getEndereco());
        fornecedor.setAtivo(dto.getAtivo() != null ? dto.getAtivo() : fornecedor.getAtivo());
        return toResponse(fornecedorRepository.save(fornecedor));
    }

    public void deletar(Long usuarioId, Long id) {
        usuarioAcessoService.buscarGestor(usuarioId);
        Fornecedor fornecedor = buscarEntidade(id);
        fornecedorRepository.delete(fornecedor);
    }

    private Fornecedor buscarEntidade(Long id) {
        return fornecedorRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Fornecedor não encontrado"));
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
                .gestorId(fornecedor.getGestor().getId())
                .gestorNome(fornecedor.getGestor().getNome())
                .build();
    }
}
