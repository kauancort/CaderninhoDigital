package com.InovaSkill.CaderninhoDigital.ai.orchestration;

import com.InovaSkill.CaderninhoDigital.ai.contract.*;
import com.InovaSkill.CaderninhoDigital.exception.CodigoErroOrquestrador;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class ConsolidadorResultadosOrquestracao {
    public Map<String, Object> consolidar(List<ResultadoFerramenta> resultados) {
        if (resultados.size() == 1) return resultados.getFirst().dadosAgregados();
        if (resultados.stream().allMatch(item -> item.ferramenta() == FerramentaPermitida.RESUMO_VENDAS)) {
            return consolidarVendasPeriodos(resultados);
        }
        ResultadoFerramenta vendas = resultado(resultados, FerramentaPermitida.RESUMO_VENDAS);
        ResultadoFerramenta gastos = resultado(resultados, FerramentaPermitida.RESUMO_GASTOS);
        BigDecimal totalVendas = decimal(vendas.dadosAgregados().get("valorTotalValido"));
        BigDecimal totalGastos = decimal(gastos.dadosAgregados().get("totalGastos"));
        BigDecimal diferenca = totalVendas.subtract(totalGastos);
        Map<String, Object> comparacao = new LinkedHashMap<>();
        comparacao.put("vendas", totalVendas);
        comparacao.put("gastos", totalGastos);
        comparacao.put("diferenca", diferenca);
        comparacao.put("percentualVendasSobreGastos", totalGastos.signum() == 0 ? null
                : totalVendas.divide(totalGastos, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100))
                        .setScale(2, RoundingMode.HALF_UP));
        Map<String, Object> consolidado = new LinkedHashMap<>();
        consolidado.put("vendas", vendas.dadosAgregados());
        consolidado.put("gastos", gastos.dadosAgregados());
        consolidado.put("comparacao", comparacao);
        return consolidado;
    }

    private Map<String, Object> consolidarVendasPeriodos(List<ResultadoFerramenta> resultados) {
        ResultadoFerramenta anterior = resultados.get(0);
        ResultadoFerramenta atual = resultados.get(1);
        BigDecimal vendasAnterior = decimal(anterior.dadosAgregados().get("valorTotalValido"));
        BigDecimal vendasAtual = decimal(atual.dadosAgregados().get("valorTotalValido"));
        BigDecimal diferenca = vendasAtual.subtract(vendasAnterior);
        Map<String, Object> comparacao = new LinkedHashMap<>();
        comparacao.put("vendasPeriodoAnterior", vendasAnterior);
        comparacao.put("vendasPeriodoAtual", vendasAtual);
        comparacao.put("diferenca", diferenca);
        comparacao.put("variacaoPercentual", vendasAnterior.signum() == 0 ? null
                : diferenca.divide(vendasAnterior, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100))
                        .setScale(2, RoundingMode.HALF_UP));
        long diasAnterior = diasInclusivos(anterior);
        long diasAtual = diasInclusivos(atual);
        comparacao.put("diasPeriodoAnterior", diasAnterior);
        comparacao.put("diasPeriodoAtual", diasAtual);
        comparacao.put("coberturaEquivalente", diasAnterior == diasAtual);
        Map<String, Object> consolidado = new LinkedHashMap<>();
        consolidado.put("periodoAnterior", Map.of("inicio", anterior.periodoInicio(), "fim", anterior.periodoFim(),
                "dados", anterior.dadosAgregados()));
        consolidado.put("periodoAtual", Map.of("inicio", atual.periodoInicio(), "fim", atual.periodoFim(),
                "dados", atual.dadosAgregados()));
        consolidado.put("comparacao", comparacao);
        return consolidado;
    }

    private long diasInclusivos(ResultadoFerramenta resultado) {
        if (resultado.periodoInicio() == null || resultado.periodoFim() == null) return 0;
        return ChronoUnit.DAYS.between(resultado.periodoInicio(), resultado.periodoFim()) + 1;
    }

    private ResultadoFerramenta resultado(List<ResultadoFerramenta> resultados, FerramentaPermitida ferramenta) {
        return resultados.stream().filter(item -> item.ferramenta() == ferramenta).findFirst()
                .orElseThrow(() -> new OrquestradorException(CodigoErroOrquestrador.ERRO_INTERNO,
                        HttpStatus.INTERNAL_SERVER_ERROR, "Resultado necessário ausente"));
    }

    private BigDecimal decimal(Object valor) {
        if (valor instanceof BigDecimal decimal) return decimal;
        if (valor instanceof Number numero) return new BigDecimal(numero.toString());
        throw new OrquestradorException(CodigoErroOrquestrador.ERRO_INTERNO,
                HttpStatus.INTERNAL_SERVER_ERROR, "Resultado financeiro inválido");
    }
}
