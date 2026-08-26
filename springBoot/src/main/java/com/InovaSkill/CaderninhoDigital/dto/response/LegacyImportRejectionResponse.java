package com.InovaSkill.CaderninhoDigital.dto.response;

public record LegacyImportRejectionResponse(
        String arquivo,
        int linha,
        String codigoLegado,
        String nome,
        String tipo,
        String mensagem,
        boolean bloqueante
) {
}
