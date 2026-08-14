package com.InovaSkill.CaderninhoDigital.ai.search;

/** Resultado auditável de uma fonte descoberta pela pesquisa externa. */
public record ResultadoFontePesquisa(
        String fonteId,
        String titulo,
        String url,
        String dominio,
        Status status,
        String motivo
) {
    public enum Status {
        VALIDADA,
        REJEITADA,
        NAO_CONCLUIDA
    }
}
