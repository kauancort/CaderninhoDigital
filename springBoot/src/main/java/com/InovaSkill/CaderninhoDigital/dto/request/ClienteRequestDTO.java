package com.InovaSkill.CaderninhoDigital.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import com.InovaSkill.CaderninhoDigital.entity.TipoCliente;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ClienteRequestDTO {
    @NotBlank(message = "O nome é obrigatório")
    private String nome;
    @Email(message = "Informe um e-mail válido")
    @Size(max = 160, message = "O e-mail deve ter no máximo 160 caracteres")
    private String email;
    @NotBlank(message = "O telefone é obrigatório")
    @Pattern(regexp = "^(?=(?:\\D*\\d){10,11}\\D*$)[0-9() +.\\-]+$", message = "Informe um telefone válido")
    private String telefone;
    @NotBlank(message = "Informe o CPF ou CNPJ")
    private String documento;
    @NotBlank(message = "Informe a rua ou o endereço")
    @Size(max = 255, message = "O endereço deve ter no máximo 255 caracteres")
    private String endereco;
    @NotBlank(message = "Informe o número")
    @Size(max = 20, message = "O número deve ter no máximo 20 caracteres")
    private String numero;
    @Size(max = 120, message = "O complemento deve ter no máximo 120 caracteres")
    private String complemento;
    @Pattern(regexp = "^$|\\d{8}$", message = "O CEP deve conter 8 dígitos")
    private String cep;
    @NotBlank(message = "Informe o bairro")
    @Size(max = 120, message = "O bairro deve ter no máximo 120 caracteres")
    private String bairro;
    @NotBlank(message = "Informe a cidade")
    @Size(max = 120, message = "A cidade deve ter no máximo 120 caracteres")
    private String cidade;
    @NotBlank(message = "Selecione o estado")
    @Pattern(regexp = "^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$", message = "Selecione um estado válido")
    private String estado;
    @Size(max = 40, message = "A inscrição estadual deve ter no máximo 40 caracteres")
    private String inscricaoEstadual;
    private Boolean ativo;
    private TipoCliente tipo;
}
