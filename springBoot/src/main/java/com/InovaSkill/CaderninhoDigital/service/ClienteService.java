package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.request.ClienteRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ClienteResponseDTO;
import com.InovaSkill.CaderninhoDigital.entity.Cliente;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.exception.BusinessException;
import com.InovaSkill.CaderninhoDigital.exception.ResourceNotFoundException;
import com.InovaSkill.CaderninhoDigital.repository.ClienteRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ClienteService {

    private final ClienteRepository clienteRepository;
    private final UsuarioAcessoService usuarioAcessoService;

    public ClienteResponseDTO criar(Long usuarioId, ClienteRequestDTO dto) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        Cliente cliente = Cliente.builder()
                .nome(dto.getNome())
                .email(dto.getEmail())
                .telefone(dto.getTelefone())
                .documento(dto.getDocumento())
                .endereco(dto.getEndereco())
                .ativo(dto.getAtivo())
                .gestor(gestor)
                .build();
        return toResponse(clienteRepository.save(cliente));
    }

    public List<ClienteResponseDTO> listar(Long usuarioId) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        return clienteRepository.findByGestorOrderByNomeAsc(gestor).stream().map(this::toResponse).toList();
    }

    public ClienteResponseDTO buscar(Long usuarioId, Long id) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        Cliente cliente = buscarEntidade(id);
        validarDono(cliente, gestor);
        return toResponse(cliente);
    }

    public ClienteResponseDTO atualizar(Long usuarioId, Long id, ClienteRequestDTO dto) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        Cliente cliente = buscarEntidade(id);
        validarDono(cliente, gestor);
        cliente.setNome(dto.getNome());
        cliente.setEmail(dto.getEmail());
        cliente.setTelefone(dto.getTelefone());
        cliente.setDocumento(dto.getDocumento());
        cliente.setEndereco(dto.getEndereco());
        cliente.setAtivo(dto.getAtivo() != null ? dto.getAtivo() : cliente.getAtivo());
        return toResponse(clienteRepository.save(cliente));
    }

    public void deletar(Long usuarioId, Long id) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        Cliente cliente = buscarEntidade(id);
        validarDono(cliente, gestor);
        clienteRepository.delete(cliente);
    }

    private Cliente buscarEntidade(Long id) {
        return clienteRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado"));
    }

    private void validarDono(Cliente cliente, Usuario gestor) {
        if (!cliente.getGestor().getId().equals(gestor.getId())) {
            throw new BusinessException("Este cliente não pertence ao usuário informado");
        }
    }

    private ClienteResponseDTO toResponse(Cliente cliente) {
        return ClienteResponseDTO.builder()
                .id(cliente.getId())
                .nome(cliente.getNome())
                .email(cliente.getEmail())
                .telefone(cliente.getTelefone())
                .documento(cliente.getDocumento())
                .endereco(cliente.getEndereco())
                .ativo(cliente.getAtivo())
                .build();
    }
}
