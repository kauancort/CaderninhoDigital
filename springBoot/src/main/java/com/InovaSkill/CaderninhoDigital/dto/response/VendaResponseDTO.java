package com.InovaSkill.CaderninhoDigital.dto.response;

import com.InovaSkill.CaderninhoDigital.dto.ContatoDTO;
import com.InovaSkill.CaderninhoDigital.enums.FormaPagamento;
import com.InovaSkill.CaderninhoDigital.enums.StatusPagamento;
import com.InovaSkill.CaderninhoDigital.enums.TipoCartao;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class VendaResponseDTO {

    private Long id;
    private Long clienteId;
    private String clienteNome;
    private LocalDate dataVenda;
    private FormaPagamento formaPagamento;
    private StatusPagamento statusPagamento;
    private BigDecimal valorTotal;
    private String observacao;
    private LocalDate dataVencimento;
    private TipoCartao tipoCartao;
    private Integer parcelas;
    private Boolean emAtraso;
    private List<ContatoDTO> contatos;
    private LocalDateTime criadoEm;
    private List<ItemVendaResponseDTO> itens;
}