package com.InovaSkill.CaderninhoDigital.dto.response;

import java.util.List;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class TransportadoraDetalhesResponseDTO {
    private Long id;
    private String nome;
    private List<ClienteVinculadoTransportadoraResponseDTO> clientesVinculados;
    private List<UsoTransportadoraResponseDTO> historico;
}
