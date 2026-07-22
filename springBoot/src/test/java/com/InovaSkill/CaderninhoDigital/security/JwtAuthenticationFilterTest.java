package com.InovaSkill.CaderninhoDigital.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.enums.PerfilUsuario;
import com.InovaSkill.CaderninhoDigital.repository.UsuarioRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;

class JwtAuthenticationFilterTest {
    private final JwtDecoder decoder = mock(JwtDecoder.class);
    private final UsuarioRepository usuarios = mock(UsuarioRepository.class);
    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
    private final JwtAuthenticationFilter filter = new JwtAuthenticationFilter(
            decoder, usuarios, new RestAuthenticationEntryPoint(objectMapper));

    @AfterEach
    void limparContexto() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void tokenInvalidoRetorna401SemVirar500() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/produtos");
        request.addHeader("Authorization", "Bearer adulterado");
        MockHttpServletResponse response = new MockHttpServletResponse();
        when(decoder.decode("adulterado")).thenThrow(new BadJwtException("inválido"));

        filter.doFilter(request, response, new MockFilterChain());

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getContentAsString()).contains("token inválido");
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void tokenValidoColocaUsuarioDoBancoNoSecurityContext() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/produtos");
        request.addHeader("Authorization", "Bearer valido");
        MockHttpServletResponse response = new MockHttpServletResponse();
        Jwt jwt = mock(Jwt.class);
        when(jwt.getSubject()).thenReturn("2");
        when(decoder.decode("valido")).thenReturn(jwt);
        when(usuarios.findById(2L)).thenReturn(Optional.of(Usuario.builder()
                .id(2L).nome("Gestora").email("gestora@test.local").senha("hash")
                .cargoFuncao("Gestora").perfil(PerfilUsuario.GESTOR).trocaSenhaObrigatoria(false).build()));

        filter.doFilter(request, response, new MockFilterChain());

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(SecurityContextHolder.getContext().getAuthentication().getPrincipal())
                .isInstanceOf(UsuarioPrincipal.class);
        assertThat(((UsuarioPrincipal) SecurityContextHolder.getContext().getAuthentication().getPrincipal()).id())
                .isEqualTo(2L);
    }
}
