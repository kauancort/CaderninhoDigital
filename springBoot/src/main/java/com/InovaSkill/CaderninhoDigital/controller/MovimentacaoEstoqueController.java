package com.InovaSkill.CaderninhoDigital.controller;

import com.InovaSkill.CaderninhoDigital.dto.response.MovimentacaoEstoqueResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.MovimentacaoUsuarioFiltroResponseDTO;
import com.InovaSkill.CaderninhoDigital.enums.TipoItemEstoque;
import com.InovaSkill.CaderninhoDigital.enums.TipoMovimentacaoEstoque;
import com.InovaSkill.CaderninhoDigital.service.MovimentacaoEstoqueService;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/estoque/movimentacoes")
@RequiredArgsConstructor
public class MovimentacaoEstoqueController {

    private final MovimentacaoEstoqueService service;

    @GetMapping("/usuarios")
    public ResponseEntity<List<MovimentacaoUsuarioFiltroResponseDTO>> listarUsuarios(
            @RequestHeader("X-Usuario-Id") Long usuarioSolicitanteId
    ) {
        return ResponseEntity.ok(service.listarUsuarios(usuarioSolicitanteId));
    }

    @GetMapping
    public ResponseEntity<Page<MovimentacaoEstoqueResponseDTO>> listar(
            @RequestHeader("X-Usuario-Id") Long usuarioSolicitanteId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate inicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fim,
            @RequestParam(required = false) Long usuarioId,
            @RequestParam(required = false) TipoMovimentacaoEstoque tipo,
            @RequestParam(required = false) TipoItemEstoque tipoItem,
            @RequestParam(required = false) Long itemId,
            @RequestParam(defaultValue = "0") int pagina,
            @RequestParam(defaultValue = "20") int tamanho,
            @RequestParam(defaultValue = "DESC") Sort.Direction ordem
    ) {
        return ResponseEntity.ok(service.listar(
                usuarioSolicitanteId, inicio, fim, usuarioId, tipo, tipoItem, itemId, pagina, tamanho, ordem));
    }
}
