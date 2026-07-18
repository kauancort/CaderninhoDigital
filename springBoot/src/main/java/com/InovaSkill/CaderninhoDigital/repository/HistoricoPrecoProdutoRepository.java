package com.InovaSkill.CaderninhoDigital.repository;
import com.InovaSkill.CaderninhoDigital.entity.HistoricoPrecoProduto;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
public interface HistoricoPrecoProdutoRepository extends JpaRepository<HistoricoPrecoProduto,Long>{ Optional<HistoricoPrecoProduto> findFirstByProdutoIdAndFimVigenciaIsNullOrderByInicioVigenciaDesc(Long id); }
