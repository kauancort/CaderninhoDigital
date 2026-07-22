package com.InovaSkill.CaderninhoDigital.security;

import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import java.util.Collection;
import java.util.List;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

public record UsuarioPrincipal(
        Long id,
        String nome,
        String email,
        String senha,
        String cargoFuncao,
        String perfil,
        boolean trocaSenhaObrigatoria
) implements UserDetails {

    public static UsuarioPrincipal de(Usuario usuario) {
        return new UsuarioPrincipal(
                usuario.getId(), usuario.getNome(), usuario.getEmail(), usuario.getSenha(),
                usuario.getCargoFuncao(), usuario.getPerfil().name(),
                Boolean.TRUE.equals(usuario.getTrocaSenhaObrigatoria()));
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + perfil));
    }

    @Override public String getPassword() { return senha; }
    @Override public String getUsername() { return email; }
}
