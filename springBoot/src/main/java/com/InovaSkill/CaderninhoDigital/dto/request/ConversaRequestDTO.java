package com.InovaSkill.CaderninhoDigital.dto.request;

import java.util.List;
import lombok.Data;

@Data
public class ConversaRequestDTO {
    private String mensagem;
    private List<MensagemConversaDTO> historico;
}
