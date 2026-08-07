package com.InovaSkill.CaderninhoDigital.ai.gateway;

import java.util.List;

public record SolicitacaoModelo(List<MensagemModelo> mensagens) {
    public SolicitacaoModelo {
        if (mensagens == null || mensagens.isEmpty()) {
            throw new IllegalArgumentException("Ao menos uma mensagem é obrigatória");
        }
        mensagens = List.copyOf(mensagens);
    }
}
