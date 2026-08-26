package com.InovaSkill.CaderninhoDigital.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class TransportadoraRequestDTO {

    @NotBlank(message = "Informe o nome da transportadora")
    @Size(max = 160, message = "O nome deve ter no máximo 160 caracteres")
    private String nome;

    @Size(max = 20, message = "O CNPJ deve ter no máximo 20 caracteres")
    private String cnpj;

    @Size(max = 30, message = "O telefone deve ter no máximo 30 caracteres")
    private String telefone;

    @Size(max = 160, message = "O e-mail deve ter no máximo 160 caracteres")
    private String email;

    @Size(max = 8, message = "O CEP deve ter no máximo 8 caracteres")
    private String cep;

    @Size(max = 255)
    private String endereco;

    @Size(max = 20)
    private String numero;

    @Size(max = 120)
    private String complemento;

    @Size(max = 120)
    private String bairro;

    @Size(max = 120)
    private String cidade;

    @Size(max = 2)
    private String estado;

    @Size(max = 500)
    private String observacao;
}