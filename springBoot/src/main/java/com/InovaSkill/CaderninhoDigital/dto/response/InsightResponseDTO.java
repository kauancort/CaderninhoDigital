package com.InovaSkill.CaderninhoDigital.dto.response;

import com.InovaSkill.CaderninhoDigital.enums.TipoInsight;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class InsightResponseDTO {
    private Long id;
    private TipoInsight tipo;
    private String titulo;
    private String mensagem;
    private LocalDateTime criadoEm;
}
