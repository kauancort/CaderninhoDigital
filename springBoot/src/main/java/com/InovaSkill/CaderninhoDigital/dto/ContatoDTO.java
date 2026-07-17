package com.InovaSkill.CaderninhoDigital.dto;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContatoDTO {
    private LocalDateTime data;
    private String tipo;
    private String resposta;
}