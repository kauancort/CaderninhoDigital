package com.InovaSkill.CaderninhoDigital.dto.response;

import java.util.List;
import java.util.Map;

public record LegacyHistoricalTreatmentResponse(
        String arquivoPrincipal,
        int arquivosAnalisados,
        long registrosAnalisados,
        Map<String, Long> registrosPorDominio,
        long registrosProntos,
        long registrosBloqueados,
        List<LegacyHistoricalIssueResponse> pendencias
) {
}
