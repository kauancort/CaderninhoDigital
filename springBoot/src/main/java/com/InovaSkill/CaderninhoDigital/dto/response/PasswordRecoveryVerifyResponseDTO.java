package com.InovaSkill.CaderninhoDigital.dto.response;

import java.time.LocalDateTime;

public record PasswordRecoveryVerifyResponseDTO(
        String recoveryToken,
        LocalDateTime expiresAt
) {
}
