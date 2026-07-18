package com.InovaSkill.CaderninhoDigital.repository;

import com.InovaSkill.CaderninhoDigital.entity.MovimentacaoEstoque;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.math.BigDecimal;

public interface MovimentacaoEstoqueRepository extends JpaRepository<MovimentacaoEstoque, Long>, JpaSpecificationExecutor<MovimentacaoEstoque> {

    @Query("SELECT DISTINCT m.usuario FROM MovimentacaoEstoque m ORDER BY m.usuario.nome")
    List<Usuario> listarUsuarios();

    interface ConsumoMateriaProjection {
        Long getMateriaPrimaId();
        BigDecimal getQuantidadeConsumida();
    }

    @Query(value = """
            SELECT materia_prima_id AS materiaPrimaId, COALESCE(SUM(quantidade), 0) AS quantidadeConsumida
            FROM movimentacoes_estoque
            WHERE materia_prima_id IS NOT NULL AND tipo_movimentacao = 'SAIDA' AND ocorrido_em >= :inicio
            GROUP BY materia_prima_id
            """, nativeQuery = true)
    List<ConsumoMateriaProjection> consumoMateriasDesde(@Param("inicio") LocalDateTime inicio);

}
