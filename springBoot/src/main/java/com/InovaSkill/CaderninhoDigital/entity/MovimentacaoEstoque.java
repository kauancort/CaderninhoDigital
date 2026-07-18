package com.InovaSkill.CaderninhoDigital.entity;

import com.InovaSkill.CaderninhoDigital.enums.OrigemMovimentacaoEstoque;
import com.InovaSkill.CaderninhoDigital.enums.TipoItemEstoque;
import com.InovaSkill.CaderninhoDigital.enums.TipoMovimentacaoEstoque;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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

@Entity
@Table(name = "movimentacoes_estoque")
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MovimentacaoEstoque {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TipoItemEstoque tipoItem;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "produto_id")
    private Produto produto;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "materia_prima_id")
    private MateriaPrima materiaPrima;

    @Column(nullable = false, length = 120)
    private String itemNome;

    @Column(nullable = false, length = 30)
    private String unidadeMedida;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TipoMovimentacaoEstoque tipoMovimentacao;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private OrigemMovimentacaoEstoque origem;

    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal quantidade;

    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal saldoAnterior;

    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal saldoPosterior;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(length = 500)
    private String observacao;

    @Column(nullable = false)
    private LocalDateTime ocorridoEm;

    @PrePersist
    void prePersist() {
        if (ocorridoEm == null) {
            ocorridoEm = LocalDateTime.now();
        }
    }
}
