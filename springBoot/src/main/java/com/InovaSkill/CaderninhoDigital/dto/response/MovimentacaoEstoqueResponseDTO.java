package com.InovaSkill.CaderninhoDigital.dto.response;

import com.InovaSkill.CaderninhoDigital.enums.OrigemMovimentacaoEstoque;
import com.InovaSkill.CaderninhoDigital.enums.TipoItemEstoque;
import com.InovaSkill.CaderninhoDigital.enums.TipoMovimentacaoEstoque;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class MovimentacaoEstoqueResponseDTO {
    private Long id;
    private TipoItemEstoque tipoItem;
    private Long itemId;
    private String itemNome;
    private String unidadeMedida;
    private TipoMovimentacaoEstoque tipoMovimentacao;
    private OrigemMovimentacaoEstoque origem;
    private BigDecimal quantidade;
    private BigDecimal saldoAnterior;
    private BigDecimal saldoPosterior;
    private Long usuarioId;
    private String usuarioNome;
    private String observacao;
    private LocalDateTime ocorridoEm;
}
