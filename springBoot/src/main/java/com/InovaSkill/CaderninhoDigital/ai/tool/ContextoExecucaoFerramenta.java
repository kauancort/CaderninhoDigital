package com.InovaSkill.CaderninhoDigital.ai.tool;

import java.time.Instant;
import java.time.ZoneId;

public record ContextoExecucaoFerramenta(
        IdentidadeFerramenta identidade,
        String correlacao,
        Instant solicitadoEm,
        ZoneId timezone,
        int chamadasRestantes
) {}
