package com.InovaSkill.CaderninhoDigital.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class CategoriaProdutoRequestDTO {
    @NotBlank(message = "O nome da categoria é obrigatório")
    private String nome;
    private String descricao;
    private Boolean ativo;
    private Long categoriaPaiId;
}
