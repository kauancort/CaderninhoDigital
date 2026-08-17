package com.InovaSkill.CaderninhoDigital.repository;

import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import java.util.Optional;
import java.util.List;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {
    Optional<Usuario> findByEmail(String email);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM Usuario u WHERE u.email = :email")
    Optional<Usuario> findByEmailForUpdate(@Param("email") String email);

    boolean existsByEmail(String email);

    List<Usuario> findAllByOrderByNomeAsc();

    List<Usuario> findByEmpresaIdOrderByNomeAsc(Long empresaId);

    @Query("SELECT u.empresa.id FROM Usuario u WHERE u.id = :usuarioId")
    Optional<Long> buscarEmpresaId(@Param("usuarioId") Long usuarioId);
}
