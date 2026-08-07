package com.InovaSkill.CaderninhoDigital.dto.request;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.Data;

@Data
public class ConversaRequestDTO {
    @Size(max = 20_000)
    private String mensagem;

    private AcaoRapidaAssistente acaoRapida;

    @Valid
    @Size(max = 100)
    private List<MensagemConversaDTO> historico = List.of();

    @Valid
    private ContextoTelaDTO contextoTela;

    @Size(max = 20)
    private String versaoContrato;

    @Size(max = 100)
    private String correlacao;

    @JsonAnySetter
    public void rejeitarCampoExtra(String campo, Object valor) {
        throw new IllegalArgumentException("Campo não permitido na solicitação: " + campo);
    }
}
