package com.InovaSkill.CaderninhoDigital.dto.request;

import com.InovaSkill.CaderninhoDigital.enums.PerfilUsuario;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CadastroUsuarioRequestDTO {

    @NotBlank(message = "O nome é obrigatório")
    private String nome;

    @Email(message = "E-mail inválido")
    @NotBlank(message = "O e-mail é obrigatório")
    private String email;

    @Pattern(regexp = "\\d{3}", message = "A senha deve conter exatamente 3 dígitos nesta versão")
    private String senha;

    @NotBlank(message = "A função/cargo é obrigatória")
    private String cargoFuncao;

    @NotNull(message = "O perfil é obrigatório")
    private PerfilUsuario perfil;
}
