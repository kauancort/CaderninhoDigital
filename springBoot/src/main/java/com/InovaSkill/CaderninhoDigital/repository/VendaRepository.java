package com.InovaSkill.CaderninhoDigital.repository;

import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.entity.Venda;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VendaRepository extends JpaRepository<Venda, Long>, JpaSpecificationExecutor<Venda> {
    List<Venda> findByGestorOrderByDataVendaDesc(Usuario gestor);

    List<Venda> findByGestorAndDataVendaBetweenOrderByDataVendaDesc(Usuario gestor, LocalDate inicio, LocalDate fim);
    List<Venda> findAllByOrderByDataVendaDesc();
    List<Venda> findByDataVendaBetweenOrderByDataVendaDesc(LocalDate inicio, LocalDate fim);

    @EntityGraph(attributePaths = {"cliente", "gestor", "itens", "itens.produto"})
    @Query("SELECT DISTINCT v FROM Venda v WHERE v.id IN :ids")
    List<Venda> buscarDetalhesPorIds(@Param("ids") List<Long> ids);
}
