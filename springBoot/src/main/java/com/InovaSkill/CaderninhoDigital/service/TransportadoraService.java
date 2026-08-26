package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.request.TransportadoraRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.TransportadoraResponseDTO;
import com.InovaSkill.CaderninhoDigital.entity.Cliente;
import com.InovaSkill.CaderninhoDigital.entity.Transportadora;
import com.InovaSkill.CaderninhoDigital.exception.ResourceNotFoundException;
import com.InovaSkill.CaderninhoDigital.repository.ClienteRepository;
import com.InovaSkill.CaderninhoDigital.repository.TransportadoraRepository;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/*
 * ADICIONADO (Card 3): transportadora deixa de ser preenchida a cada
 * venda e passa a ser um cadastro do cliente (no máximo uma por
 * cliente, por enquanto). A VendaService consulta este service para
 * puxar a transportadora automaticamente quando formaEnvio = TRANSPORTADORA.
 */
@Service
@RequiredArgsConstructor
public class TransportadoraService {

    private final TransportadoraRepository transportadoraRepository;
    private final ClienteRepository clienteRepository;
    private final UsuarioAcessoService usuarioAcessoService;

    @Transactional(readOnly = true)
    public Optional<TransportadoraResponseDTO> buscarPorCliente(Long usuarioId, Long clienteId) {
        usuarioAcessoService.buscarGestor(usuarioId);
        return transportadoraRepository.findByClienteId(clienteId).map(this::toResponse);
    }

    @Transactional
    public TransportadoraResponseDTO salvar(Long usuarioId, Long clienteId, TransportadoraRequestDTO dto) {
        usuarioAcessoService.buscarGestor(usuarioId);

        Cliente cliente = clienteRepository.findById(clienteId)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado"));

        Transportadora transportadora = transportadoraRepository.findByClienteId(clienteId)
                .orElseGet(() -> Transportadora.builder().cliente(cliente).build());

        transportadora.setNome(dto.getNome());
        transportadora.setCnpj(dto.getCnpj());
        transportadora.setTelefone(dto.getTelefone());
        transportadora.setEmail(dto.getEmail());
        transportadora.setCep(dto.getCep());
        transportadora.setEndereco(dto.getEndereco());
        transportadora.setNumero(dto.getNumero());
        transportadora.setComplemento(dto.getComplemento());
        transportadora.setBairro(dto.getBairro());
        transportadora.setCidade(dto.getCidade());
        transportadora.setEstado(dto.getEstado());
        transportadora.setObservacao(dto.getObservacao());

        return toResponse(transportadoraRepository.save(transportadora));
    }

    @Transactional
    public void remover(Long usuarioId, Long clienteId) {
        usuarioAcessoService.buscarGestor(usuarioId);
        transportadoraRepository.deleteByClienteId(clienteId);
    }

    /*
     * Usado internamente pela VendaService para puxar a transportadora
     * do cliente sem repetir a checagem de acesso do gestor (já feita
     * no fluxo de criação da venda).
     */
    @Transactional(readOnly = true)
    public Optional<Transportadora> buscarEntidadePorCliente(Long clienteId) {
        return transportadoraRepository.findByClienteId(clienteId);
    }

    private TransportadoraResponseDTO toResponse(Transportadora t) {
        return TransportadoraResponseDTO.builder()
                .id(t.getId())
                .clienteId(t.getCliente().getId())
                .nome(t.getNome())
                .cnpj(t.getCnpj())
                .telefone(t.getTelefone())
                .email(t.getEmail())
                .cep(t.getCep())
                .endereco(t.getEndereco())
                .numero(t.getNumero())
                .complemento(t.getComplemento())
                .bairro(t.getBairro())
                .cidade(t.getCidade())
                .estado(t.getEstado())
                .observacao(t.getObservacao())
                .build();
    }
}