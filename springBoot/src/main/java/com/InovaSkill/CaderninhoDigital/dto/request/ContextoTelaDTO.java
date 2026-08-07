package com.InovaSkill.CaderninhoDigital.dto.request;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ContextoTelaDTO {
    @Size(max = 80)
    private String rota;

    @Size(max = 40)
    private String recurso;

    @JsonAnySetter
    public void rejeitarCampoExtra(String campo, Object valor) {
        throw new IllegalArgumentException("Campo não permitido em contextoTela: " + campo);
    }
}
