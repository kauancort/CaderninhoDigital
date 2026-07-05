package com.InovaSkill.CaderninhoDigital.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ProducaoResponseDTO {
    private Long id;
    private Long produtoId;
    private String produtoNome;
    private LocalDate dataProducao;
    private BigDecimal quantidadeProduzida;
    private BigDecimal custoEstimado;
    private String observacao;
    private LocalDateTime criadoEm;
    private List<InsumoProducaoResponseDTO> insumos;
}
