package com.InovaSkill.CaderninhoDigital.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ClienteRequestDTO {
    @NotBlank(message = "O nome é obrigatório")
    private String nome;
    @NotBlank(message = "O e-mail é obrigatório")
    @Email(message = "Informe um e-mail válido")
    private String email;
    @NotBlank(message = "O telefone é obrigatório")
    private String telefone;
    private String documento;
    private String endereco;
    private Boolean ativo;
}
