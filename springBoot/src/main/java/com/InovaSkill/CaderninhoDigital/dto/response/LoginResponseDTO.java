package com.InovaSkill.CaderninhoDigital.dto.response;

import java.time.Instant;

public record LoginResponseDTO(
        String token,
        String tokenType,
        long expiresIn,
        Instant expiresAt,
        UsuarioResponseDTO user,
        boolean requiresPasswordChange,
        String email
) {
    public static LoginResponseDTO trocaObrigatoria(String email) {
        return new LoginResponseDTO(null, null, 0, null, null, true, email);
    }
}
