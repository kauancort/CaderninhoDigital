package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.request.TransportadoraRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.TransportadoraResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ClienteVinculadoTransportadoraResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.TransportadoraDetalhesResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.UsoTransportadoraResponseDTO;
import com.InovaSkill.CaderninhoDigital.entity.Cliente;
import com.InovaSkill.CaderninhoDigital.entity.Transportadora;
import com.InovaSkill.CaderninhoDigital.entity.TipoCliente;
import com.InovaSkill.CaderninhoDigital.exception.ResourceNotFoundException;
import com.InovaSkill.CaderninhoDigital.repository.ClienteRepository;
import com.InovaSkill.CaderninhoDigital.repository.TransportadoraRepository;
import java.util.Optional;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.jdbc.core.JdbcTemplate;

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
    private final JdbcTemplate jdbcTemplate;

    @Transactional(readOnly = true)
    public Optional<TransportadoraResponseDTO> buscarPorCliente(Long usuarioId, Long clienteId) {
        usuarioAcessoService.buscarGestor(usuarioId);
        return transportadoraRepository.findByClienteId(clienteId).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public TransportadoraDetalhesResponseDTO buscarDetalhes(Long usuarioId, Long clienteId) {
        var gestor = usuarioAcessoService.buscarGestor(usuarioId);
        Cliente transportadora = clienteRepository.findById(clienteId)
                .orElseThrow(() -> new ResourceNotFoundException("Transportadora não encontrada"));

        if (transportadora.getTipo() != TipoCliente.TRANSPORTADORA) {
            throw new ResourceNotFoundException("Transportadora não encontrada");
        }

        String nome = transportadora.getNome();
        List<ClienteVinculadoTransportadoraResponseDTO> clientesVinculados = jdbcTemplate.query("""
                SELECT c.id, c.nome, c.tipo
                FROM transportadoras t
                JOIN clientes c ON c.id = t.cliente_id
                WHERE c.gestor_id = ?
                  AND LOWER(TRIM(t.nome)) = LOWER(TRIM(?))
                ORDER BY c.nome
                """, (rs, rowNum) -> ClienteVinculadoTransportadoraResponseDTO.builder()
                .id(rs.getLong("id"))
                .nome(rs.getString("nome"))
                .tipo(rs.getString("tipo") == null ? null : TipoCliente.valueOf(rs.getString("tipo")))
                .build(), gestor.getId(), nome);

        List<UsoTransportadoraResponseDTO> historico = jdbcTemplate.query("""
                SELECT v.id AS venda_id, c.id AS cliente_id, c.nome AS cliente_nome,
                       v.data_venda, e.custo_envio, e.data_envio, e.previsao_entrega,
                       e.codigo_rastreamento, v.situacao_despacho
                FROM envios_venda e
                JOIN vendas v ON v.id = e.venda_id
                JOIN clientes c ON c.id = v.cliente_id
                WHERE v.gestor_id = ?
                  AND e.forma_envio = 'TRANSPORTADORA'
                  AND LOWER(TRIM(e.transportadora_nome)) = LOWER(TRIM(?))
                ORDER BY v.data_venda DESC, v.id DESC
                """, (rs, rowNum) -> UsoTransportadoraResponseDTO.builder()
                .vendaId(rs.getLong("venda_id"))
                .clienteId(rs.getLong("cliente_id"))
                .clienteNome(rs.getString("cliente_nome"))
                .dataVenda(rs.getObject("data_venda", java.time.LocalDate.class))
                .custoEnvio(rs.getBigDecimal("custo_envio"))
                .dataEnvio(rs.getObject("data_envio", java.time.LocalDate.class))
                .previsaoEntrega(rs.getObject("previsao_entrega", java.time.LocalDate.class))
                .codigoRastreamento(rs.getString("codigo_rastreamento"))
                .situacaoDespacho(rs.getString("situacao_despacho"))
                .build(), gestor.getId(), nome);

        return TransportadoraDetalhesResponseDTO.builder()
                .id(transportadora.getId())
                .nome(nome)
                .clientesVinculados(clientesVinculados)
                .historico(historico)
                .build();
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
