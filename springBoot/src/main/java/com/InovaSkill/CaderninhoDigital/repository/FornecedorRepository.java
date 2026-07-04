package com.InovaSkill.CaderninhoDigital.repository;

import com.InovaSkill.CaderninhoDigital.entity.Fornecedor;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FornecedorRepository extends JpaRepository<Fornecedor, Long> {
    List<Fornecedor> findByGestorOrderByNomeAsc(Usuario gestor);
}
