package com.InovaSkill.CaderninhoDigital.repository;

import com.InovaSkill.CaderninhoDigital.entity.Lancamento;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.enums.TipoLancamento;
import com.InovaSkill.CaderninhoDigital.repository.projection.ResumoGastosProjection;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LancamentoRepository extends JpaRepository<Lancamento, Long> {

    @Query("""
            SELECT COALESCE(SUM(l.valorTotal), 0) AS total, COUNT(l) AS quantidade
            FROM Lancamento l
            WHERE l.tipo = com.InovaSkill.CaderninhoDigital.enums.TipoLancamento.GASTO_GERAL
              AND l.dataLancamento >= :inicio AND l.dataLancamento <= :fim
            """)
    ResumoGastosProjection resumirGastos(@Param("inicio") LocalDate inicio, @Param("fim") LocalDate fim);

    List<Lancamento> findByGestorOrderByDataLancamentoDesc(Usuario gestor);

    List<Lancamento> findByGestorAndTipoOrderByDataLancamentoDesc(Usuario gestor, TipoLancamento tipo);

    List<Lancamento> findByGestorAndDataLancamentoBetweenOrderByDataLancamentoDesc(
            Usuario gestor,
            LocalDate inicio,
            LocalDate fim
    );

    List<Lancamento> findByGestorAndTipoAndDataLancamentoBetweenOrderByDataLancamentoDesc(
            Usuario gestor,
            TipoLancamento tipo,
            LocalDate inicio,
            LocalDate fim
    );
    List<Lancamento> findAllByOrderByDataLancamentoDesc();
    List<Lancamento> findByTipoOrderByDataLancamentoDesc(TipoLancamento tipo);
    List<Lancamento> findByDataLancamentoBetweenOrderByDataLancamentoDesc(LocalDate inicio, LocalDate fim);
    List<Lancamento> findByTipoAndDataLancamentoBetweenOrderByDataLancamentoDesc(
            TipoLancamento tipo, LocalDate inicio, LocalDate fim);
}
