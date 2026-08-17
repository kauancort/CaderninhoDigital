package com.InovaSkill.CaderninhoDigital.entity;

import com.InovaSkill.CaderninhoDigital.enums.ModalidadeVenda;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "itens_venda")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ItemVenda {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "venda_id", nullable = false)
    private Venda venda;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "produto_id")
    private Produto produto;

    @Column(name = "nome_avulso", length = 120)
    private String nomeAvulso;

    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal quantidade;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal valorUnitario;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal valorTotal;

    @Column(precision = 12, scale = 2)
    private BigDecimal custoConsiderado;

    /** Snapshot da forma comercial. quantidade continua expressa na unidade de estoque. */
    @Enumerated(EnumType.STRING)
    @Column(name = "modalidade_venda", length = 20)
    private ModalidadeVenda modalidadeVenda;

    @Column(name = "quantidade_modalidade", precision = 12, scale = 3)
    private BigDecimal quantidadeModalidade;

    @Column(name = "unidades_por_modalidade", precision = 12, scale = 3)
    private BigDecimal unidadesPorModalidade;
}
