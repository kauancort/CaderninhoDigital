package com.InovaSkill.CaderninhoDigital.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "materias_primas")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MateriaPrima {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String nome;

    @Column(length = 500)
    private String descricao;

    @Column(nullable = false, length = 30)
    private String unidadeMedida;

    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal estoqueAtual;

    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal estoqueMinimo;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal custoMedio;

    @Column(nullable = false)
    private Boolean ativo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "gestor_id", nullable = false)
    private Usuario gestor;

    @Column(nullable = false)
    private LocalDateTime criadoEm;

    @PrePersist
    public void prePersist() {
        this.criadoEm = LocalDateTime.now();
        if (this.estoqueAtual == null) {
            this.estoqueAtual = BigDecimal.ZERO;
        }
        if (this.estoqueMinimo == null) {
            this.estoqueMinimo = BigDecimal.ZERO;
        }
        if (this.custoMedio == null) {
            this.custoMedio = BigDecimal.ZERO;
        }
        if (this.ativo == null) {
            this.ativo = true;
        }
    }
}
