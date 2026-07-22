package com.InovaSkill.CaderninhoDigital.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.InovaSkill.CaderninhoDigital.entity.Cliente;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.repository.ClienteRepository;
import java.util.Optional;
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
    }
}
