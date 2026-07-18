package com.InovaSkill.CaderninhoDigital.entity;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.*;
@Entity @Table(name="historico_precos_produto") @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class HistoricoPrecoProduto {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="produto_id",nullable=false) private Produto produto;
 @Column(nullable=false,precision=12,scale=2) private BigDecimal preco;
 @Column(nullable=false) private LocalDateTime inicioVigencia;
 private LocalDateTime fimVigencia;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="usuario_id") private Usuario usuario;
 @Column(nullable=false) private LocalDateTime alteradoEm;
 private String motivo;
 @Column(nullable=false,length=60) private String origem;
 @PrePersist void pre(){if(alteradoEm==null)alteradoEm=LocalDateTime.now();if(inicioVigencia==null)inicioVigencia=alteradoEm;}
}
