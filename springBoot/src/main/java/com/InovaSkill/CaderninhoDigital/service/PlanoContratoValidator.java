package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.ai.contract.ArgumentosPeriodo;
import com.InovaSkill.CaderninhoDigital.ai.contract.ArgumentosRentabilidadeProduto;
import com.InovaSkill.CaderninhoDigital.ai.contract.PlanoOrquestracao;
import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import com.InovaSkill.CaderninhoDigital.exception.CodigoErroOrquestrador;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import jakarta.validation.Validator;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class PlanoContratoValidator {
    private final AiOrchestratorProperties properties;
    private final Validator validator;

    public PlanoContratoValidator(AiOrchestratorProperties properties, Validator validator) {
        this.properties = properties;
        this.validator = validator;
    }

    public void validar(PlanoOrquestracao plano) {
        if (plano == null || !properties.getSchemaVersion().equals(plano.schemaVersion())) {
            throw planoInvalido("Versão de schema do plano não suportada");
        }
        if (!validator.validate(plano).isEmpty()) {
            throw planoInvalido("Plano incompleto ou inválido");
        }
        if (plano.chamadas().size() > properties.getLimits().getToolsPerPlan()
                || plano.chamadas().size() > properties.getLimits().getToolCalls()) {
            throw new OrquestradorException(CodigoErroOrquestrador.LIMITE_EXCEDIDO,
                    HttpStatus.PAYLOAD_TOO_LARGE, "Plano excede o limite de ferramentas");
        }
        plano.chamadas().forEach(chamada -> {
            if (chamada.argumentos() instanceof ArgumentosPeriodo periodo
                    && periodo.inicio() != null && periodo.fim() != null
                    && periodo.inicio().isAfter(periodo.fim())) {
                throw new OrquestradorException(CodigoErroOrquestrador.ARGUMENTOS_INVALIDOS,
                        HttpStatus.BAD_REQUEST, "Período da ferramenta é inválido");
            }
            if (chamada.argumentos() instanceof ArgumentosRentabilidadeProduto rentabilidade
                    && rentabilidade.inicio().isAfter(rentabilidade.fim())) {
                throw new OrquestradorException(CodigoErroOrquestrador.ARGUMENTOS_INVALIDOS,
                        HttpStatus.BAD_REQUEST, "Período da rentabilidade é inválido");
            }
        });
    }

    public int limiteFerramentasPorPlano() {
        return Math.min(properties.getLimits().getToolsPerPlan(), properties.getLimits().getToolCalls());
    }

    public int limitePesquisasMercado() {
        return properties.getLimits().getMarketSearchesPerRequest();
    }

    private OrquestradorException planoInvalido(String message) {
        return new OrquestradorException(CodigoErroOrquestrador.PLANO_INVALIDO,
                HttpStatus.BAD_REQUEST, message);
    }
}
