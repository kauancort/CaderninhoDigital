package com.InovaSkill.CaderninhoDigital.ai.orchestration;

import com.InovaSkill.CaderninhoDigital.ai.contract.ChamadaFerramenta;
import com.InovaSkill.CaderninhoDigital.ai.contract.ResultadoFerramenta;
import com.InovaSkill.CaderninhoDigital.ai.tool.ExecutorFerramentas;
import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import com.InovaSkill.CaderninhoDigital.exception.CodigoErroOrquestrador;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.springframework.http.HttpStatus;
import org.springframework.security.concurrent.DelegatingSecurityContextExecutorService;
import org.springframework.stereotype.Component;

@Component
public class ExecutorPlanoOrquestracao {
    private final ExecutorFerramentas executorFerramentas;
    private final ExecutorService executorService;
    private final AiOrchestratorProperties properties;

    public ExecutorPlanoOrquestracao(ExecutorFerramentas executorFerramentas, ExecutorService executorService,
            AiOrchestratorProperties properties) {
        this.executorFerramentas = executorFerramentas;
        this.executorService = new DelegatingSecurityContextExecutorService(executorService);
        this.properties = properties;
    }

    public List<ResultadoFerramenta> executar(List<ChamadaFerramenta> chamadas, String correlacao) {
        var future = executorService.submit(() -> {
            List<ResultadoFerramenta> resultados = new ArrayList<>(chamadas.size());
            for (ChamadaFerramenta chamada : chamadas) resultados.add(executorFerramentas.executar(chamada, correlacao));
            return List.copyOf(resultados);
        });
        try {
            return future.get(properties.getLimits().getRequestBudgetMillis(), TimeUnit.MILLISECONDS);
        } catch (TimeoutException exception) {
            future.cancel(true);
            throw timeout("O plano excedeu o tempo total permitido");
        } catch (InterruptedException exception) {
            future.cancel(true);
            Thread.currentThread().interrupt();
            throw timeout("A execução do plano foi interrompida");
        } catch (ExecutionException exception) {
            if (exception.getCause() instanceof OrquestradorException erro) throw erro;
            throw new OrquestradorException(CodigoErroOrquestrador.ERRO_INTERNO,
                    HttpStatus.INTERNAL_SERVER_ERROR, "O plano não pôde ser executado");
        }
    }

    private OrquestradorException timeout(String mensagem) {
        return new OrquestradorException(CodigoErroOrquestrador.TIMEOUT, HttpStatus.GATEWAY_TIMEOUT, mensagem);
    }
}
