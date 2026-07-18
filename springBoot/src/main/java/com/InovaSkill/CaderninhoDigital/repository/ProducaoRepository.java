package com.InovaSkill.CaderninhoDigital.repository;

import com.InovaSkill.CaderninhoDigital.entity.Producao;
import com.InovaSkill.CaderninhoDigital.entity.Produto;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProducaoRepository extends JpaRepository<Producao, Long>, JpaSpecificationExecutor<Producao> {
    List<Producao> findByGestorOrderByDataProducaoDesc(Usuario gestor);

    List<Producao> findByGestorAndProdutoOrderByDataProducaoDesc(Usuario gestor, Produto produto);

    List<Producao> findByGestorAndDataProducaoBetweenOrderByDataProducaoDesc(Usuario gestor, LocalDate inicio, LocalDate fim);
    List<Producao> findAllByOrderByDataProducaoDesc();
    List<Producao> findByProdutoOrderByDataProducaoDesc(Produto produto);
    List<Producao> findByDataProducaoBetweenOrderByDataProducaoDesc(LocalDate inicio, LocalDate fim);

    @EntityGraph(attributePaths = {"produto", "gestor", "insumos", "insumos.materiaPrima"})
    @Query("SELECT DISTINCT p FROM Producao p WHERE p.id IN :ids")
    List<Producao> buscarDetalhesPorIds(@Param("ids") List<Long> ids);
}
