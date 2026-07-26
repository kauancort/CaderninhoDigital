package com.InovaSkill.CaderninhoDigital.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.InovaSkill.CaderninhoDigital.dto.request.LoginRequestDTO;
import com.InovaSkill.CaderninhoDigital.repository.UsuarioRepository;
import com.InovaSkill.CaderninhoDigital.security.JwtService;
import com.InovaSkill.CaderninhoDigital.security.UsuarioPrincipal;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock private UsuarioRepository usuarioRepository;
    @Mock private AuthenticationManager authenticationManager;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtService jwtService;

    private AuthService authService;

    @BeforeEach
    void configurar() {
        authService = new AuthService(
                usuarioRepository,
                authenticationManager,
                passwordEncoder,
                jwtService);
    }

    @Test
    void exigeTrocaSomenteQuandoUsuarioAindaUsaSenhaTemporaria() {
        UsuarioPrincipal principal = principal(true);
        autenticar(principal);

        var resposta = authService.login(loginRequest());

        assertThat(resposta.requiresPasswordChange()).isTrue();
        assertThat(resposta.email()).isEqualTo("gestora@teste.com");
        assertThat(resposta.token()).isNull();
        verify(jwtService, never()).gerar(principal);
    }

    @Test
    void loginsPosterioresGeramNovasSessoesSemReativarTrocaDeSenha() {
        UsuarioPrincipal principal = principal(false);
        autenticar(principal);
        when(jwtService.gerar(principal))
                .thenReturn(
                        new JwtService.TokenGerado("token-1", Instant.parse("2026-07-26T12:00:00Z")),
                        new JwtService.TokenGerado("token-2", Instant.parse("2026-07-27T12:00:00Z")));

        var primeiroLogin = authService.login(loginRequest());
        var loginDepoisDoLogout = authService.login(loginRequest());

        assertThat(primeiroLogin.requiresPasswordChange()).isFalse();
        assertThat(primeiroLogin.token()).isEqualTo("token-1");
        assertThat(loginDepoisDoLogout.requiresPasswordChange()).isFalse();
        assertThat(loginDepoisDoLogout.token()).isEqualTo("token-2");
        assertThat(loginDepoisDoLogout.user().getId()).isEqualTo(10L);
        verify(jwtService, times(2)).gerar(principal);
    }

    private void autenticar(UsuarioPrincipal principal) {
        when(authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken("gestora@teste.com", "senha")))
                .thenReturn(new UsernamePasswordAuthenticationToken(
                        principal, null, principal.getAuthorities()));
    }

    private LoginRequestDTO loginRequest() {
        LoginRequestDTO request = new LoginRequestDTO();
        request.setEmail(" Gestora@Teste.com ");
        request.setSenha("senha");
        return request;
    }

    private UsuarioPrincipal principal(boolean trocaObrigatoria) {
        return new UsuarioPrincipal(
                10L,
                "Gestora",
                "gestora@teste.com",
                "hash",
                "Gestora",
                "GESTOR",
                trocaObrigatoria);
    }
}
