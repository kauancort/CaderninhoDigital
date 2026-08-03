package com.InovaSkill.CaderninhoDigital.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
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
    @Size(max = 255, message = "O endereço deve ter no máximo 255 caracteres")
    private String endereco;
    @Size(max = 20, message = "O número deve ter no máximo 20 caracteres")
    private String numero;
    @Size(max = 120, message = "O complemento deve ter no máximo 120 caracteres")
    private String complemento;
    @Pattern(regexp = "^$|\\d{8}$", message = "O CEP deve conter 8 dígitos")
    private String cep;
    @Size(max = 120, message = "O bairro deve ter no máximo 120 caracteres")
    private String bairro;
    @Size(max = 40, message = "A inscrição estadual deve ter no máximo 40 caracteres")
    private String inscricaoEstadual;
    private Boolean ativo;
}
