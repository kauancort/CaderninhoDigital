package com.InovaSkill.CaderninhoDigital.repository;

import com.InovaSkill.CaderninhoDigital.entity.MateriaPrima;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Pageable;

public interface MateriaPrimaRepository extends JpaRepository<MateriaPrima, Long>, JpaSpecificationExecutor<MateriaPrima> {
    interface EstoqueCriticoProjection {
        String getNome();
        String getUnidadeMedida();
        java.math.BigDecimal getEstoqueAtual();
        java.math.BigDecimal getEstoqueMinimo();
    }

    List<MateriaPrima> findByGestorOrderByNomeAsc(Usuario gestor);
    List<MateriaPrima> findAllByOrderByNomeAsc();
    List<MateriaPrima> findAllByAtivoTrueOrderByNomeAsc();

    @Query("""
            SELECT DISTINCT m FROM MateriaPrima m
             WHERE m.ativo = true
               AND (m.gestor IS NULL OR m.gestor.empresa.id = :empresaId)
             ORDER BY m.nome
            """)
    List<MateriaPrima> listarAcessiveisParaAnalise(@Param("empresaId") Long empresaId);

    @Query("""
            SELECT m FROM MateriaPrima m
             WHERE m.id = :materiaPrimaId AND m.ativo = true
               AND (m.gestor IS NULL OR m.gestor.empresa.id = :empresaId)
            """)
    java.util.Optional<MateriaPrima> buscarAcessivelParaAnalise(
            @Param("materiaPrimaId") Long materiaPrimaId, @Param("empresaId") Long empresaId);

    @Query("""
            SELECT COUNT(m),
                   SUM(CASE WHEN m.estoqueAtual <= m.estoqueMinimo THEN 1 ELSE 0 END),
                   SUM(m.estoqueAtual * m.custoMedio)
              FROM MateriaPrima m
             WHERE (:ativo IS NULL OR m.ativo = :ativo)
               AND (LOWER(m.nome) LIKE :termoLike OR LOWER(COALESCE(m.descricao, '')) LIKE :termoLike)
            """)
    List<Object[]> resumirEstoque(
            @Param("termoLike") String termoLike,
            @Param("ativo") Boolean ativo
    );

    @Query("""
            SELECT m.nome AS nome, m.unidadeMedida AS unidadeMedida,
                   m.estoqueAtual AS estoqueAtual, m.estoqueMinimo AS estoqueMinimo
              FROM MateriaPrima m
             WHERE m.ativo = true
               AND (m.gestor IS NULL OR m.gestor.empresa.id = :empresaId)
             ORDER BY m.nome
            """)
    List<EstoqueCriticoProjection> listarDadosEstoqueAtivos(@Param("empresaId") Long empresaId, Pageable limite);
}
