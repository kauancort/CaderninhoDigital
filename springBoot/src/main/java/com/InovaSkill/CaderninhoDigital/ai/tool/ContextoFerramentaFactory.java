package com.InovaSkill.CaderninhoDigital.ai.tool;

import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import com.InovaSkill.CaderninhoDigital.enums.PerfilUsuario;
import com.InovaSkill.CaderninhoDigital.exception.CodigoErroOrquestrador;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import com.InovaSkill.CaderninhoDigital.security.UsuarioPrincipal;
import com.InovaSkill.CaderninhoDigital.repository.UsuarioRepository;
import java.time.Clock;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public final class ContextoFerramentaFactory {
    private static final String CORRELACAO_SEGURA = "[A-Za-z0-9._-]{1,100}";

    private final Clock clock;
    private final AiOrchestratorProperties properties;
    private final UsuarioRepository usuarios;

    public ContextoFerramentaFactory(Clock clock, AiOrchestratorProperties properties,
            UsuarioRepository usuarios) {
        this.clock = clock;
        this.properties = properties;
        this.usuarios = usuarios;
    }

    public ContextoExecucaoFerramenta criar(String correlacao) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof UsuarioPrincipal principal)) {
            throw new OrquestradorException(CodigoErroOrquestrador.NAO_AUTENTICADO,
                    HttpStatus.UNAUTHORIZED, "Usuário autenticado não encontrado");
        }
        PerfilUsuario perfil;
        try {
            perfil = PerfilUsuario.valueOf(principal.perfil());
        } catch (RuntimeException exception) {
            throw new OrquestradorException(CodigoErroOrquestrador.NAO_AUTORIZADO,
                    HttpStatus.FORBIDDEN, "Perfil autenticado não autorizado");
        }
        String correlacaoSegura = correlacao != null && correlacao.matches(CORRELACAO_SEGURA)
                ? correlacao : UUID.randomUUID().toString();
        Long empresaId = usuarios.buscarEmpresaId(principal.id()).orElseThrow(() ->
                new OrquestradorException(CodigoErroOrquestrador.NAO_AUTORIZADO,
                        HttpStatus.FORBIDDEN, "Usuário sem empresa vinculada"));
        return new ContextoExecucaoFerramenta(
                new IdentidadeFerramenta(principal.id(), empresaId, perfil),
                correlacaoSegura,
                clock.instant(),
                clock.getZone(),
                properties.getLimits().getToolCalls());
    }
}
