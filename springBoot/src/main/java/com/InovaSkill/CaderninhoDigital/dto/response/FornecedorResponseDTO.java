package com.InovaSkill.CaderninhoDigital.dto.response;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class FornecedorResponseDTO {
    private Long id;
    private String nome;
    private String email;
    private String telefone;
    private String documento;
    private String endereco;
    private Boolean ativo;
    private Long gestorId;
    private String gestorNome;
}
