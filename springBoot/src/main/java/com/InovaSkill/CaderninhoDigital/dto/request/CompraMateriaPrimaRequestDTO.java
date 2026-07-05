package com.InovaSkill.CaderninhoDigital.dto.request;

import com.InovaSkill.CaderninhoDigital.enums.FormaPagamento;
import com.InovaSkill.CaderninhoDigital.enums.StatusPagamento;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CompraMateriaPrimaRequestDTO {
    private Long fornecedorId;
    @NotNull(message = "A data da compra é obrigatória")
    private LocalDate dataCompra;
    private FormaPagamento formaPagamento;
    private StatusPagamento statusPagamento;
    private String observacao;
    @Valid
    @NotEmpty(message = "Informe ao menos um item da compra")
    private List<ItemCompraMateriaPrimaRequestDTO> itens;
}
