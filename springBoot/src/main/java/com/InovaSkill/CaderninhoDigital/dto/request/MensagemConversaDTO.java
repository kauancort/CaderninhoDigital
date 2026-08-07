package com.InovaSkill.CaderninhoDigital.dto.request;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class MensagemConversaDTO {
    @NotBlank
    @Pattern(regexp = "usuario|assistente", message = "deve ser usuario ou assistente")
    private String autor;

    @NotBlank
    @Size(max = 20_000)
    private String texto;

    @JsonAnySetter
    public void rejeitarCampoExtra(String campo, Object valor) {
        throw new IllegalArgumentException("Campo não permitido no histórico: " + campo);
    }
}
