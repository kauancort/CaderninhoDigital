package com.InovaSkill.CaderninhoDigital.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AtualizarPerfilRequestDTO {

    @NotBlank(message = "O nome é obrigatório")
    @Size(max = 120, message = "O nome deve ter no máximo 120 caracteres")
    private String nome;

    @Size(max = 72, message = "A senha atual deve ter no máximo 72 caracteres")
    private String senhaAtual;

    @Size(min = 6, max = 72, message = "A nova senha deve ter entre 6 e 72 caracteres")
    private String novaSenha;
}
