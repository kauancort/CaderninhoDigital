package com.InovaSkill.CaderninhoDigital.dto.request;

import com.InovaSkill.CaderninhoDigital.enums.FormaPagamento;
import com.InovaSkill.CaderninhoDigital.enums.StatusPagamento;
import com.InovaSkill.CaderninhoDigital.enums.TipoCartao;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class VendaRequestDTO {
    @NotNull(message = "Selecione um cliente para registrar a venda")
    private Long clienteId;
    @NotNull(message = "A data da venda é obrigatória")
    private LocalDate dataVenda;
    private FormaPagamento formaPagamento;
    private StatusPagamento statusPagamento;
    private String observacao;
    private LocalDate dataVencimento;
    private TipoCartao tipoCartao;
    private Integer parcelas;
    @Valid
    @NotEmpty(message = "Informe ao menos um item da venda")
    private List<ItemVendaRequestDTO> itens;
}
