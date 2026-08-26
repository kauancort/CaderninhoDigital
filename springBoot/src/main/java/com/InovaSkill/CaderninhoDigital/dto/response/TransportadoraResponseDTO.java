package com.InovaSkill.CaderninhoDigital.dto.response;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class TransportadoraResponseDTO {
    private Long id;
    private Long clienteId;
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