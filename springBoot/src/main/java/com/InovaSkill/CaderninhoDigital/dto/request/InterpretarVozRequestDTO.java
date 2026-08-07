package com.InovaSkill.CaderninhoDigital.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import java.util.List;
import lombok.Data;

@Data
public class InterpretarVozRequestDTO {
    @NotBlank(message = "Não foi possível transcrever o áudio")
    @Size(max = 4_000)
    private String texto;
    @Valid
    @Size(max = 500)
    private List<CatalogoItemDTO> produtos;
    @Valid
    @Size(max = 500)
    private List<CatalogoItemDTO> materiasPrimas;
    @Size(max = 4_000)
    private String conversaPrevia;

    @JsonAnySetter
    public void rejeitarCampoExtra(String campo, Object valor) {
        throw new IllegalArgumentException("Campo não permitido na solicitação de voz");
    }
}
