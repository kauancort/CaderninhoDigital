package com.InovaSkill.CaderninhoDigital.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ContatoRequestDTO {
    @NotBlank(message = "Informe o tipo de contato")
    private String tipo;
    private String resposta;
}