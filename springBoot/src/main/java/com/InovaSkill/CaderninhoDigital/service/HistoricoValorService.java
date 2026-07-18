package com.InovaSkill.CaderninhoDigital.service;
import com.InovaSkill.CaderninhoDigital.entity.*;
import com.InovaSkill.CaderninhoDigital.repository.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
@Service @RequiredArgsConstructor
public class HistoricoValorService {
 private final HistoricoPrecoProdutoRepository precos;
 private final HistoricoCustoMateriaPrimaRepository custos;
 public void registrarPreco(Produto produto, Usuario usuario, BigDecimal anterior, String motivo){
  if(anterior!=null&&anterior.compareTo(produto.getPrecoVenda())==0)return;
  var agora=LocalDateTime.now(); precos.findFirstByProdutoIdAndFimVigenciaIsNullOrderByInicioVigenciaDesc(produto.getId()).ifPresent(h->{h.setFimVigencia(agora);precos.save(h);});
  precos.save(HistoricoPrecoProduto.builder().produto(produto).usuario(usuario).preco(produto.getPrecoVenda()).inicioVigencia(agora).alteradoEm(agora).origem("CADASTRO_PRODUTO").motivo(motivo).build());
 }
 public void registrarCusto(MateriaPrima materia, Usuario usuario, BigDecimal anterior, String motivo){
  if(anterior!=null&&anterior.compareTo(materia.getCustoMedio())==0)return;
  var agora=LocalDateTime.now(); custos.findFirstByMateriaPrimaIdAndFimVigenciaIsNullOrderByInicioVigenciaDesc(materia.getId()).ifPresent(h->{h.setFimVigencia(agora);custos.save(h);});
  custos.save(HistoricoCustoMateriaPrima.builder().materiaPrima(materia).usuario(usuario).custo(materia.getCustoMedio()).inicioVigencia(agora).alteradoEm(agora).origem("CADASTRO_MATERIA_PRIMA").motivo(motivo).build());
 }
}
