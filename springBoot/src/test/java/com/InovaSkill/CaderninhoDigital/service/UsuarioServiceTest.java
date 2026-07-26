package com.InovaSkill.CaderninhoDigital.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.InovaSkill.CaderninhoDigital.dto.request.AtualizarPerfilRequestDTO;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.exception.BusinessException;
import com.InovaSkill.CaderninhoDigital.repository.UsuarioRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class UsuarioServiceTest {

    @Mock private UsuarioRepository usuarioRepository;
    @Mock private UsuarioAtualService usuarioAtualService;
    @Mock private PasswordEncoder passwordEncoder;

    private UsuarioService usuarioService;
    private Usuario usuario;

    @BeforeEach
    void configurar() {
        usuarioService = new UsuarioService(usuarioRepository, usuarioAtualService, passwordEncoder);
        usuario = Usuario.builder()
                .id(7L)
                .nome("Nome antigo")
                .email("usuario@teste.com")
                .senha("hash-atual")
                .trocaSenhaObrigatoria(false)
                .build();
        when(usuarioRepository.findById(7L)).thenReturn(Optional.of(usuario));
    }

    @Test
    void atualizaSomenteONomeSemExigirSenha() {
        when(usuarioRepository.save(usuario)).thenReturn(usuario);
        AtualizarPerfilRequestDTO dto = new AtualizarPerfilRequestDTO();
        dto.setNome("  Nome atualizado  ");

        var resposta = usuarioService.atualizarPerfil(7L, dto);

        assertThat(resposta.getNome()).isEqualTo("Nome atualizado");
        assertThat(usuario.getSenha()).isEqualTo("hash-atual");
        verify(passwordEncoder, never()).encode(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void atualizaSenhaQuandoSenhaAtualForValida() {
        when(usuarioRepository.save(usuario)).thenReturn(usuario);
        AtualizarPerfilRequestDTO dto = new AtualizarPerfilRequestDTO();
        dto.setNome("Nome atualizado");
        dto.setSenhaAtual("Senha123");
        dto.setNovaSenha("Nova456");
        when(passwordEncoder.matches("Senha123", "hash-atual")).thenReturn(true);
        when(passwordEncoder.matches("Nova456", "hash-atual")).thenReturn(false);
        when(passwordEncoder.encode("Nova456")).thenReturn("novo-hash");

        usuarioService.atualizarPerfil(7L, dto);

        assertThat(usuario.getSenha()).isEqualTo("novo-hash");
        assertThat(usuario.getTrocaSenhaObrigatoria()).isFalse();
    }

    @Test
    void rejeitaAlteracaoQuandoSenhaAtualForIncorreta() {
        AtualizarPerfilRequestDTO dto = new AtualizarPerfilRequestDTO();
        dto.setNome("Nome atualizado");
        dto.setSenhaAtual("errada");
        dto.setNovaSenha("Nova456");
        when(passwordEncoder.matches("errada", "hash-atual")).thenReturn(false);

        assertThatThrownBy(() -> usuarioService.atualizarPerfil(7L, dto))
                .isInstanceOf(BusinessException.class)
                .hasMessage("A senha atual está incorreta");

        verify(usuarioRepository, never()).save(usuario);
    }
}
