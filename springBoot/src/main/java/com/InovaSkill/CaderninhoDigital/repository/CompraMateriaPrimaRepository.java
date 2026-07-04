package com.InovaSkill.CaderninhoDigital.repository;

import com.InovaSkill.CaderninhoDigital.entity.CompraMateriaPrima;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CompraMateriaPrimaRepository extends JpaRepository<CompraMateriaPrima, Long> {
    List<CompraMateriaPrima> findByGestorOrderByDataCompraDesc(Usuario gestor);

    List<CompraMateriaPrima> findByGestorAndDataCompraBetweenOrderByDataCompraDesc(Usuario gestor, LocalDate inicio, LocalDate fim);
}
