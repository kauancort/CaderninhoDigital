package com.InovaSkill.CaderninhoDigital.dto.request;

import java.util.List;
import lombok.Data;

@Data
public class InterpretarVozRequestDTO {
    private String audioBase64;
    private String mime;
    private String textoTranscrito;
    private List<CatalogoItemDTO> produtos;
    private List<CatalogoItemDTO> materiasPrimas;
    private String conversaPrevia;
}