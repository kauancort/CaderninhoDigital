package com.InovaSkill.CaderninhoDigital.repository;

import com.InovaSkill.CaderninhoDigital.entity.MateriaPrima;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MateriaPrimaRepository extends JpaRepository<MateriaPrima, Long>, JpaSpecificationExecutor<MateriaPrima> {
    List<MateriaPrima> findByGestorOrderByNomeAsc(Usuario gestor);
    List<MateriaPrima> findAllByOrderByNomeAsc();

    @Query("""
            SELECT COUNT(m),
                   SUM(CASE WHEN m.estoqueAtual <= m.estoqueMinimo THEN 1 ELSE 0 END),
                   SUM(m.estoqueAtual * m.custoMedio)
              FROM MateriaPrima m
             WHERE (:ativo IS NULL OR m.ativo = :ativo)
               AND (LOWER(m.nome) LIKE :termoLike OR LOWER(COALESCE(m.descricao, '')) LIKE :termoLike)
            """)
    Object[] resumirEstoque(
            @Param("termoLike") String termoLike,
            @Param("ativo") Boolean ativo
    );
}
