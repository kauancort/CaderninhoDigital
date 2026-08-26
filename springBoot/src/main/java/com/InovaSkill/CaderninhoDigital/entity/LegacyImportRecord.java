package com.InovaSkill.CaderninhoDigital.entity;

import com.InovaSkill.CaderninhoDigital.enums.LegacyImportRecordStatus;
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
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "registros_importacao_legada")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LegacyImportRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "importacao_id", nullable = false)
    private LegacyImportRun importacao;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "gestor_id", nullable = false)
    private Usuario gestor;

    @Column(nullable = false, length = 180)
    private String arquivo;

    @Column(nullable = false)
    private Integer linha;

    @Column(name = "codigo_legado", length = 120)
    private String codigoLegado;

    @Column(nullable = false, length = 40)
    private String dominio;

    @Column(length = 40)
    private String classificacao;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private LegacyImportRecordStatus status;

    @Column(name = "entidade_tipo", length = 80)
    private String entidadeTipo;

    @Column(name = "entidade_id")
    private Long entidadeId;

    @Column(length = 1000)
    private String mensagem;

    @Column(length = 500)
    private String observacao;

    @Column(name = "criado_em", nullable = false)
    private LocalDateTime criadoEm;

    @PrePersist
    void prePersist() {
        if (criadoEm == null) {
            criadoEm = LocalDateTime.now();
        }
    }
}
