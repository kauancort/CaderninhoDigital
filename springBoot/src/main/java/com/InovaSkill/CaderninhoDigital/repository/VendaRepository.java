package com.InovaSkill.CaderninhoDigital.repository;

import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.entity.Venda;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VendaRepository extends JpaRepository<Venda, Long> {
    List<Venda> findByGestorOrderByDataVendaDesc(Usuario gestor);

    List<Venda> findByGestorAndDataVendaBetweenOrderByDataVendaDesc(Usuario gestor, LocalDate inicio, LocalDate fim);
    List<Venda> findAllByOrderByDataVendaDesc();
    List<Venda> findByDataVendaBetweenOrderByDataVendaDesc(LocalDate inicio, LocalDate fim);
}
