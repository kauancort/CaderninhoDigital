package com.InovaSkill.CaderninhoDigital.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PasswordRecoveryRequestDTO {
    @NotBlank(message = "O e-mail é obrigatório")
    @Email(message = "E-mail inválido")
    @Size(max = 160, message = "O e-mail deve ter no máximo 160 caracteres")
    private String email;
}
