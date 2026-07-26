package com.InovaSkill.CaderninhoDigital.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.InovaSkill.CaderninhoDigital.dto.request.PasswordRecoveryRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.PasswordRecoveryResetRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.PasswordRecoveryVerifyRequestDTO;
import com.InovaSkill.CaderninhoDigital.entity.PasswordRecovery;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.exception.BusinessException;
import com.InovaSkill.CaderninhoDigital.repository.PasswordRecoveryRepository;
import com.InovaSkill.CaderninhoDigital.repository.UsuarioRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.MailSendException;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class PasswordRecoveryServiceTest {
    private static final String RESPOSTA_GENERICA =
            "Se o e-mail estiver cadastrado, enviaremos um código de recuperação.";
    private static final LocalDateTime AGORA = LocalDateTime.of(2026, 7, 26, 12, 0);

    @Mock private UsuarioRepository usuarioRepository;
    @Mock private PasswordRecoveryRepository recoveryRepository;
    @Mock private EmailService emailService;
    @Mock private PasswordEncoder passwordEncoder;

    private PasswordRecoveryService service;
    private Usuario usuario;

    @BeforeEach
    void configurar() {
        Clock clock = Clock.fixed(
                Instant.parse("2026-07-26T15:00:00Z"),
                ZoneId.of("America/Sao_Paulo"));
        service = new PasswordRecoveryService(
                usuarioRepository, recoveryRepository, emailService, passwordEncoder, clock);
        usuario = Usuario.builder()
                .id(7L)
                .nome("Maria")
                .email("maria@teste.com")
                .senha("hash-atual")
                .trocaSenhaObrigatoria(false)
                .build();
    }

    @Test
    void solicitaParaEmailExistenteSemExporCodigo() {
        when(usuarioRepository.findByEmailForUpdate("maria@teste.com")).thenReturn(Optional.of(usuario));
        when(recoveryRepository.findFirstByUsuarioOrderByCriadoEmDesc(usuario)).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hash-codigo");
        when(recoveryRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var resposta = service.solicitar(solicitacao(" MARIA@teste.com "));

        assertThat(resposta.message()).isEqualTo(RESPOSTA_GENERICA);
        ArgumentCaptor<String> codigo = ArgumentCaptor.forClass(String.class);
        verify(emailService).enviarCodigoRecuperacao(
                org.mockito.ArgumentMatchers.eq("maria@teste.com"),
                org.mockito.ArgumentMatchers.eq("Maria"),
                codigo.capture());
        assertThat(codigo.getValue()).matches("\\d{6}");
    }

    @Test
    void respondeIgualParaEmailInexistente() {
        when(usuarioRepository.findByEmailForUpdate("ninguem@teste.com")).thenReturn(Optional.empty());

        var resposta = service.solicitar(solicitacao("ninguem@teste.com"));

        assertThat(resposta.message()).isEqualTo(RESPOSTA_GENERICA);
        verify(emailService, never()).enviarCodigoRecuperacao(anyString(), anyString(), anyString());
    }

    @Test
    void respeitaCooldownSemEnviarOutroCodigo() {
        when(usuarioRepository.findByEmailForUpdate("maria@teste.com")).thenReturn(Optional.of(usuario));
        when(recoveryRepository.findFirstByUsuarioOrderByCriadoEmDesc(usuario))
                .thenReturn(Optional.of(recovery(AGORA.minusSeconds(30), AGORA.plusMinutes(9))));

        var resposta = service.solicitar(solicitacao("maria@teste.com"));

        assertThat(resposta.message()).isEqualTo(RESPOSTA_GENERICA);
        verify(recoveryRepository, never()).invalidarPendentes(any(), any());
        verify(emailService, never()).enviarCodigoRecuperacao(anyString(), anyString(), anyString());
    }

    @Test
    void novaSolicitacaoInvalidaCodigosAnteriores() {
        when(usuarioRepository.findByEmailForUpdate("maria@teste.com")).thenReturn(Optional.of(usuario));
        when(recoveryRepository.findFirstByUsuarioOrderByCriadoEmDesc(usuario))
                .thenReturn(Optional.of(recovery(AGORA.minusMinutes(2), AGORA.plusMinutes(8))));
        when(passwordEncoder.encode(anyString())).thenReturn("hash-codigo");
        when(recoveryRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        service.solicitar(solicitacao("maria@teste.com"));

        verify(recoveryRepository).invalidarPendentes(usuario, AGORA);
        verify(emailService).enviarCodigoRecuperacao(
                org.mockito.ArgumentMatchers.eq("maria@teste.com"),
                org.mockito.ArgumentMatchers.eq("Maria"),
                anyString());
    }

    @Test
    void falhaSmtpNaoExpoemDetalhesNemMantemCodigoAtivo() {
        when(usuarioRepository.findByEmailForUpdate("maria@teste.com")).thenReturn(Optional.of(usuario));
        when(recoveryRepository.findFirstByUsuarioOrderByCriadoEmDesc(usuario)).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hash-codigo");
        when(recoveryRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        org.mockito.Mockito.doThrow(new MailSendException("credencial SMTP secreta"))
                .when(emailService).enviarCodigoRecuperacao(anyString(), anyString(), anyString());

        var resposta = service.solicitar(solicitacao("maria@teste.com"));

        assertThat(resposta.message()).isEqualTo(RESPOSTA_GENERICA);
        ArgumentCaptor<PasswordRecovery> captor = ArgumentCaptor.forClass(PasswordRecovery.class);
        verify(recoveryRepository, org.mockito.Mockito.atLeast(2)).save(captor.capture());
        assertThat(captor.getValue().getUsadoEm()).isEqualTo(AGORA);
    }

    @Test
    void codigoCorretoGeraTokenTemporarioEConsomeCodigo() {
        PasswordRecovery recovery = recovery(AGORA.minusMinutes(1), AGORA.plusMinutes(9));
        when(usuarioRepository.findByEmailForUpdate("maria@teste.com")).thenReturn(Optional.of(usuario));
        when(recoveryRepository.findFirstByUsuarioAndUsadoEmIsNullOrderByCriadoEmDesc(usuario))
                .thenReturn(Optional.of(recovery));
        when(passwordEncoder.matches("123456", "hash-codigo")).thenReturn(true);

        var resposta = service.verificar(verificacao("123456"));

        assertThat(resposta.recoveryToken()).isNotBlank();
        assertThat(resposta.expiresAt()).isEqualTo(AGORA.plusMinutes(10));
        assertThat(recovery.getVerificadoEm()).isEqualTo(AGORA);
        assertThat(recovery.getRecoveryTokenHash()).hasSize(64);
    }

    @Test
    void codigoIncorretoIncrementaTentativas() {
        PasswordRecovery recovery = recovery(AGORA.minusMinutes(1), AGORA.plusMinutes(9));
        when(usuarioRepository.findByEmailForUpdate("maria@teste.com")).thenReturn(Optional.of(usuario));
        when(recoveryRepository.findFirstByUsuarioAndUsadoEmIsNullOrderByCriadoEmDesc(usuario))
                .thenReturn(Optional.of(recovery));
        when(passwordEncoder.matches("000000", "hash-codigo")).thenReturn(false);

        assertThatThrownBy(() -> service.verificar(verificacao("000000")))
                .isInstanceOf(BusinessException.class)
                .hasMessage("Código inválido ou expirado.");
        assertThat(recovery.getTentativas()).isEqualTo(1);
    }

    @Test
    void excessoDeTentativasInvalidaCodigo() {
        PasswordRecovery recovery = recovery(AGORA.minusMinutes(1), AGORA.plusMinutes(9));
        recovery.setTentativas(4);
        when(usuarioRepository.findByEmailForUpdate("maria@teste.com")).thenReturn(Optional.of(usuario));
        when(recoveryRepository.findFirstByUsuarioAndUsadoEmIsNullOrderByCriadoEmDesc(usuario))
                .thenReturn(Optional.of(recovery));
        when(passwordEncoder.matches("000000", "hash-codigo")).thenReturn(false);

        assertThatThrownBy(() -> service.verificar(verificacao("000000")))
                .isInstanceOf(BusinessException.class);
        assertThat(recovery.getTentativas()).isEqualTo(5);
        assertThat(recovery.getUsadoEm()).isEqualTo(AGORA);
    }

    @Test
    void rejeitaCodigoExpirado() {
        PasswordRecovery recovery = recovery(AGORA.minusMinutes(11), AGORA.minusSeconds(1));
        when(usuarioRepository.findByEmailForUpdate("maria@teste.com")).thenReturn(Optional.of(usuario));
        when(recoveryRepository.findFirstByUsuarioAndUsadoEmIsNullOrderByCriadoEmDesc(usuario))
                .thenReturn(Optional.of(recovery));

        assertThatThrownBy(() -> service.verificar(verificacao("123456")))
                .isInstanceOf(BusinessException.class)
                .hasMessage("Código inválido ou expirado.");
        assertThat(recovery.getUsadoEm()).isEqualTo(AGORA);
    }

    @Test
    void rejeitaCodigoJaUtilizado() {
        when(usuarioRepository.findByEmailForUpdate("maria@teste.com")).thenReturn(Optional.of(usuario));
        when(recoveryRepository.findFirstByUsuarioAndUsadoEmIsNullOrderByCriadoEmDesc(usuario))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.verificar(verificacao("123456")))
                .isInstanceOf(BusinessException.class)
                .hasMessage("Código inválido ou expirado.");
    }

    @Test
    void redefineSenhaComTokenValidoEHashSeguro() {
        PasswordRecovery recovery = recoveryVerificado();
        when(recoveryRepository.findByRecoveryTokenHashAndUsadoEmIsNull(anyString()))
                .thenReturn(Optional.of(recovery));
        when(passwordEncoder.encode("NovaSenha123")).thenReturn("novo-hash");

        var resposta = service.redefinir(reset("token-valido", "NovaSenha123", "NovaSenha123"));

        assertThat(resposta.message()).isEqualTo("Senha redefinida com sucesso.");
        assertThat(usuario.getSenha()).isEqualTo("novo-hash");
        assertThat(recovery.getUsadoEm()).isEqualTo(AGORA);
        verify(recoveryRepository).invalidarPendentes(usuario, AGORA);
    }

    @Test
    void rejeitaTokenInvalidoOuReutilizado() {
        when(recoveryRepository.findByRecoveryTokenHashAndUsadoEmIsNull(anyString()))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.redefinir(reset("invalido", "NovaSenha123", "NovaSenha123")))
                .isInstanceOf(BusinessException.class)
                .hasMessage("Autorização de recuperação inválida ou expirada.");
    }

    @Test
    void rejeitaTokenExpirado() {
        PasswordRecovery recovery = recoveryVerificado();
        recovery.setRecoveryTokenExpiraEm(AGORA.minusSeconds(1));
        when(recoveryRepository.findByRecoveryTokenHashAndUsadoEmIsNull(anyString()))
                .thenReturn(Optional.of(recovery));

        assertThatThrownBy(() -> service.redefinir(reset("token", "NovaSenha123", "NovaSenha123")))
                .isInstanceOf(BusinessException.class)
                .hasMessage("Autorização de recuperação inválida ou expirada.");
        assertThat(recovery.getUsadoEm()).isEqualTo(AGORA);
    }

    @Test
    void rejeitaConfirmacaoDiferenteESenhaFraca() {
        assertThatThrownBy(() -> service.redefinir(reset("token", "NovaSenha123", "diferente")))
                .isInstanceOf(BusinessException.class)
                .hasMessage("A confirmação da senha não coincide.");
        assertThatThrownBy(() -> service.redefinir(reset("token", "abcdef", "abcdef")))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("ao menos uma letra e um número");
        verify(recoveryRepository, never()).findByRecoveryTokenHashAndUsadoEmIsNull(anyString());
    }

    private PasswordRecoveryRequestDTO solicitacao(String email) {
        PasswordRecoveryRequestDTO dto = new PasswordRecoveryRequestDTO();
        dto.setEmail(email);
        return dto;
    }

    private PasswordRecoveryVerifyRequestDTO verificacao(String codigo) {
        PasswordRecoveryVerifyRequestDTO dto = new PasswordRecoveryVerifyRequestDTO();
        dto.setEmail("maria@teste.com");
        dto.setCode(codigo);
        return dto;
    }

    private PasswordRecoveryResetRequestDTO reset(String token, String senha, String confirmacao) {
        PasswordRecoveryResetRequestDTO dto = new PasswordRecoveryResetRequestDTO();
        dto.setRecoveryToken(token);
        dto.setNewPassword(senha);
        dto.setConfirmPassword(confirmacao);
        return dto;
    }

    private PasswordRecovery recovery(LocalDateTime criadoEm, LocalDateTime expiraEm) {
        return PasswordRecovery.builder()
                .id(1L)
                .usuario(usuario)
                .codeHash("hash-codigo")
                .criadoEm(criadoEm)
                .expiraEm(expiraEm)
                .tentativas(0)
                .build();
    }

    private PasswordRecovery recoveryVerificado() {
        PasswordRecovery recovery = recovery(AGORA.minusMinutes(2), AGORA.plusMinutes(8));
        recovery.setVerificadoEm(AGORA.minusMinutes(1));
        recovery.setRecoveryTokenHash("hash-token");
        recovery.setRecoveryTokenExpiraEm(AGORA.plusMinutes(9));
        return recovery;
    }
}
