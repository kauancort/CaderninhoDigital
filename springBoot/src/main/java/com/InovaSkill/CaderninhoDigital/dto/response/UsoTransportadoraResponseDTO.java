package com.InovaSkill.CaderninhoDigital.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class UsoTransportadoraResponseDTO {
    private Long vendaId;
    private Long clienteId;
    private String clienteNome;
    private LocalDate dataVenda;
    private BigDecimal custoEnvio;
    private LocalDate dataEnvio;
    private LocalDate previsaoEntrega;
    private String codigoRastreamento;
    private String situacaoDespacho;
}
