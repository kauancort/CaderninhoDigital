package com.InovaSkill.CaderninhoDigital.repository;

import com.InovaSkill.CaderninhoDigital.entity.Produto;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import java.util.Optional;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProdutoRepository extends JpaRepository<Produto, Long>, JpaSpecificationExecutor<Produto> {
    boolean existsByGestorIdAndSkuIgnoreCase(Long gestorId, String sku);
    boolean existsBySkuIgnoreCase(String sku);
    boolean existsBySkuIgnoreCaseAndIdNot(String sku, Long id);
    List<Produto> findByGestorOrderByNomeAsc(Usuario gestor);
    @EntityGraph(attributePaths = {"gabarito", "gabarito.itens", "gabarito.itens.materiaPrima"})
    List<Produto> findAllByOrderByNomeAsc();
    @EntityGraph(attributePaths = {"gabarito", "gabarito.itens", "gabarito.itens.materiaPrima"})
    List<Produto> findAllByAtivoTrueOrderByNomeAsc();
    @EntityGraph(attributePaths = {"gabarito", "gabarito.itens", "gabarito.itens.materiaPrima"})
    @Query("SELECT p FROM Produto p WHERE p.id = :id")
    Optional<Produto> findComGabaritoById(@Param("id") Long id);

    @EntityGraph(attributePaths = {"gabarito", "gabarito.itens", "gabarito.itens.materiaPrima"})
    @Query("""
            SELECT p FROM Produto p
             WHERE p.id = :produtoId AND p.ativo = true
               AND (p.gestor IS NULL OR p.gestor.empresa.id = :empresaId)
            """)
    Optional<Produto> buscarComGabaritoParaEmpresa(@Param("produtoId") Long produtoId,
            @Param("empresaId") Long empresaId);

    @Query("""
            SELECT p FROM Produto p
             WHERE p.ativo = true AND (p.gestor IS NULL OR p.gestor.empresa.id = :empresaId)
             ORDER BY p.nome
            """)
    List<Produto> listarAtivosParaEmpresa(@Param("empresaId") Long empresaId);
}
