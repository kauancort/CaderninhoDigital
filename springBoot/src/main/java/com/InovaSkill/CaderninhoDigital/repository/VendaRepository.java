package com.InovaSkill.CaderninhoDigital.repository;

import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.entity.Venda;
import com.InovaSkill.CaderninhoDigital.repository.projection.ResumoCobrancasProjection;
import com.InovaSkill.CaderninhoDigital.repository.projection.ResumoHistoricoVendasProjection;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface VendaRepository extends JpaRepository<Venda, Long>, JpaSpecificationExecutor<Venda> {
    @Override
    @EntityGraph(attributePaths = {"cliente"})
    Page<Venda> findAll(Specification<Venda> specification, Pageable pageable);
    List<Venda> findByGestorOrderByDataVendaDesc(Usuario gestor);

    List<Venda> findByGestorAndDataVendaBetweenOrderByDataVendaDesc(Usuario gestor, LocalDate inicio, LocalDate fim);
    List<Venda> findAllByOrderByDataVendaDesc();
    List<Venda> findByDataVendaBetweenOrderByDataVendaDesc(LocalDate inicio, LocalDate fim);

    @EntityGraph(attributePaths = {"cliente", "itens", "itens.produto"})
    List<Venda> findByAguardandoEstoqueTrueOrderByDataVendaAsc();

    @EntityGraph(attributePaths = {"cliente", "gestor", "itens", "itens.produto"})
    @Query("SELECT DISTINCT v FROM Venda v WHERE v.id IN :ids")
    List<Venda> buscarDetalhesPorIds(@Param("ids") List<Long> ids);

    @EntityGraph(attributePaths = {"cliente", "gestor", "itens", "itens.produto"})
    @Query("SELECT DISTINCT v FROM Venda v WHERE v.id = :id")
    Optional<Venda> buscarDetalhesPorId(@Param("id") Long id);

    @Query("""
            SELECT i.venda.id, COALESCE(SUM(i.quantidade), 0)
            FROM ItemVenda i
            WHERE i.venda.id IN :ids
            GROUP BY i.venda.id
            """)
    List<Object[]> contarItensPorVendas(@Param("ids") List<Long> ids);

    @Query("""
            SELECT
                COALESCE(SUM(v.valorTotal), 0) AS faturamento,
                COUNT(v) AS quantidadeVendas,
                COALESCE(AVG(v.valorTotal), 0) AS ticketMedio
            FROM Venda v
            WHERE (:inicio IS NULL OR v.dataVenda >= :inicio)
              AND (:fim IS NULL OR v.dataVenda <= :fim)
              AND (:clienteId IS NULL OR v.cliente.id = :clienteId)
              AND (:status IS NULL OR v.statusPagamento = :status)
              AND (:forma IS NULL OR v.formaPagamento = :forma)
              AND (:parcelada IS NULL OR
                    (:parcelada = TRUE AND v.parcelas > 1) OR
                    (:parcelada = FALSE AND (v.parcelas IS NULL OR v.parcelas <= 1)))
              AND (:produtoId IS NULL OR EXISTS (
                    SELECT i.id FROM ItemVenda i
                    WHERE i.venda = v AND i.produto.id = :produtoId))
              AND (:busca = '' OR
                    LOWER(v.cliente.nome) LIKE LOWER(CONCAT('%', :busca, '%')) OR
                    LOWER(COALESCE(v.observacao, '')) LIKE LOWER(CONCAT('%', :busca, '%')) OR
                    EXISTS (SELECT item.id FROM ItemVenda item
                            WHERE item.venda = v
                              AND LOWER(item.produto.nome) LIKE LOWER(CONCAT('%', :busca, '%'))))
            """)
    ResumoHistoricoVendasProjection resumirHistoricoVendas(
            @Param("busca") String busca,
            @Param("clienteId") Long clienteId,
            @Param("produtoId") Long produtoId,
            @Param("inicio") LocalDate inicio,
            @Param("fim") LocalDate fim,
            @Param("status") com.InovaSkill.CaderninhoDigital.enums.StatusPagamento status,
            @Param("forma") com.InovaSkill.CaderninhoDigital.enums.FormaPagamento forma,
            @Param("parcelada") Boolean parcelada
    );

    @Query("""
            SELECT COALESCE(SUM(i.quantidade), 0)
            FROM ItemVenda i
            JOIN i.venda v
            WHERE (:inicio IS NULL OR v.dataVenda >= :inicio)
              AND (:fim IS NULL OR v.dataVenda <= :fim)
              AND (:clienteId IS NULL OR v.cliente.id = :clienteId)
              AND (:status IS NULL OR v.statusPagamento = :status)
              AND (:forma IS NULL OR v.formaPagamento = :forma)
              AND (:parcelada IS NULL OR
                    (:parcelada = TRUE AND v.parcelas > 1) OR
                    (:parcelada = FALSE AND (v.parcelas IS NULL OR v.parcelas <= 1)))
              AND (:produtoId IS NULL OR EXISTS (
                    SELECT filtro.id FROM ItemVenda filtro
                    WHERE filtro.venda = v AND filtro.produto.id = :produtoId))
              AND (:busca = '' OR
                    LOWER(v.cliente.nome) LIKE LOWER(CONCAT('%', :busca, '%')) OR
                    LOWER(COALESCE(v.observacao, '')) LIKE LOWER(CONCAT('%', :busca, '%')) OR
                    EXISTS (SELECT item.id FROM ItemVenda item
                            WHERE item.venda = v
                              AND LOWER(item.produto.nome) LIKE LOWER(CONCAT('%', :busca, '%'))))
            """)
    BigDecimal totalItensHistoricoVendas(
            @Param("busca") String busca,
            @Param("clienteId") Long clienteId,
            @Param("produtoId") Long produtoId,
            @Param("inicio") LocalDate inicio,
            @Param("fim") LocalDate fim,
            @Param("status") com.InovaSkill.CaderninhoDigital.enums.StatusPagamento status,
            @Param("forma") com.InovaSkill.CaderninhoDigital.enums.FormaPagamento forma,
            @Param("parcelada") Boolean parcelada
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"cliente", "gestor", "itens", "itens.produto"})
    @Query("SELECT v FROM Venda v WHERE v.id = :id")
    Optional<Venda> buscarParaConfirmacao(@Param("id") Long id);

    @Query("""
            SELECT
                COALESCE(SUM(v.valorTotal), 0) AS totalReceber,
                COALESCE(SUM(CASE WHEN v.dataVencimento < :hoje THEN v.valorTotal ELSE 0 END), 0) AS totalVencido,
                COALESCE(SUM(CASE WHEN v.dataVencimento >= :hoje THEN v.valorTotal ELSE 0 END), 0) AS totalEmDia,
                COALESCE(SUM(CASE WHEN v.dataVencimento < :hoje THEN 1 ELSE 0 END), 0) AS quantidadeAtrasadas,
                COUNT(v) AS quantidadeCobrancas
            FROM Venda v
            WHERE v.statusPagamento = com.InovaSkill.CaderninhoDigital.enums.StatusPagamento.PENDENTE
              AND v.aguardandoEstoque = false
              AND (:clienteId IS NULL OR v.cliente.id = :clienteId)
              AND (:inicio IS NULL OR v.dataVencimento >= :inicio)
              AND (:fim IS NULL OR v.dataVencimento <= :fim)
              AND (:forma IS NULL OR v.formaPagamento = :forma)
              AND (:parcelada IS NULL OR
                    (:parcelada = TRUE AND v.parcelas > 1) OR
                    (:parcelada = FALSE AND (v.parcelas IS NULL OR v.parcelas <= 1)))
              AND (:produtoId IS NULL OR EXISTS (
                    SELECT i.id FROM ItemVenda i
                    WHERE i.venda = v AND i.produto.id = :produtoId))
              AND (:busca = '' OR
                    LOWER(v.cliente.nome) LIKE LOWER(CONCAT('%', :busca, '%')) OR
                    LOWER(COALESCE(v.cliente.email, '')) LIKE LOWER(CONCAT('%', :busca, '%')) OR
                    LOWER(COALESCE(v.cliente.telefone, '')) LIKE LOWER(CONCAT('%', :busca, '%')) OR
                    LOWER(COALESCE(v.observacao, '')) LIKE LOWER(CONCAT('%', :busca, '%')) OR
                    EXISTS (SELECT item.id FROM ItemVenda item
                            WHERE item.venda = v
                              AND LOWER(item.produto.nome) LIKE LOWER(CONCAT('%', :busca, '%'))))
              AND (:situacao = '' OR
                    (:situacao = 'EM_DIA'
                        AND v.dataVencimento >= :hoje) OR
                    (:situacao = 'ATRASO_RECENTE'
                        AND v.dataVencimento BETWEEN :limiteRecente AND :ontem) OR
                    (:situacao = 'ATRASO_MEDIO'
                        AND v.dataVencimento BETWEEN :limiteMedio AND :antesRecente) OR
                    (:situacao = 'MUITO_ATRASADO'
                        AND v.dataVencimento < :limiteMedio))
            """)
    ResumoCobrancasProjection resumirCobrancas(
            @Param("hoje") LocalDate hoje,
            @Param("ontem") LocalDate ontem,
            @Param("limiteRecente") LocalDate limiteRecente,
            @Param("antesRecente") LocalDate antesRecente,
            @Param("limiteMedio") LocalDate limiteMedio,
            @Param("situacao") String situacao,
            @Param("busca") String busca,
            @Param("clienteId") Long clienteId,
            @Param("produtoId") Long produtoId,
            @Param("inicio") LocalDate inicio,
            @Param("fim") LocalDate fim,
            @Param("forma") com.InovaSkill.CaderninhoDigital.enums.FormaPagamento forma,
            @Param("parcelada") Boolean parcelada
    );
}