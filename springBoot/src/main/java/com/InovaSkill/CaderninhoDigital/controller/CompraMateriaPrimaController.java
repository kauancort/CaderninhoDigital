package com.InovaSkill.CaderninhoDigital.controller;

import com.InovaSkill.CaderninhoDigital.dto.request.CompraMateriaPrimaRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.CompraMateriaPrimaResponseDTO;
import com.InovaSkill.CaderninhoDigital.service.CompraMateriaPrimaService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/compras-materias-primas")
@RequiredArgsConstructor
public class CompraMateriaPrimaController {

    private final CompraMateriaPrimaService compraService;

    @PostMapping
    public ResponseEntity<CompraMateriaPrimaResponseDTO> criar(@UsuarioIdAutenticado Long usuarioId, @RequestBody @Valid CompraMateriaPrimaRequestDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(compraService.criar(usuarioId, dto));
    }

    @GetMapping
    public ResponseEntity<List<CompraMateriaPrimaResponseDTO>> listar(@UsuarioIdAutenticado Long usuarioId) {
        return ResponseEntity.ok(compraService.listar(usuarioId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<CompraMateriaPrimaResponseDTO> buscar(@UsuarioIdAutenticado Long usuarioId, @PathVariable Long id) {
        return ResponseEntity.ok(compraService.buscar(usuarioId, id));
    }
}
