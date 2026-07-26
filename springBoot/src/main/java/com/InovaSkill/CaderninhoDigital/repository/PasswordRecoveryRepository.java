package com.InovaSkill.CaderninhoDigital.repository;

import com.InovaSkill.CaderninhoDigital.entity.PasswordRecovery;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import jakarta.persistence.LockModeType;
import java.time.LocalDateTime;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PasswordRecoveryRepository extends JpaRepository<PasswordRecovery, Long> {

    Optional<PasswordRecovery> findFirstByUsuarioOrderByCriadoEmDesc(Usuario usuario);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<PasswordRecovery> findFirstByUsuarioAndUsadoEmIsNullOrderByCriadoEmDesc(Usuario usuario);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<PasswordRecovery> findByRecoveryTokenHashAndUsadoEmIsNull(String recoveryTokenHash);

    @Modifying
    @Query("""
            UPDATE PasswordRecovery p
               SET p.usadoEm = :agora
             WHERE p.usuario = :usuario
               AND p.usadoEm IS NULL
            """)
    int invalidarPendentes(@Param("usuario") Usuario usuario, @Param("agora") LocalDateTime agora);

    @Modifying
    @Query("DELETE FROM PasswordRecovery p WHERE p.criadoEm < :limite")
    int excluirAntigos(@Param("limite") LocalDateTime limite);
}
