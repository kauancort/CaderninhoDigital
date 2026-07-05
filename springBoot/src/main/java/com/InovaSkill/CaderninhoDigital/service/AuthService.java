package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.request.CadastroUsuarioRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.LoginRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.LoginResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.UsuarioResponseDTO;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.enums.PerfilUsuario;
import com.InovaSkill.CaderninhoDigital.exception.BusinessException;
import com.InovaSkill.CaderninhoDigital.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UsuarioRepository usuarioRepository;

    public UsuarioResponseDTO cadastrar(CadastroUsuarioRequestDTO dto) {
        String email = normalizarEmail(dto.getEmail());

        if (usuarioRepository.existsByEmail(email)) {
            throw new BusinessException("Já existe um usuário cadastrado com este e-mail");
        }

        Usuario usuario = Usuario.builder()
                .nome(dto.getNome())
                .email(email)
                .senha(dto.getSenha())
                .cargoFuncao(dto.getCargoFuncao())
                .perfil(dto.getPerfil())
                .build();

        Usuario salvo = usuarioRepository.save(usuario);

        return UsuarioResponseDTO.builder()
                .id(salvo.getId())
                .nome(salvo.getNome())
                .email(salvo.getEmail())
                .cargoFuncao(salvo.getCargoFuncao())
                .perfil(salvo.getPerfil())
                .build();
    }

    public LoginResponseDTO login(LoginRequestDTO dto) {
        Usuario usuario = usuarioRepository.findByEmail(normalizarEmail(dto.getEmail()))
                .orElseThrow(() -> new BusinessException("E-mail ou senha inválidos"));

        if (!usuario.getSenha().equals(dto.getSenha())) {
            throw new BusinessException("E-mail ou senha inválidos");
        }

        if (usuario.getPerfil() != PerfilUsuario.GESTOR) {
            throw new BusinessException("Nesta primeira versão, apenas gestores podem acessar o sistema");
        }

        return LoginResponseDTO.builder()
                .usuarioId(usuario.getId())
                .nome(usuario.getNome())
                .email(usuario.getEmail())
                .cargoFuncao(usuario.getCargoFuncao())
                .perfil(usuario.getPerfil())
                .mensagem("Login realizado com sucesso")
                .build();
    }

    private String normalizarEmail(String email) {
        return email.trim().toLowerCase();
    }
}
