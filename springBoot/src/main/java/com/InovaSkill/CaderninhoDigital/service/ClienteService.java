package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.request.ClienteRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ClienteResponseDTO;
import com.InovaSkill.CaderninhoDigital.entity.Cliente;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.exception.ResourceNotFoundException;
import com.InovaSkill.CaderninhoDigital.repository.ClienteRepository;
import java.util.List;
import java.util.Locale;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
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
        usuarioAcessoService.buscarGestor(usuarioId);
        return clienteRepository.findAllByOrderByNomeAsc().stream().map(this::toResponse).toList();
    }

    public Page<ClienteResponseDTO> pesquisar(Long usuarioId, String busca, int pagina, int tamanho, Boolean ativo) {
        usuarioAcessoService.buscarGestor(usuarioId);
        String termo = busca == null ? "" : busca.trim().toLowerCase(Locale.ROOT);
        Specification<Cliente> filtro = (root, query, cb) -> {
            var p = cb.conjunction();
            if (!termo.isBlank()) {
                String like = "%" + termo + "%";
                p = cb.and(p, cb.or(
                        cb.like(cb.lower(root.get("nome")), like),
                        cb.like(cb.lower(root.get("email")), like),
                        cb.like(cb.lower(root.get("documento")), like)));
            }
            if (ativo != null) p = cb.and(p, cb.equal(root.get("ativo"), ativo));
            return p;
        };
        return clienteRepository.findAll(filtro, PageRequest.of(Math.max(0, pagina), Math.min(100, Math.max(1, tamanho)), Sort.by("nome")))
                .map(this::toResponse);
    }

    public ClienteResponseDTO buscar(Long usuarioId, Long id) {
        usuarioAcessoService.buscarGestor(usuarioId);
        Cliente cliente = buscarEntidade(id);
        return toResponse(cliente);
    }

    public ClienteResponseDTO atualizar(Long usuarioId, Long id, ClienteRequestDTO dto) {
        usuarioAcessoService.buscarGestor(usuarioId);
        Cliente cliente = buscarEntidade(id);
        cliente.setNome(dto.getNome());
        cliente.setEmail(dto.getEmail());
        cliente.setTelefone(dto.getTelefone());
        cliente.setDocumento(dto.getDocumento());
        cliente.setEndereco(dto.getEndereco());
        cliente.setAtivo(dto.getAtivo() != null ? dto.getAtivo() : cliente.getAtivo());
        return toResponse(clienteRepository.save(cliente));
    }

    public void deletar(Long usuarioId, Long id) {
        usuarioAcessoService.buscarGestor(usuarioId);
        Cliente cliente = buscarEntidade(id);
        clienteRepository.delete(cliente);
    }

    private Cliente buscarEntidade(Long id) {
        return clienteRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado"));
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
                .gestorId(cliente.getGestor().getId())
                .gestorNome(cliente.getGestor().getNome())
                .build();
    }
}
