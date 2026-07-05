package com.InovaSkill.CaderninhoDigital.dto.request;

import com.InovaSkill.CaderninhoDigital.enums.FormaPagamento;
import com.InovaSkill.CaderninhoDigital.enums.StatusPagamento;
import com.InovaSkill.CaderninhoDigital.enums.TipoLancamento;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LancamentoRequestDTO {

    @NotNull(message = "O tipo do lançamento é obrigatório")
    private TipoLancamento tipo;

    @NotBlank(message = "O título é obrigatório")
    private String titulo;

    private String descricao;

    @NotNull(message = "O valor total é obrigatório")
    @DecimalMin(value = "0.0", inclusive = false, message = "O valor total deve ser maior que zero")
    private BigDecimal valorTotal;

    private BigDecimal quantidade;

    private String unidadeMedida;

    private String nomeProdutoOuInsumo;

    private String clienteOuFornecedor;

    private FormaPagamento formaPagamento;

    private StatusPagamento statusPagamento;

    @NotNull(message = "A data do lançamento é obrigatória")
    private LocalDate dataLancamento;

    private LocalDate dataVencimento;
}
