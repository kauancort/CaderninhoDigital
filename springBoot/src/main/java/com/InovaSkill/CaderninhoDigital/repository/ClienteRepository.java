package com.InovaSkill.CaderninhoDigital.repository;

import com.InovaSkill.CaderninhoDigital.entity.Cliente;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClienteRepository extends JpaRepository<Cliente, Long> {
    List<Cliente> findByGestorOrderByNomeAsc(Usuario gestor);
}
