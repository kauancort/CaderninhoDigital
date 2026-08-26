package com.InovaSkill.CaderninhoDigital.dto.response;

import java.util.List;
import java.util.Map;

public record LegacyDataAuditResponse(
        String arquivoPrincipal,
        int arquivosAnalisados,
        long registrosAnalisados,
        Map<String, Long> classificacoes,
        long registrosComAlertas,
        long quantidadesExorbitantes,
        List<LegacyAuditItemResponse> itensParaRevisao,
        List<LegacyQuantityIssueResponse> alertasQuantidade
) {
}
