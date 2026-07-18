package com.InovaSkill.CaderninhoDigital.service;
import com.InovaSkill.CaderninhoDigital.dto.response.SugestaoReposicaoResponseDTO;
import com.InovaSkill.CaderninhoDigital.repository.*;
import java.math.*;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
@Service @RequiredArgsConstructor
public class SugestaoReposicaoService {
 private final MateriaPrimaRepository materias;
 private final MovimentacaoEstoqueRepository movimentos;
 private final UsuarioAcessoService acesso;
 public List<SugestaoReposicaoResponseDTO> listar(Long usuarioId,int dias,int prazoReposicaoDias){
  acesso.buscarGestor(usuarioId); int janela=Math.min(365,Math.max(30,dias)); int prazo=Math.min(180,Math.max(1,prazoReposicaoDias));
  Map<Long,BigDecimal> consumos=movimentos.consumoMateriasDesde(LocalDateTime.now().minusDays(janela)).stream().collect(Collectors.toMap(MovimentacaoEstoqueRepository.ConsumoMateriaProjection::getMateriaPrimaId,MovimentacaoEstoqueRepository.ConsumoMateriaProjection::getQuantidadeConsumida));
  return materias.findAllByOrderByNomeAsc().stream().map(m->{
   BigDecimal media=consumos.getOrDefault(m.getId(),BigDecimal.ZERO).divide(BigDecimal.valueOf(janela),3,RoundingMode.HALF_UP);
   BigDecimal alvo=m.getEstoqueMinimo().add(media.multiply(BigDecimal.valueOf(prazo)));
   BigDecimal sugestao=alvo.subtract(m.getEstoqueAtual()).max(BigDecimal.ZERO).setScale(3,RoundingMode.CEILING);
   return new SugestaoReposicaoResponseDTO(m.getId(),m.getNome(),m.getUnidadeMedida(),m.getEstoqueAtual(),m.getEstoqueMinimo(),media,sugestao,"Cobertura do estoque mínimo mais "+prazo+" dias pelo consumo médio dos últimos "+janela+" dias");
  }).filter(s->s.quantidadeSugerida().compareTo(BigDecimal.ZERO)>0).toList();
 }
}
