package com.InovaSkill.CaderninhoDigital.controller;

import com.InovaSkill.CaderninhoDigital.dto.request.CategoriaProdutoRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.CategoriaProdutoResponseDTO;
import com.InovaSkill.CaderninhoDigital.service.CategoriaProdutoService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/categorias-produto") @RequiredArgsConstructor
public class CategoriaProdutoController {
    private final CategoriaProdutoService service;
    @GetMapping public List<CategoriaProdutoResponseDTO> listar(@RequestHeader("X-Usuario-Id") Long usuarioId) { return service.listar(usuarioId); }
    @PostMapping public ResponseEntity<CategoriaProdutoResponseDTO> criar(@RequestHeader("X-Usuario-Id") Long usuarioId, @Valid @RequestBody CategoriaProdutoRequestDTO dto) { return ResponseEntity.status(HttpStatus.CREATED).body(service.criar(usuarioId, dto)); }
    @PutMapping("/{id}") public CategoriaProdutoResponseDTO atualizar(@RequestHeader("X-Usuario-Id") Long usuarioId, @PathVariable Long id, @Valid @RequestBody CategoriaProdutoRequestDTO dto) { return service.atualizar(usuarioId, id, dto); }
}
