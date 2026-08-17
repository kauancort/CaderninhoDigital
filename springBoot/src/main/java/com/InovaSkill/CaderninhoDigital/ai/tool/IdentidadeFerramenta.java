package com.InovaSkill.CaderninhoDigital.ai.tool;

import com.InovaSkill.CaderninhoDigital.enums.PerfilUsuario;

public record IdentidadeFerramenta(Long usuarioId, Long empresaId, PerfilUsuario perfil) {
    /** Mantém fixtures antigas; a aplicação sempre usa o construtor com empresa explícita. */
    public IdentidadeFerramenta(Long usuarioId, PerfilUsuario perfil) {
        this(usuarioId, usuarioId, perfil);
    }
}
