package com.InovaSkill.CaderninhoDigital.repository;

import com.InovaSkill.CaderninhoDigital.entity.MateriaPrima;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface MateriaPrimaRepository extends JpaRepository<MateriaPrima, Long>, JpaSpecificationExecutor<MateriaPrima> {
    List<MateriaPrima> findByGestorOrderByNomeAsc(Usuario gestor);
    List<MateriaPrima> findAllByOrderByNomeAsc();
}
