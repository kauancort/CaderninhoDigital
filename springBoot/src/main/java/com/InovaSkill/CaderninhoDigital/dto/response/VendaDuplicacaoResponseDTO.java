package com.InovaSkill.CaderninhoDigital.dto.response;
import java.math.BigDecimal;
import java.util.List;
public record VendaDuplicacaoResponseDTO(Long vendaOrigemId, Long clienteId, String clienteNome,
 List<ItemDuplicacao> itens, List<String> avisos) {
 public record ItemDuplicacao(Long produtoId,String produtoNome,BigDecimal quantidade,BigDecimal precoAnterior,BigDecimal precoAtual,BigDecimal estoqueDisponivel){}
}
