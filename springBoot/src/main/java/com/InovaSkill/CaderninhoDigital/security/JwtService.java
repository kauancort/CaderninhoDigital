package com.InovaSkill.CaderninhoDigital.security;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class JwtService {
    public static final Duration DURACAO = Duration.ofHours(24);
    private final JwtEncoder jwtEncoder;

    public TokenGerado gerar(UsuarioPrincipal usuario) {
        Instant emitidoEm = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        Instant expiraEm = emitidoEm.plus(DURACAO);
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuedAt(emitidoEm)
                .expiresAt(expiraEm)
                .subject(usuario.id().toString())
                .claim("perfil", usuario.perfil())
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).type("JWT").build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        return new TokenGerado(token, expiraEm);
    }

    public record TokenGerado(String valor, Instant expiraEm) {}
}
