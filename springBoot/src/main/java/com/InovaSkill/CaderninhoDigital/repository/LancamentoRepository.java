package com.InovaSkill.CaderninhoDigital.repository;

import com.InovaSkill.CaderninhoDigital.entity.Lancamento;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.enums.TipoLancamento;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LancamentoRepository extends JpaRepository<Lancamento, Long> {

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
