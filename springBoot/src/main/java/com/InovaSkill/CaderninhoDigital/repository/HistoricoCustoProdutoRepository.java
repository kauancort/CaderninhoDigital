package com.InovaSkill.CaderninhoDigital.repository;

import com.InovaSkill.CaderninhoDigital.entity.HistoricoCustoProduto;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HistoricoCustoProdutoRepository extends JpaRepository<HistoricoCustoProduto, Long> {
    Optional<HistoricoCustoProduto> findFirstByProdutoIdAndFimVigenciaIsNullOrderByInicioVigenciaDesc(Long id);
}
