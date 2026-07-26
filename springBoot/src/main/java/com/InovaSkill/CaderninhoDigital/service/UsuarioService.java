package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.request.CriarUsuarioRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.AtualizarPerfilRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.CriarUsuarioResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.UsuarioResponseDTO;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.exception.BusinessException;
import com.InovaSkill.CaderninhoDigital.repository.UsuarioRepository;
import java.security.SecureRandom;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UsuarioService {
    private static final char[] CARACTERES = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789".toCharArray();
    private final UsuarioRepository usuarioRepository;
    private final UsuarioAtualService usuarioAtualService;
    private final PasswordEncoder passwordEncoder;
    private final SecureRandom secureRandom = new SecureRandom();

    @Transactional(readOnly = true)
    public List<UsuarioResponseDTO> listar() {
        usuarioAtualService.buscarGestor();
        return usuarioRepository.findAllByOrderByNomeAsc().stream().map(this::toResponse).toList();
    }

    @Transactional
    public CriarUsuarioResponseDTO criar(CriarUsuarioRequestDTO dto) {
        usuarioAtualService.buscarGestor();
        String email = dto.getEmail().trim().toLowerCase();
        if (usuarioRepository.existsByEmail(email)) {
            throw new BusinessException("Já existe um usuário cadastrado com este e-mail");
        }
        String senhaTemporaria = gerarSenhaTemporaria();
        Usuario usuario = Usuario.builder()
                .nome(dto.getNome().trim()).email(email).cargoFuncao(dto.getCargoFuncao().trim())
                .perfil(dto.getPerfil()).senha(passwordEncoder.encode(senhaTemporaria))
                .trocaSenhaObrigatoria(true).build();
        Usuario salvo = usuarioRepository.save(usuario);
        return new CriarUsuarioResponseDTO(toResponse(salvo), senhaTemporaria);
    }

    @Transactional
    public UsuarioResponseDTO atualizarPerfil(Long usuarioId, AtualizarPerfilRequestDTO dto) {
        Usuario usuario = usuarioRepository.findById(usuarioId)
                .orElseThrow(() -> new BusinessException("Usuário autenticado não encontrado"));
        usuario.setNome(dto.getNome().trim());

        if (dto.getNovaSenha() != null && !dto.getNovaSenha().isBlank()) {
            if (dto.getSenhaAtual() == null
                    || !passwordEncoder.matches(dto.getSenhaAtual(), usuario.getSenha())) {
                throw new BusinessException("A senha atual está incorreta");
            }
            if (!dto.getNovaSenha().matches(".*[A-Za-z].*")
                    || !dto.getNovaSenha().matches(".*\\d.*")) {
                throw new BusinessException("A nova senha deve conter ao menos uma letra e um número");
            }
            if (passwordEncoder.matches(dto.getNovaSenha(), usuario.getSenha())) {
                throw new BusinessException("A nova senha deve ser diferente da senha atual");
            }
            usuario.setSenha(passwordEncoder.encode(dto.getNovaSenha()));
            usuario.setTrocaSenhaObrigatoria(false);
        }
        return toResponse(usuarioRepository.save(usuario));
    }

    private String gerarSenhaTemporaria() {
        StringBuilder senha = new StringBuilder(12);
        for (int i = 0; i < 12; i++) {
            senha.append(CARACTERES[secureRandom.nextInt(CARACTERES.length)]);
        }
        return senha.toString();
    }

    private UsuarioResponseDTO toResponse(Usuario usuario) {
        return UsuarioResponseDTO.builder().id(usuario.getId()).nome(usuario.getNome())
                .email(usuario.getEmail()).cargoFuncao(usuario.getCargoFuncao()).perfil(usuario.getPerfil()).build();
    }
}
