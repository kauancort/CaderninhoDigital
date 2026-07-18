package com.InovaSkill.CaderninhoDigital.dto.response;
import java.math.BigDecimal;
public record SugestaoReposicaoResponseDTO(Long materiaPrimaId,String nome,String unidadeMedida,
 BigDecimal estoqueAtual,BigDecimal estoqueMinimo,BigDecimal consumoMedioDiario,
 BigDecimal quantidadeSugerida,String justificativa){}
