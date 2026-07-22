package com.InovaSkill.CaderninhoDigital.dto.response;

import java.math.BigDecimal;
import java.util.List;
import lombok.Data;

@Data
public class VozResultadoResponseDTO {
    private String transcricao;
    private String tipo;
    private List<String> faltando;
    private String perguntaProximo;
    private VendaDTO venda;
    private List<CompraDTO> compras;
    private ProducaoDTO producao;
    private GastoDTO gasto;

    @Data
    public static class VendaDTO {
        private List<ItemVendaDTO> itens;
        private String comprador;
        private String forma_pagamento;
    }

    @Data
    public static class ItemVendaDTO {
        private Long produto_final_id;
        private String produto_nome;
        private Double quantidade;
        private String tipo; // "pote" | "caixa"
        private BigDecimal preco_unitario;
    }

    @Data
    public static class CompraDTO {
        private Long materia_prima_id;
        private String produto_nome;
        private Double quantidade;
        private String unidade;
        private BigDecimal valor_total;
        private String categoria; // "materia-prima" | "embalagens"
        private String fornecedor;
    }

    @Data
    public static class ProducaoDTO {
        private Long produto_final_id;
        private String produto_nome;
        private Double potes;
        private Integer unidade; // 22 | 44
        private String observacoes;
    }

    @Data
    public static class GastoDTO {
        private String descricao;
        private String categoria; // "materia-prima" | "embalagens" | "energia" | ...
        private BigDecimal valor;
    }
}
