package com.InovaSkill.CaderninhoDigital.repository;

import com.InovaSkill.CaderninhoDigital.entity.Producao;
import com.InovaSkill.CaderninhoDigital.entity.Produto;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProducaoRepository extends JpaRepository<Producao, Long> {
    List<Producao> findByGestorOrderByDataProducaoDesc(Usuario gestor);

    List<Producao> findByGestorAndProdutoOrderByDataProducaoDesc(Usuario gestor, Produto produto);

    List<Producao> findByGestorAndDataProducaoBetweenOrderByDataProducaoDesc(Usuario gestor, LocalDate inicio, LocalDate fim);
}
