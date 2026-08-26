package com.InovaSkill.CaderninhoDigital.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/*
 * ADICIONADO (Card 3): a transportadora deixa de ser digitada a cada
 * venda e passa a ser cadastrada uma vez, vinculada ao cliente.
 * Relação 1-para-1 opcional: um cliente pode ter no máximo uma
 * transportadora cadastrada (se precisar de mais de uma no futuro,
 * troca-se para @OneToMany sem quebrar o restante do fluxo).
 */
@Entity
@Table(name = "transportadoras")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Transportadora {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name = "cliente_id", nullable = false, unique = true)
    private Cliente cliente;

    @Column(nullable = false, length = 160)
    private String nome;

    @Column(length = 20)
    private String cnpj;

    @Column(length = 30)
    private String telefone;

    @Column(length = 160)
    private String email;

    @Column(length = 8)
    private String cep;

    @Column(length = 255)
    private String endereco;

    @Column(length = 20)
    private String numero;

    @Column(length = 120)
    private String complemento;

    @Column(length = 120)
    private String bairro;

    @Column(length = 120)
    private String cidade;

    @Column(length = 2)
    private String estado;

    @Column(length = 500)
    private String observacao;

    @Column(nullable = false)
    private LocalDateTime criadoEm;

    @PrePersist
    public void prePersist() {
        this.criadoEm = LocalDateTime.now();
    }
}