package com.InovaSkill.CaderninhoDigital.ai.orchestration;

import com.InovaSkill.CaderninhoDigital.ai.contract.*;
import com.InovaSkill.CaderninhoDigital.exception.CodigoErroOrquestrador;
import com.InovaSkill.CaderninhoDigital.exception.OrquestradorException;
import com.InovaSkill.CaderninhoDigital.service.PlanoContratoValidator;
import java.util.HashSet;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class PoliticaPlanoOrquestracao {
    private final PlanoContratoValidator contratoValidator;

    public PoliticaPlanoOrquestracao(PlanoContratoValidator contratoValidator) {
        this.contratoValidator = contratoValidator;
    }

    public void validar(PlanoOrquestracao plano) {
        contratoValidator.validar(plano);
        if (plano.chamadas().isEmpty() || plano.chamadas().size() > 2) throw planoInvalido("Quantidade de ferramentas não permitida");
        plano.chamadas().forEach(this::validarChamada);
        if (plano.chamadas().size() == 1 && plano.intencao() != intencaoEsperada(plano.chamadas().getFirst().ferramenta())) {
            throw planoInvalido("Intenção e ferramenta não correspondem");
        }
        if (plano.chamadas().size() == 2) validarComparacao(plano);
    }

    public IntencaoOrquestrador intencaoEsperada(FerramentaPermitida ferramenta) {
        return switch (ferramenta) {
            case RESUMO_ESTOQUE -> IntencaoOrquestrador.CONSULTAR_ESTOQUE;
            case RESUMO_VENDAS -> IntencaoOrquestrador.CONSULTAR_VENDAS;
            case RESUMO_GASTOS -> IntencaoOrquestrador.CONSULTAR_GASTOS;
            case RESUMO_RECEBIVEIS -> IntencaoOrquestrador.CONSULTAR_RECEBIVEIS;
            case ANALISE_CUSTO_PRODUTO -> IntencaoOrquestrador.ANALISAR_CUSTO_PRODUTO;
            case ANALISE_COMPRAS_INSUMO -> IntencaoOrquestrador.ANALISAR_COMPRAS_INSUMO;
            case COMPARAR_PRECO_MERCADO -> IntencaoOrquestrador.COMPARAR_PRECO_MERCADO;
            default -> throw planoInvalido("Ferramenta não disponível nesta etapa");
        };
    }

    private void validarChamada(ChamadaFerramenta chamada) {
        boolean argumentosValidos = switch (chamada.ferramenta()) {
            case RESUMO_ESTOQUE -> chamada.argumentos() instanceof ArgumentosSemFiltro;
            case RESUMO_VENDAS, RESUMO_GASTOS, RESUMO_RECEBIVEIS -> chamada.argumentos() instanceof ArgumentosPeriodo;
            case ANALISE_CUSTO_PRODUTO -> chamada.argumentos() instanceof ArgumentosProduto;
            case ANALISE_COMPRAS_INSUMO -> chamada.argumentos() instanceof ArgumentosCompraInsumo;
            case COMPARAR_PRECO_MERCADO -> chamada.argumentos() instanceof ArgumentosComparacaoMercado;
            default -> false;
        };
        if (!argumentosValidos) throw planoInvalido("Argumentos não permitidos para a ferramenta");
    }

    private void validarComparacao(PlanoOrquestracao plano) {
        Set<FerramentaPermitida> ferramentas = new HashSet<>(plano.chamadas().stream()
                .map(ChamadaFerramenta::ferramenta).toList());
        boolean vendasGastos = plano.intencao() == IntencaoOrquestrador.COMPARAR_VENDAS_GASTOS
                && ferramentas.equals(Set.of(FerramentaPermitida.RESUMO_VENDAS, FerramentaPermitida.RESUMO_GASTOS));
        boolean vendasPeriodos = plano.intencao() == IntencaoOrquestrador.COMPARAR_VENDAS_PERIODOS
                && ferramentas.equals(Set.of(FerramentaPermitida.RESUMO_VENDAS));
        if (plano.modoResposta() != ModoResposta.ANALITICA || (!vendasGastos && !vendasPeriodos)) {
            throw planoInvalido("Combinação de ferramentas não permitida");
        }
        ArgumentosPeriodo primeiro = (ArgumentosPeriodo) plano.chamadas().get(0).argumentos();
        ArgumentosPeriodo segundo = (ArgumentosPeriodo) plano.chamadas().get(1).argumentos();
        if ((vendasGastos && !primeiro.equals(segundo)) || (vendasPeriodos && primeiro.equals(segundo))) {
            throw new OrquestradorException(CodigoErroOrquestrador.ARGUMENTOS_INVALIDOS,
                    HttpStatus.BAD_REQUEST, "Os períodos da comparação são inválidos");
        }
    }

    private OrquestradorException planoInvalido(String mensagem) {
        return new OrquestradorException(CodigoErroOrquestrador.PLANO_INVALIDO, HttpStatus.BAD_REQUEST, mensagem);
    }
}
