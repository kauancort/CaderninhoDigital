package com.InovaSkill.CaderninhoDigital.dto.response;

import java.math.BigDecimal;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class InsumoProducaoResponseDTO {
    private Long id;
    private Long materiaPrimaId;
    private String materiaPrimaNome;
    private BigDecimal quantidadeUtilizada;
    private BigDecimal custoUnitario;
    private BigDecimal custoTotal;
}
