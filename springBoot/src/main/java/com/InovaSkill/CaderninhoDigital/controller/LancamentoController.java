package com.InovaSkill.CaderninhoDigital.controller;

import com.InovaSkill.CaderninhoDigital.dto.request.LancamentoRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.LancamentoResponseDTO;
import com.InovaSkill.CaderninhoDigital.enums.TipoLancamento;
import com.InovaSkill.CaderninhoDigital.service.LancamentoService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/lancamentos")
@RequiredArgsConstructor
public class LancamentoController {

    private final LancamentoService lancamentoService;

    @PostMapping
    public ResponseEntity<LancamentoResponseDTO> criar(
            @UsuarioIdAutenticado Long usuarioId,
            @RequestBody @Valid LancamentoRequestDTO dto
    ) {
        LancamentoResponseDTO response = lancamentoService.criar(usuarioId, dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<LancamentoResponseDTO>> listar(
            @UsuarioIdAutenticado Long usuarioId,
            @RequestParam(required = false) TipoLancamento tipo,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate inicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fim
    ) {
        List<LancamentoResponseDTO> response = lancamentoService.listar(usuarioId, tipo, inicio, fim);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<LancamentoResponseDTO> buscarPorId(
            @UsuarioIdAutenticado Long usuarioId,
            @PathVariable Long id
    ) {
        LancamentoResponseDTO response = lancamentoService.buscarPorId(usuarioId, id);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}")
    public ResponseEntity<LancamentoResponseDTO> atualizar(
            @UsuarioIdAutenticado Long usuarioId,
            @PathVariable Long id,
            @RequestBody @Valid LancamentoRequestDTO dto
    ) {
        LancamentoResponseDTO response = lancamentoService.atualizar(usuarioId, id, dto);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletar(
            @UsuarioIdAutenticado Long usuarioId,
            @PathVariable Long id
    ) {
        lancamentoService.deletar(usuarioId, id);
        return ResponseEntity.noContent().build();
    }
}
