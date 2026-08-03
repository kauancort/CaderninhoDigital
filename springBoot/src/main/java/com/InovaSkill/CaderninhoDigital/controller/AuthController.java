package com.InovaSkill.CaderninhoDigital.controller;

import com.InovaSkill.CaderninhoDigital.dto.request.LoginRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.PrimeiroAcessoRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.PasswordRecoveryRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.PasswordRecoveryResetRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.PasswordRecoveryVerifyRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.BootstrapStatusResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.LoginResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.MessageResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.PasswordRecoveryVerifyResponseDTO;
import com.InovaSkill.CaderninhoDigital.service.AuthService;
import com.InovaSkill.CaderninhoDigital.service.PasswordRecoveryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
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
    private final PasswordRecoveryService passwordRecoveryService;

    @GetMapping("/session")
    public ResponseEntity<Void> validarSessao() {
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

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

    @PostMapping("/password-recovery/request")
    public ResponseEntity<MessageResponseDTO> solicitarRecuperacao(
            @RequestBody @Valid PasswordRecoveryRequestDTO dto
    ) {
        return ResponseEntity.ok(passwordRecoveryService.solicitar(dto));
    }

    @PostMapping("/password-recovery/verify")
    public ResponseEntity<PasswordRecoveryVerifyResponseDTO> verificarCodigo(
            @RequestBody @Valid PasswordRecoveryVerifyRequestDTO dto
    ) {
        return ResponseEntity.ok(passwordRecoveryService.verificar(dto));
    }

    @PostMapping("/password-recovery/reset")
    public ResponseEntity<MessageResponseDTO> redefinirSenha(
            @RequestBody @Valid PasswordRecoveryResetRequestDTO dto
    ) {
        return ResponseEntity.ok(passwordRecoveryService.redefinir(dto));
    }
}
