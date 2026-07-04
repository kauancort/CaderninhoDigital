package com.InovaSkill.CaderninhoDigital.dto.response;

import com.InovaSkill.CaderninhoDigital.enums.FormaPagamento;
import com.InovaSkill.CaderninhoDigital.enums.StatusPagamento;
import com.InovaSkill.CaderninhoDigital.enums.TipoLancamento;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class LancamentoResponseDTO {
    private Long id;
    private TipoLancamento tipo;
    private String titulo;
    private String descricao;
    private BigDecimal valorTotal;
    private BigDecimal quantidade;
    private String unidadeMedida;
    private String nomeProdutoOuInsumo;
    private String clienteOuFornecedor;
    private FormaPagamento formaPagamento;
    private StatusPagamento statusPagamento;
    private LocalDate dataLancamento;
    private LocalDate dataVencimento;
    private Long gestorId;
    private String gestorNome;
    private LocalDateTime criadoEm;
    private LocalDateTime atualizadoEm;
}
