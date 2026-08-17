package com.InovaSkill.CaderninhoDigital.repository;

import com.InovaSkill.CaderninhoDigital.entity.CompraMateriaPrima;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import java.time.LocalDate;
import java.util.List;
import com.InovaSkill.CaderninhoDigital.repository.projection.AnaliseCompraInsumoProjection;
import com.InovaSkill.CaderninhoDigital.repository.projection.AnaliseCompraInsumoAgrupadaProjection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CompraMateriaPrimaRepository extends JpaRepository<CompraMateriaPrima, Long> {
    @Query("""
            SELECT COALESCE(SUM(i.quantidade), 0) AS quantidadeTotal,
                   COALESCE(SUM(i.valorTotal), 0) AS valorTotal,
                   MIN(i.valorUnitario) AS menorPreco,
                   MAX(i.valorUnitario) AS maiorPreco,
                   COUNT(DISTINCT i.compra.id) AS quantidadeCompras,
                   MIN(i.compra.dataCompra) AS primeiraCompra,
                   MAX(i.compra.dataCompra) AS ultimaCompra
            FROM ItemCompraMateriaPrima i
            WHERE i.materiaPrima.id = :materiaPrimaId
              AND i.compra.gestor.empresa.id = :empresaId
              AND i.compra.dataCompra >= :inicio AND i.compra.dataCompra <= :fim
            """)
    AnaliseCompraInsumoProjection analisarInsumo(@Param("materiaPrimaId") Long materiaPrimaId,
            @Param("empresaId") Long empresaId, @Param("inicio") LocalDate inicio, @Param("fim") LocalDate fim);

    @Query("""
            SELECT i.materiaPrima.id AS materiaPrimaId,
                   i.materiaPrima.unidadeMedida AS unidade,
                   COALESCE(SUM(i.quantidade), 0) AS quantidadeTotal,
                   COALESCE(SUM(i.valorTotal), 0) AS valorTotal,
                   MIN(i.valorUnitario) AS menorPreco,
                   MAX(i.valorUnitario) AS maiorPreco,
                   COUNT(DISTINCT i.compra.id) AS quantidadeCompras,
                   MIN(i.compra.dataCompra) AS primeiraCompra,
                   MAX(i.compra.dataCompra) AS ultimaCompra
            FROM ItemCompraMateriaPrima i
            WHERE i.compra.gestor.empresa.id = :empresaId
              AND i.compra.dataCompra >= :inicio AND i.compra.dataCompra <= :fim
            GROUP BY i.materiaPrima.id, i.materiaPrima.unidadeMedida
            ORDER BY SUM(i.valorTotal) DESC
            """)
    List<AnaliseCompraInsumoAgrupadaProjection> analisarInsumos(@Param("empresaId") Long empresaId,
            @Param("inicio") LocalDate inicio, @Param("fim") LocalDate fim);

    interface HistoricoPrecoCompraProjection {
        LocalDate getDataCompra();
        java.math.BigDecimal getQuantidade();
        java.math.BigDecimal getValorTotal();
        java.math.BigDecimal getValorUnitario();
    }

    @Query("""
            SELECT i.compra.dataCompra AS dataCompra, i.quantidade AS quantidade,
                   i.valorTotal AS valorTotal, i.valorUnitario AS valorUnitario
              FROM ItemCompraMateriaPrima i
             WHERE i.materiaPrima.id = :materiaPrimaId
               AND i.compra.gestor.empresa.id = :empresaId
               AND i.compra.dataCompra BETWEEN :inicio AND :fim
             ORDER BY i.compra.dataCompra DESC, i.id DESC
            """)
    List<HistoricoPrecoCompraProjection> historicoPrecos(@Param("empresaId") Long empresaId,
            @Param("materiaPrimaId") Long materiaPrimaId, @Param("inicio") LocalDate inicio,
            @Param("fim") LocalDate fim);
    List<CompraMateriaPrima> findByGestorOrderByDataCompraDesc(Usuario gestor);

    List<CompraMateriaPrima> findByGestorAndDataCompraBetweenOrderByDataCompraDesc(Usuario gestor, LocalDate inicio, LocalDate fim);
    List<CompraMateriaPrima> findAllByOrderByDataCompraDesc();
    List<CompraMateriaPrima> findByDataCompraBetweenOrderByDataCompraDesc(LocalDate inicio, LocalDate fim);
}
