package com.InovaSkill.CaderninhoDigital.repository;
import com.InovaSkill.CaderninhoDigital.entity.HistoricoCustoMateriaPrima;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
public interface HistoricoCustoMateriaPrimaRepository extends JpaRepository<HistoricoCustoMateriaPrima,Long>{ Optional<HistoricoCustoMateriaPrima> findFirstByMateriaPrimaIdAndFimVigenciaIsNullOrderByInicioVigenciaDesc(Long id); }
