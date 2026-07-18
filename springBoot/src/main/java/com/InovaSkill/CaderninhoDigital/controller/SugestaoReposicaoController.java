package com.InovaSkill.CaderninhoDigital.controller;
import com.InovaSkill.CaderninhoDigital.dto.response.SugestaoReposicaoResponseDTO;
import com.InovaSkill.CaderninhoDigital.service.SugestaoReposicaoService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/v1/estoque/sugestoes-reposicao") @RequiredArgsConstructor
public class SugestaoReposicaoController {
 private final SugestaoReposicaoService service;
 @GetMapping public List<SugestaoReposicaoResponseDTO> listar(@RequestHeader("X-Usuario-Id")Long usuarioId,@RequestParam(defaultValue="90")int dias,@RequestParam(defaultValue="14")int prazoReposicaoDias){return service.listar(usuarioId,dias,prazoReposicaoDias);}
}
