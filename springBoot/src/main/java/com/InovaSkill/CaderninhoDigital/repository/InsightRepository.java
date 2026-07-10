package com.InovaSkill.CaderninhoDigital.repository;

import com.InovaSkill.CaderninhoDigital.entity.Insight;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InsightRepository extends JpaRepository<Insight, Long> {
    List<Insight> findByGestorOrderByCriadoEmDesc(Usuario gestor);
    List<Insight> findAllByOrderByCriadoEmDesc();
}
