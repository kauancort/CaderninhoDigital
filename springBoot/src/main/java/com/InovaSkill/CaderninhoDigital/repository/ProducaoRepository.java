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
import com.InovaSkill.CaderninhoDigital.dto.response.ResumoProducaoProdutoDTO;

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

    @Query("SELECT new com.InovaSkill.CaderninhoDigital.dto.response.ResumoProducaoProdutoDTO(p.produto.id, p.produto.nome, COUNT(p), SUM(p.quantidadeProduzida)) FROM Producao p GROUP BY p.produto.id, p.produto.nome ORDER BY p.produto.nome")
    List<ResumoProducaoProdutoDTO> resumirPorProduto();

    @Query("SELECT COALESCE(MAX(p.id), 0) FROM Producao p")
    Long maiorId();
}
