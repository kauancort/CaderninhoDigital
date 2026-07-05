package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.enums.PerfilUsuario;
import com.InovaSkill.CaderninhoDigital.exception.BusinessException;
import com.InovaSkill.CaderninhoDigital.exception.ResourceNotFoundException;
import com.InovaSkill.CaderninhoDigital.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UsuarioAcessoService {

    private final UsuarioRepository usuarioRepository;

    public Usuario buscarGestor(Long usuarioId) {
        Usuario usuario = usuarioRepository.findById(usuarioId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado"));

        if (usuario.getPerfil() != PerfilUsuario.GESTOR) {
            throw new BusinessException("Nesta primeira versão, apenas gestores podem acessar este recurso");
        }

        return usuario;
    }
}
