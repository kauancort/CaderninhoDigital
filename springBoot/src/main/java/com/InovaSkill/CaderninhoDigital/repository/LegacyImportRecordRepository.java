package com.InovaSkill.CaderninhoDigital.repository;

import com.InovaSkill.CaderninhoDigital.entity.LegacyImportRecord;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LegacyImportRecordRepository extends JpaRepository<LegacyImportRecord, Long> {
    Optional<LegacyImportRecord> findByGestorIdAndArquivoAndLinhaAndCodigoLegadoAndDominio(
            Long gestorId, String arquivo, Integer linha, String codigoLegado, String dominio);
}
