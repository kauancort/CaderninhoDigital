package com.InovaSkill.CaderninhoDigital.controller;

import com.InovaSkill.CaderninhoDigital.dto.request.LoginRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.PrimeiroAcessoRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.BootstrapStatusResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.LoginResponseDTO;
import com.InovaSkill.CaderninhoDigital.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<LoginResponseDTO> login(@RequestBody @Valid LoginRequestDTO dto) {
        return ResponseEntity.ok(authService.login(dto));
    }

    @PostMapping("/primeiro-acesso")
    public ResponseEntity<LoginResponseDTO> primeiroAcesso(@RequestBody @Valid PrimeiroAcessoRequestDTO dto) {
        return ResponseEntity.ok(authService.primeiroAcesso(dto));
    }

    @GetMapping("/bootstrap-status")
    public ResponseEntity<BootstrapStatusResponseDTO> bootstrapStatus() {
        return ResponseEntity.ok(authService.bootstrapStatus());
    }
}
