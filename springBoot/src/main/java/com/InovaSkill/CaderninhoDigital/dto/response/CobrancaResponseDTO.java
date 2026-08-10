package com.InovaSkill.CaderninhoDigital.dto.response;

import com.InovaSkill.CaderninhoDigital.enums.SituacaoCobranca;
import com.InovaSkill.CaderninhoDigital.enums.FormaPagamento;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CobrancaResponseDTO {

    private Long id;
    private Long clienteId;
    private String clienteNome;
    private String clienteTelefone;
    private String clienteEmail;
    private String descricao;
    private LocalDate dataVenda;
    private LocalDate dataVencimento;
    private BigDecimal valor;
    private FormaPagamento formaPagamento;
    private Integer parcelas;
    private long diasAtraso;
    private SituacaoCobranca situacao;
    private String gestorNome;
    private List<ItemVendaResponseDTO> itens;
}