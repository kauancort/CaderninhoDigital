package com.InovaSkill.CaderninhoDigital.ai.gateway;

import java.util.Objects;

public record MensagemModelo(PapelMensagemModelo papel, String conteudo) {
    public MensagemModelo {
        Objects.requireNonNull(papel, "papel");
        if (conteudo == null || conteudo.isBlank()) {
            throw new IllegalArgumentException("O conteúdo da mensagem do modelo é obrigatório");
        }
    }
}
