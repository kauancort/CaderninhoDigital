package com.InovaSkill.CaderninhoDigital.dto.request;

import lombok.Data;

@Data
public class MensagemConversaDTO {
    private String autor; // "usuario" | "assistente"
    private String texto;
}
