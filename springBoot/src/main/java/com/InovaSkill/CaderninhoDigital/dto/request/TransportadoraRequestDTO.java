package com.InovaSkill.CaderninhoDigital.dto.request;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class TransportadoraRequestDTO {
    private String nome;
    private String cnpj;
    private String telefone;
    private String email;
    private String cep;
    private String endereco;
    private String numero;
    private String complemento;
    private String bairro;
    private String cidade;
    private String estado;
    private String observacao;
}
