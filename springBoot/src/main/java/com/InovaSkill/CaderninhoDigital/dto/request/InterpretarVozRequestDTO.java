package com.InovaSkill.CaderninhoDigital.dto.request;

import jakarta.validation.constraints.NotBlank;
import java.util.List;
import lombok.Data;

@Data
public class InterpretarVozRequestDTO {
    @NotBlank(message = "Não foi possível transcrever o áudio")
    private String texto;
    private List<CatalogoItemDTO> produtos;
    private List<CatalogoItemDTO> materiasPrimas;
    private String conversaPrevia;
}
