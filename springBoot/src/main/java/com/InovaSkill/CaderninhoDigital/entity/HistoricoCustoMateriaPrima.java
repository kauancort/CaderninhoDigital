package com.InovaSkill.CaderninhoDigital.entity;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.*;
@Entity @Table(name="historico_custos_materia_prima") @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class HistoricoCustoMateriaPrima {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="materia_prima_id",nullable=false) private MateriaPrima materiaPrima;
 @Column(nullable=false,precision=12,scale=2) private BigDecimal custo;
 @Column(nullable=false) private LocalDateTime inicioVigencia;
 private LocalDateTime fimVigencia;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="usuario_id") private Usuario usuario;
 @Column(nullable=false) private LocalDateTime alteradoEm;
 private String motivo;
 @Column(nullable=false,length=60) private String origem;
 @PrePersist void pre(){if(alteradoEm==null)alteradoEm=LocalDateTime.now();if(inicioVigencia==null)inicioVigencia=alteradoEm;}
}
