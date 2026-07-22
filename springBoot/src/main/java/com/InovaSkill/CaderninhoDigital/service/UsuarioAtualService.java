package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.enums.PerfilUsuario;
import com.InovaSkill.CaderninhoDigital.exception.ResourceNotFoundException;
import com.InovaSkill.CaderninhoDigital.repository.UsuarioRepository;
import com.InovaSkill.CaderninhoDigital.security.UsuarioPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UsuarioAtualService {
    private final UsuarioRepository usuarioRepository;

    public Usuario buscarGestor() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (!(principal instanceof UsuarioPrincipal usuarioPrincipal)) {
            throw new AccessDeniedException("Usuário autenticado não encontrado");
        }
        Usuario usuario = usuarioRepository.findById(usuarioPrincipal.id())
                .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado"));
        if (usuario.getPerfil() != PerfilUsuario.GESTOR) {
            throw new AccessDeniedException("Apenas gestores podem acessar este recurso");
        }
        return usuario;
    }
}
