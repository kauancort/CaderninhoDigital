package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.request.PasswordRecoveryRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.PasswordRecoveryResetRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.PasswordRecoveryVerifyRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.MessageResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.PasswordRecoveryVerifyResponseDTO;
import com.InovaSkill.CaderninhoDigital.entity.PasswordRecovery;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.exception.BusinessException;
import com.InovaSkill.CaderninhoDigital.repository.PasswordRecoveryRepository;
import com.InovaSkill.CaderninhoDigital.repository.UsuarioRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class PasswordRecoveryService {
    static final Duration CODE_VALIDITY = Duration.ofMinutes(10);
    static final Duration TOKEN_VALIDITY = Duration.ofMinutes(10);
    static final Duration REQUEST_COOLDOWN = Duration.ofSeconds(60);
    static final Duration RETENTION = Duration.ofDays(30);
    static final int MAX_ATTEMPTS = 5;

    private static final String GENERIC_REQUEST_MESSAGE =
            "Se o e-mail estiver cadastrado, enviaremos um código de recuperação.";
    private static final String INVALID_CODE_MESSAGE = "Código inválido ou expirado.";
    private static final String INVALID_TOKEN_MESSAGE = "Autorização de recuperação inválida ou expirada.";

    private final UsuarioRepository usuarioRepository;
    private final PasswordRecoveryRepository recoveryRepository;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;
    private final SecureRandom secureRandom = new SecureRandom();

    @Transactional
    public MessageResponseDTO solicitar(PasswordRecoveryRequestDTO dto) {
        LocalDateTime agora = agora();
        recoveryRepository.excluirAntigos(agora.minus(RETENTION));
        String email = normalizarEmail(dto.getEmail());
        usuarioRepository.findByEmailForUpdate(email).ifPresent(usuario -> solicitarParaUsuario(usuario, agora));
        return new MessageResponseDTO(GENERIC_REQUEST_MESSAGE);
    }

    @Transactional(noRollbackFor = BusinessException.class)
    public PasswordRecoveryVerifyResponseDTO verificar(PasswordRecoveryVerifyRequestDTO dto) {
        LocalDateTime agora = agora();
        Usuario usuario = usuarioRepository.findByEmailForUpdate(normalizarEmail(dto.getEmail()))
                .orElseThrow(() -> new BusinessException(INVALID_CODE_MESSAGE));
        PasswordRecovery recovery = recoveryRepository
                .findFirstByUsuarioAndUsadoEmIsNullOrderByCriadoEmDesc(usuario)
                .orElseThrow(() -> new BusinessException(INVALID_CODE_MESSAGE));

        if (recovery.getVerificadoEm() != null
                || !recovery.getExpiraEm().isAfter(agora)
                || recovery.getTentativas() >= MAX_ATTEMPTS) {
            invalidar(recovery, agora);
            throw new BusinessException(INVALID_CODE_MESSAGE);
        }

        if (!passwordEncoder.matches(dto.getCode(), recovery.getCodeHash())) {
            recovery.setTentativas(recovery.getTentativas() + 1);
            if (recovery.getTentativas() >= MAX_ATTEMPTS) {
                recovery.setUsadoEm(agora);
            }
            recoveryRepository.save(recovery);
            throw new BusinessException(INVALID_CODE_MESSAGE);
        }

        String token = gerarToken();
        LocalDateTime tokenExpiraEm = agora.plus(TOKEN_VALIDITY);
        recovery.setVerificadoEm(agora);
        recovery.setRecoveryTokenHash(hashToken(token));
        recovery.setRecoveryTokenExpiraEm(tokenExpiraEm);
        recoveryRepository.save(recovery);
        return new PasswordRecoveryVerifyResponseDTO(token, tokenExpiraEm);
    }

    @Transactional(noRollbackFor = BusinessException.class)
    public MessageResponseDTO redefinir(PasswordRecoveryResetRequestDTO dto) {
        if (!dto.getNewPassword().equals(dto.getConfirmPassword())) {
            throw new BusinessException("A confirmação da senha não coincide.");
        }
        if (dto.getNewPassword().length() < 6
                || dto.getNewPassword().length() > 72
                || !dto.getNewPassword().matches(".*[A-Za-z].*")
                || !dto.getNewPassword().matches(".*\\d.*")) {
            throw new BusinessException(
                    "A nova senha deve ter entre 6 e 72 caracteres, com ao menos uma letra e um número.");
        }

        LocalDateTime agora = agora();
        PasswordRecovery recovery = recoveryRepository
                .findByRecoveryTokenHashAndUsadoEmIsNull(hashToken(dto.getRecoveryToken()))
                .orElseThrow(() -> new BusinessException(INVALID_TOKEN_MESSAGE));

        if (recovery.getVerificadoEm() == null
                || recovery.getRecoveryTokenExpiraEm() == null
                || !recovery.getRecoveryTokenExpiraEm().isAfter(agora)) {
            invalidar(recovery, agora);
            throw new BusinessException(INVALID_TOKEN_MESSAGE);
        }

        Usuario usuario = recovery.getUsuario();
        usuario.setSenha(passwordEncoder.encode(dto.getNewPassword()));
        usuario.setTrocaSenhaObrigatoria(false);
        usuarioRepository.save(usuario);

        recoveryRepository.invalidarPendentes(usuario, agora);
        recovery.setUsadoEm(agora);
        recoveryRepository.save(recovery);
        return new MessageResponseDTO("Senha redefinida com sucesso.");
    }

    private void solicitarParaUsuario(Usuario usuario, LocalDateTime agora) {
        boolean emCooldown = recoveryRepository.findFirstByUsuarioOrderByCriadoEmDesc(usuario)
                .map(ultima -> ultima.getCriadoEm().plus(REQUEST_COOLDOWN).isAfter(agora))
                .orElse(false);
        if (emCooldown) {
            return;
        }

        recoveryRepository.invalidarPendentes(usuario, agora);
        String codigo = "%06d".formatted(secureRandom.nextInt(1_000_000));
        PasswordRecovery recovery = recoveryRepository.save(PasswordRecovery.builder()
                .usuario(usuario)
                .codeHash(passwordEncoder.encode(codigo))
                .criadoEm(agora)
                .expiraEm(agora.plus(CODE_VALIDITY))
                .tentativas(0)
                .build());
        try {
            emailService.enviarCodigoRecuperacao(usuario.getEmail(), usuario.getNome(), codigo);
        } catch (EmailDeliveryException exception) {
            invalidar(recovery, agora);
            log.error(
                    "Falha ao enviar e-mail de recuperação para o usuário id={} tipo={}",
                    usuario.getId(),
                    exception.getClass().getSimpleName());
        }
    }

    private void invalidar(PasswordRecovery recovery, LocalDateTime agora) {
        if (recovery.getUsadoEm() == null) {
            recovery.setUsadoEm(agora);
            recoveryRepository.save(recovery);
        }
    }

    private LocalDateTime agora() {
        return LocalDateTime.now(clock);
    }

    private String gerarToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hashToken(String token) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 indisponível", exception);
        }
    }

    private String normalizarEmail(String email) {
        return email.trim().toLowerCase();
    }
}
