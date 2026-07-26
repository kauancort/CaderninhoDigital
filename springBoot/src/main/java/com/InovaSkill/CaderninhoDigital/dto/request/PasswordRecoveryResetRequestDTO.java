package com.InovaSkill.CaderninhoDigital.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PasswordRecoveryResetRequestDTO {
    @NotBlank(message = "O token de recuperação é obrigatório")
    @Size(max = 120, message = "Token de recuperação inválido")
    private String recoveryToken;

    @NotBlank(message = "A nova senha é obrigatória")
    @Size(min = 6, max = 72, message = "A nova senha deve ter entre 6 e 72 caracteres")
    @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).+$",
            message = "A nova senha deve conter ao menos uma letra e um número")
    private String newPassword;

    @NotBlank(message = "A confirmação da senha é obrigatória")
    @Size(min = 6, max = 72, message = "A confirmação deve ter entre 6 e 72 caracteres")
    private String confirmPassword;
}
