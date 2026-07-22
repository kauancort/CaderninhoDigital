package com.InovaSkill.CaderninhoDigital.dto.request;

import com.InovaSkill.CaderninhoDigital.enums.PerfilUsuario;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CriarUsuarioRequestDTO {
    @NotBlank(message = "O nome é obrigatório")
    @Size(max = 120)
    private String nome;
    @Email(message = "E-mail inválido")
    @NotBlank(message = "O e-mail é obrigatório")
    @Size(max = 160)
    private String email;
    @NotBlank(message = "A função/cargo é obrigatória")
    @Size(max = 80)
    private String cargoFuncao;
    @NotNull(message = "O perfil é obrigatório")
    private PerfilUsuario perfil;
}
