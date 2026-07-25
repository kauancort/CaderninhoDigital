package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.enums.SituacaoCobranca;
import com.InovaSkill.CaderninhoDigital.enums.StatusPagamento;
import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ClassificadorCobrancaService {

    public static final int LIMITE_ATRASO_RECENTE_DIAS = 7;
    public static final int LIMITE_ATRASO_MEDIO_DIAS = 30;

    private final Clock clock;

    public LocalDate hoje() {
        return LocalDate.now(clock);
    }

    public long calcularDiasAtraso(LocalDate vencimento, StatusPagamento statusPagamento) {
        return calcularDiasAtraso(vencimento, statusPagamento, hoje());
    }

    long calcularDiasAtraso(LocalDate vencimento, StatusPagamento statusPagamento, LocalDate hoje) {
        if (statusPagamento == StatusPagamento.PAGO || vencimento == null || !vencimento.isBefore(hoje)) {
            return 0;
        }
        return ChronoUnit.DAYS.between(vencimento, hoje);
    }

    public SituacaoCobranca classificar(LocalDate vencimento, StatusPagamento statusPagamento) {
        return classificar(vencimento, statusPagamento, hoje());
    }

    SituacaoCobranca classificar(
            LocalDate vencimento,
            StatusPagamento statusPagamento,
            LocalDate hoje
    ) {
        long dias = calcularDiasAtraso(vencimento, statusPagamento, hoje);
        if (dias == 0) {
            return SituacaoCobranca.EM_DIA;
        }
        if (dias <= LIMITE_ATRASO_RECENTE_DIAS) {
            return SituacaoCobranca.ATRASO_RECENTE;
        }
        if (dias <= LIMITE_ATRASO_MEDIO_DIAS) {
            return SituacaoCobranca.ATRASO_MEDIO;
        }
        return SituacaoCobranca.MUITO_ATRASADO;
    }
}
