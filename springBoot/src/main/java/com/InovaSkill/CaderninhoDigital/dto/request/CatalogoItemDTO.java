package com.InovaSkill.CaderninhoDigital.dto.request;

import lombok.Data;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Data
public class CatalogoItemDTO {
    @NotNull
    private Long id;
    @NotBlank
    @Size(max = 200)
    private String nome;

    @JsonAnySetter
    public void rejeitarCampoExtra(String campo, Object valor) {
        throw new IllegalArgumentException("Campo não permitido no catálogo");
    }
}
