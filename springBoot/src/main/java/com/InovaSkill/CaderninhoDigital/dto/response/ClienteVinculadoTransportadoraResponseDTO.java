package com.InovaSkill.CaderninhoDigital.dto.response;

import com.InovaSkill.CaderninhoDigital.entity.TipoCliente;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ClienteVinculadoTransportadoraResponseDTO {
    private Long id;
    private String nome;
    private TipoCliente tipo;
}
