package com.InovaSkill.CaderninhoDigital.controller;

import com.InovaSkill.CaderninhoDigital.dto.request.CriarUsuarioRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.CriarUsuarioResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.UsuarioResponseDTO;
import com.InovaSkill.CaderninhoDigital.service.UsuarioService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/usuarios")
@RequiredArgsConstructor
public class UsuarioController {
    private final UsuarioService usuarioService;

    @GetMapping
    public List<UsuarioResponseDTO> listar() { return usuarioService.listar(); }

    @PostMapping
    public ResponseEntity<CriarUsuarioResponseDTO> criar(@Valid @RequestBody CriarUsuarioRequestDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(usuarioService.criar(dto));
    }
}
