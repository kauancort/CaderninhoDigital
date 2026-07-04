package com.InovaSkill.CaderninhoDigital.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ClienteRequestDTO {
    @NotBlank(message = "O nome é obrigatório")
    private String nome;
    private String email;
    private String telefone;
    private String documento;
    private String endereco;
    private Boolean ativo;
}
