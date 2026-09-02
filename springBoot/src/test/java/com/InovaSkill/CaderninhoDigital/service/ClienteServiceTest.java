package com.InovaSkill.CaderninhoDigital.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.InovaSkill.CaderninhoDigital.dto.request.ClienteRequestDTO;
import com.InovaSkill.CaderninhoDigital.entity.Cliente;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.entity.TipoCliente;
import com.InovaSkill.CaderninhoDigital.repository.ClienteRepository;
import com.InovaSkill.CaderninhoDigital.exception.BusinessException;
import java.util.Optional;
import org.mockito.ArgumentCaptor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ClienteServiceTest {
    @Mock private ClienteRepository clienteRepository;
    @Mock private UsuarioAcessoService usuarioAcessoService;
    @InjectMocks private ClienteService clienteService;

    @Test
    void gestorPodeConsultarClienteCriadoPorOutroGestor() {
        Usuario solicitante = Usuario.builder().id(1L).build();
        Usuario autor = Usuario.builder().id(2L).nome("Gestor autor").build();
        Cliente cliente = Cliente.builder()
                .id(10L).nome("Cliente compartilhado").ativo(true).gestor(autor).build();
        when(usuarioAcessoService.buscarGestor(1L)).thenReturn(solicitante);
        when(clienteRepository.findById(10L)).thenReturn(Optional.of(cliente));

        var response = clienteService.buscar(1L, 10L);

        assertThat(response.getId()).isEqualTo(10L);
        assertThat(response.getGestorId()).isEqualTo(2L);
        assertThat(response.getGestorNome()).isEqualTo("Gestor autor");
        assertThat(response.getCep()).isNull();
        assertThat(response.getBairro()).isNull();
        assertThat(response.getInscricaoEstadual()).isNull();
    }

    @Test
    void criaClienteComNovosDadosCadastrais() {
        Usuario gestor = Usuario.builder().id(1L).nome("Gestora").build();
        ClienteRequestDTO dto = dtoBasico();
        dto.setCep("12345678");
        dto.setEndereco("Rua das Flores");
        dto.setNumero("123-A");
        dto.setComplemento("Fundos");
        dto.setBairro("Centro");
        dto.setInscricaoEstadual("ISENTO");
        dto.setCidade("São Paulo");
        dto.setEstado("SP");
        when(usuarioAcessoService.buscarGestor(1L)).thenReturn(gestor);
        when(clienteRepository.save(org.mockito.ArgumentMatchers.any(Cliente.class)))
                .thenAnswer(invocation -> {
                    Cliente salvo = invocation.getArgument(0);
                    salvo.setId(10L);
                    return salvo;
                });

        var response = clienteService.criar(1L, dto);

        assertThat(response.getCep()).isEqualTo("12345678");
        assertThat(response.getEndereco()).isEqualTo("Rua das Flores");
        assertThat(response.getNumero()).isEqualTo("123-A");
        assertThat(response.getComplemento()).isEqualTo("Fundos");
        assertThat(response.getBairro()).isEqualTo("Centro");
        assertThat(response.getInscricaoEstadual()).isEqualTo("ISENTO");
        assertThat(response.getCidade()).isEqualTo("São Paulo");
        assertThat(response.getEstado()).isEqualTo("SP");
    }

    @Test
    void criaClienteSemCamposOpcionaisEEmail() {
        Usuario gestor = Usuario.builder().id(1L).nome("Gestora").build();
        when(usuarioAcessoService.buscarGestor(1L)).thenReturn(gestor);
        when(clienteRepository.save(org.mockito.ArgumentMatchers.any(Cliente.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ClienteRequestDTO dto = dtoBasico();
        dto.setEmail(null);
        var response = clienteService.criar(1L, dto);

        assertThat(response.getCep()).isNull();
        assertThat(response.getInscricaoEstadual()).isNull();
        assertThat(response.getComplemento()).isNull();
        assertThat(response.getEmail()).isNull();
    }

    @Test
    void criaTransportadoraSomenteComNome() {
        Usuario gestor = Usuario.builder().id(1L).nome("Gestora").build();
        ClienteRequestDTO dto = new ClienteRequestDTO();
        dto.setNome("Jadlog");
        dto.setTipo(TipoCliente.TRANSPORTADORA);
        when(usuarioAcessoService.buscarGestor(1L)).thenReturn(gestor);
        when(clienteRepository.save(org.mockito.ArgumentMatchers.any(Cliente.class)))
                .thenAnswer(invocation -> {
                    Cliente salvo = invocation.getArgument(0);
                    salvo.setId(20L);
                    return salvo;
                });

        var response = clienteService.criar(1L, dto);

        assertThat(response.getNome()).isEqualTo("Jadlog");
        assertThat(response.getTipo()).isEqualTo(TipoCliente.TRANSPORTADORA);
        assertThat(response.getEstado()).isNull();
        assertThat(response.getDocumento()).isNull();
    }

    @Test
    void atualizaEGravaNovosDados() {
        Usuario gestor = Usuario.builder().id(1L).nome("Gestora").build();
        Cliente existente = Cliente.builder().id(10L).nome("Antigo").ativo(true).gestor(gestor).build();
        ClienteRequestDTO dto = dtoBasico();
        dto.setCep("87654321");
        dto.setBairro("Novo bairro");
        dto.setNumero("45");
        dto.setComplemento("Casa 2");
        dto.setInscricaoEstadual("110.042.490.114");
        dto.setCidade("Recife");
        dto.setEstado("PE");
        when(usuarioAcessoService.buscarGestor(1L)).thenReturn(gestor);
        when(clienteRepository.findById(10L)).thenReturn(Optional.of(existente));
        when(clienteRepository.save(existente)).thenReturn(existente);

        clienteService.atualizar(1L, 10L, dto);

        ArgumentCaptor<Cliente> captor = ArgumentCaptor.forClass(Cliente.class);
        verify(clienteRepository).save(captor.capture());
        assertThat(captor.getValue().getCep()).isEqualTo("87654321");
        assertThat(captor.getValue().getBairro()).isEqualTo("Novo bairro");
        assertThat(captor.getValue().getNumero()).isEqualTo("45");
        assertThat(captor.getValue().getComplemento()).isEqualTo("Casa 2");
        assertThat(captor.getValue().getInscricaoEstadual()).isEqualTo("110.042.490.114");
        assertThat(captor.getValue().getCidade()).isEqualTo("Recife");
        assertThat(captor.getValue().getEstado()).isEqualTo("PE");
    }

    @Test
    void aceitaCnpjValidoERejeitaDocumentosInvalidos() {
        Usuario gestor = Usuario.builder().id(1L).nome("Gestora").build();
        ClienteRequestDTO dto = dtoBasico();
        dto.setDocumento("11.222.333/0001-81");
        when(usuarioAcessoService.buscarGestor(1L)).thenReturn(gestor);
        when(clienteRepository.save(org.mockito.ArgumentMatchers.any(Cliente.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        assertThat(clienteService.criar(1L, dto).getDocumento()).isEqualTo("11222333000181");

        dto.setDocumento("111.111.111-11");
        assertThatThrownBy(() -> clienteService.criar(1L, dto))
                .isInstanceOf(BusinessException.class)
                .hasMessage("O CPF informado não é válido");
    }

    private ClienteRequestDTO dtoBasico() {
        ClienteRequestDTO dto = new ClienteRequestDTO();
        dto.setNome("Cliente");
        dto.setEmail("cliente@email.com");
        dto.setTelefone("(11) 99999-9999");
        dto.setDocumento("529.982.247-25");
        dto.setEndereco("Rua A");
        dto.setNumero("10");
        dto.setBairro("Centro");
        dto.setCidade("São Paulo");
        dto.setEstado("SP");
        return dto;
    }
}
