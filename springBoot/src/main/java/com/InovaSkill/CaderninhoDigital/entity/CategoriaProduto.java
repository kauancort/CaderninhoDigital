package com.InovaSkill.CaderninhoDigital.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(name = "categorias_produto")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CategoriaProduto {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 120, unique = true)
    private String nome;
    @Column(length = 500)
    private String descricao;
    @Column(nullable = false)
    private Boolean ativo;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "categoria_pai_id")
    private CategoriaProduto categoriaPai;
    @Column(nullable = false)
    private LocalDateTime criadoEm;
    @PrePersist void prePersist() {
        if (ativo == null) ativo = true;
        if (criadoEm == null) criadoEm = LocalDateTime.now();
    }
}
