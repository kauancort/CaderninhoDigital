package com.InovaSkill.CaderninhoDigital.repository;

import com.InovaSkill.CaderninhoDigital.entity.CategoriaProduto;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoriaProdutoRepository extends JpaRepository<CategoriaProduto, Long> {
    List<CategoriaProduto> findAllByOrderByNomeAsc();
    boolean existsByNomeIgnoreCaseAndIdNot(String nome, Long id);
    boolean existsByNomeIgnoreCase(String nome);
}
