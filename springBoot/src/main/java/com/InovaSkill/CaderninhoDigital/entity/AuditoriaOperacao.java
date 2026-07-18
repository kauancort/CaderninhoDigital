package com.InovaSkill.CaderninhoDigital.entity;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;
@Entity @Table(name="auditoria_operacoes") @Getter @Builder @NoArgsConstructor @AllArgsConstructor
public class AuditoriaOperacao {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="usuario_id") private Usuario usuario;
 @Column(nullable=false) private LocalDateTime ocorridoEm;
 @Column(nullable=false,length=80) private String entidade;
 private Long registroId;
 @Column(nullable=false,length=40) private String operacao;
 @Column(columnDefinition="TEXT") private String valorAnterior;
 @Column(columnDefinition="TEXT") private String valorNovo;
 private String motivo; private String origem; private String referenciaTipo; private Long referenciaId;
 @PrePersist void pre(){if(ocorridoEm==null)ocorridoEm=LocalDateTime.now();}
}
