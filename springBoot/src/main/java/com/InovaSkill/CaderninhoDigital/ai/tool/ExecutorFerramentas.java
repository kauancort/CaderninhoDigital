package com.InovaSkill.CaderninhoDigital.ai.tool;

import com.InovaSkill.CaderninhoDigital.ai.contract.ArgumentosFerramenta;
import com.InovaSkill.CaderninhoDigital.ai.contract.ArgumentosPeriodo;
import com.InovaSkill.CaderninhoDigital.ai.contract.ArgumentosCompraInsumo;
import com.InovaSkill.CaderninhoDigital.ai.contract.ChamadaFerramenta;
import com.InovaSkill.CaderninhoDigital.ai.contract.ResultadoFerramenta;
import com.InovaSkill.CaderninhoDigital.config.AiOrchestratorProperties;
import com.InovaSkill.CaderninhoDigital.exception.CodigoErroOrquestrador;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import jakarta.validation.Validator;
import java.time.temporal.ChronoUnit;
import java.util.concurrent.CancellationException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;

@Slf4j
public class ExecutorFerramentas {
    private final CatalogoFerramentas catalogo;
    private final ContextoFerramentaFactory contextoFactory;
    private final AiOrchestratorProperties properties;
    private final Validator validator;
    private final ExecutorService executorService;

    public ExecutorFerramentas(
            CatalogoFerramentas catalogo,
            ContextoFerramentaFactory contextoFactory,
            AiOrchestratorProperties properties,
            Validator validator,
            ExecutorService executorService
    ) {
        this.catalogo = catalogo;
        this.contextoFactory = contextoFactory;
        this.properties = properties;
        this.validator = validator;
        this.executorService = executorService;
    }

    public ResultadoFerramenta executar(ChamadaFerramenta chamada, String correlacao) {
        if (!properties.getFeatures().isTools()) {
            throw erro(CodigoErroOrquestrador.FERRAMENTA_DESCONHECIDA, HttpStatus.NOT_FOUND,
                    "Ferramentas não estão habilitadas");
        }
        if (chamada == null || chamada.ferramenta() == null || chamada.argumentos() == null) {
            throw argumentosInvalidos();
        }
        FerramentaLeitura<?> ferramenta = catalogo.localizar(chamada.ferramenta());
        if (ferramenta == null) {
            throw erro(CodigoErroOrquestrador.FERRAMENTA_DESCONHECIDA, HttpStatus.NOT_FOUND,
                    "Ferramenta não permitida");
        }
        validarArgumentos(ferramenta, chamada.argumentos());
        ContextoExecucaoFerramenta contexto = contextoFactory.criar(correlacao);
        if (contexto.identidade().perfil() != ferramenta.permissaoNecessaria()) {
            log.info("Decisão de ferramenta: ferramenta={} autorizada=false correlacao={}",
                    ferramenta.identificador(), contexto.correlacao());
            throw erro(CodigoErroOrquestrador.NAO_AUTORIZADO, HttpStatus.FORBIDDEN,
                    "Usuário não autorizado para a ferramenta");
        }
        log.info("Decisão de ferramenta: ferramenta={} autorizada=true correlacao={}",
                ferramenta.identificador(), contexto.correlacao());
        return executarUmaVez(ferramenta, chamada.argumentos(), contexto);
    }

    private void validarArgumentos(FerramentaLeitura<?> ferramenta, ArgumentosFerramenta argumentos) {
        if (!ferramenta.classeArgumentos().equals(argumentos.getClass())
                || !validator.validate(argumentos).isEmpty()) {
            throw argumentosInvalidos();
        }
        if (argumentos instanceof ArgumentosPeriodo periodo) {
            if (periodo.inicio().isAfter(periodo.fim())
                    || ChronoUnit.DAYS.between(periodo.inicio(), periodo.fim())
                    > properties.getLimits().getMaxPeriodDays()) {
                throw argumentosInvalidos();
            }
        }
        if (argumentos instanceof ArgumentosCompraInsumo compra) {
            if (compra.inicio().isAfter(compra.fim())
                    || ChronoUnit.DAYS.between(compra.inicio(), compra.fim())
                    > properties.getLimits().getMaxPeriodDays()) {
                throw argumentosInvalidos();
            }
        }
    }

    private ResultadoFerramenta executarUmaVez(
            FerramentaLeitura<?> ferramenta,
            ArgumentosFerramenta argumentos,
            ContextoExecucaoFerramenta contexto
    ) {
        Future<ResultadoFerramenta> future = executorService.submit(
                () -> executarTipada(ferramenta, argumentos, contexto));
        try {
            ResultadoFerramenta resultado = future.get(ferramenta.timeout().toMillis(), TimeUnit.MILLISECONDS);
            if (resultado == null
                    || resultado.ferramenta() != ferramenta.identificador()
                    || resultado.status() == null
                    || resultado.dadosAgregados() == null
                    || resultado.atualizadoEm() == null
                    || resultado.avisos() == null
                    || resultado.qualidade() == null) {
                throw erro(CodigoErroOrquestrador.ERRO_INTERNO, HttpStatus.INTERNAL_SERVER_ERROR,
                        "A ferramenta não produziu um resultado válido");
            }
            return resultado;
        } catch (TimeoutException exception) {
            future.cancel(true);
            throw erro(CodigoErroOrquestrador.TIMEOUT, HttpStatus.GATEWAY_TIMEOUT,
                    "A ferramenta excedeu o tempo limite");
        } catch (CancellationException exception) {
            throw erro(CodigoErroOrquestrador.TIMEOUT, HttpStatus.GATEWAY_TIMEOUT,
                    "A execução da ferramenta foi cancelada");
        } catch (InterruptedException exception) {
            future.cancel(true);
            Thread.currentThread().interrupt();
            throw erro(CodigoErroOrquestrador.TIMEOUT, HttpStatus.GATEWAY_TIMEOUT,
                    "A execução da ferramenta foi interrompida");
        } catch (ExecutionException exception) {
            throw erro(CodigoErroOrquestrador.ERRO_INTERNO, HttpStatus.INTERNAL_SERVER_ERROR,
                    "A ferramenta não pôde ser executada");
        }
    }

    private <A extends ArgumentosFerramenta> ResultadoFerramenta executarComTipo(
            FerramentaLeitura<A> ferramenta,
            ArgumentosFerramenta argumentos,
            ContextoExecucaoFerramenta contexto
    ) {
        return ferramenta.executar(ferramenta.classeArgumentos().cast(argumentos), contexto);
    }

    @SuppressWarnings("unchecked")
    private ResultadoFerramenta executarTipada(
            FerramentaLeitura<?> ferramenta,
            ArgumentosFerramenta argumentos,
            ContextoExecucaoFerramenta contexto
    ) {
        return executarComTipo((FerramentaLeitura<ArgumentosFerramenta>) ferramenta, argumentos, contexto);
    }

    private OrquestradorException argumentosInvalidos() {
        return erro(CodigoErroOrquestrador.ARGUMENTOS_INVALIDOS, HttpStatus.BAD_REQUEST,
                "Argumentos da ferramenta são inválidos");
    }

    private OrquestradorException erro(CodigoErroOrquestrador codigo, HttpStatus status, String mensagem) {
        return new OrquestradorException(codigo, status, mensagem);
    }
}
