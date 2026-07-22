package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.request.LoginRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.PrimeiroAcessoRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.BootstrapStatusResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.LoginResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.UsuarioResponseDTO;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.enums.PerfilUsuario;
import com.InovaSkill.CaderninhoDigital.exception.BusinessException;
import com.InovaSkill.CaderninhoDigital.repository.UsuarioRepository;
import com.InovaSkill.CaderninhoDigital.security.JwtService;
import com.InovaSkill.CaderninhoDigital.security.UsuarioPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {
    private static final String EMAIL_ADMIN_INICIAL = "adm@gmail.com";
    private final UsuarioRepository usuarioRepository;
    private final AuthenticationManager authenticationManager;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public LoginResponseDTO login(LoginRequestDTO dto) {
        String email = normalizarEmail(dto.getEmail());
        UsuarioPrincipal principal;
        try {
            var authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(email, dto.getSenha()));
            principal = (UsuarioPrincipal) authentication.getPrincipal();
        } catch (AuthenticationException exception) {
            throw new BusinessException("E-mail ou senha inválidos");
        }

        if (!"GESTOR".equals(principal.perfil())) {
            throw new AccessDeniedException("Apenas gestores podem acessar o sistema");
        }
        if (principal.trocaSenhaObrigatoria()) {
            return LoginResponseDTO.trocaObrigatoria(principal.email());
        }
        return criarSessao(principal);
    }

    @Transactional
    public LoginResponseDTO primeiroAcesso(PrimeiroAcessoRequestDTO dto) {
        String email = normalizarEmail(dto.getEmail());
        Usuario usuario = usuarioRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException("E-mail ou senha atual inválidos"));
        if (!Boolean.TRUE.equals(usuario.getTrocaSenhaObrigatoria())) {
            throw new BusinessException("A troca inicial de senha já foi concluída");
        }
        if (!passwordEncoder.matches(dto.getSenhaAtual(), usuario.getSenha())) {
            throw new BusinessException("E-mail ou senha atual inválidos");
        }
        if (usuario.getPerfil() != PerfilUsuario.GESTOR) {
            throw new AccessDeniedException("Apenas gestores podem acessar o sistema");
        }
        usuario.setSenha(passwordEncoder.encode(dto.getNovaSenha()));
        usuario.setTrocaSenhaObrigatoria(false);
        Usuario salvo = usuarioRepository.save(usuario);
        return criarSessao(UsuarioPrincipal.de(salvo));
    }

    public BootstrapStatusResponseDTO bootstrapStatus() {
        boolean disponivel = usuarioRepository.findByEmail(EMAIL_ADMIN_INICIAL)
                .map(usuario -> Boolean.TRUE.equals(usuario.getTrocaSenhaObrigatoria())
                        && passwordEncoder.matches("123", usuario.getSenha()))
                .orElse(false);
        return new BootstrapStatusResponseDTO(disponivel);
    }

    private LoginResponseDTO criarSessao(UsuarioPrincipal principal) {
        JwtService.TokenGerado token = jwtService.gerar(principal);
        UsuarioResponseDTO user = UsuarioResponseDTO.builder()
                .id(principal.id()).nome(principal.nome()).email(principal.email())
                .cargoFuncao(principal.cargoFuncao()).perfil(PerfilUsuario.valueOf(principal.perfil())).build();
        return new LoginResponseDTO(
                token.valor(), "Bearer", JwtService.DURACAO.toSeconds(), token.expiraEm(),
                user, false, null);
    }

    private String normalizarEmail(String email) {
        return email.trim().toLowerCase();
    }
}
