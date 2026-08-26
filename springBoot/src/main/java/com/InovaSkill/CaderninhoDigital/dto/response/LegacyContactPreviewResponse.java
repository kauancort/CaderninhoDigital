package com.InovaSkill.CaderninhoDigital.dto.response;

import java.util.List;

public record LegacyContactPreviewResponse(
        String arquivoPrincipal,
        int arquivosAnalisados,
        long registrosAnalisados,
        long clientesIdentificados,
        long fornecedoresIdentificados,
        long pendentes,
        List<LegacyHistoricalIssueResponse> pendencias
) {
}
