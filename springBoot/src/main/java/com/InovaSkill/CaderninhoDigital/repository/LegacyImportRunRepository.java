package com.InovaSkill.CaderninhoDigital.repository;

import com.InovaSkill.CaderninhoDigital.entity.LegacyImportRun;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LegacyImportRunRepository extends JpaRepository<LegacyImportRun, Long> {
    List<LegacyImportRun> findByGestorIdOrderByCriadoEmDesc(Long gestorId);
}
