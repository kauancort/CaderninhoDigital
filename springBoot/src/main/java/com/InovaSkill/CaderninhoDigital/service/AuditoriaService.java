package com.InovaSkill.CaderninhoDigital.service;
import com.InovaSkill.CaderninhoDigital.entity.*;
import com.InovaSkill.CaderninhoDigital.repository.AuditoriaOperacaoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
@Service @RequiredArgsConstructor
public class AuditoriaService {
 private final AuditoriaOperacaoRepository repository;
 public void registrar(Usuario usuario,String entidade,Long id,String operacao,Object anterior,Object novo,String motivo,String origem){
  repository.save(AuditoriaOperacao.builder().usuario(usuario).entidade(entidade).registroId(id).operacao(operacao)
   .valorAnterior(anterior==null?null:String.valueOf(anterior)).valorNovo(novo==null?null:String.valueOf(novo)).motivo(motivo).origem(origem).build());
 }
}
