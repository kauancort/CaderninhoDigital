package com.InovaSkill.CaderninhoDigital.security;

import static org.assertj.core.api.Assertions.assertThat;

import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.OctetSequenceKey;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

class JwtServiceTest {
    private final SecretKey key = new SecretKeySpec(
            "test-only-jwt-secret-with-at-least-32-bytes".getBytes(StandardCharsets.UTF_8), "HmacSHA256");

    @Test
    void geraTokenAssinadoComValidadeExataDe24Horas() {
        OctetSequenceKey jwk = new OctetSequenceKey.Builder(key).build();
        JWKSource<SecurityContext> source = (selector, context) -> selector.select(new JWKSet(jwk));
        JwtService service = new JwtService(new NimbusJwtEncoder(source));
        UsuarioPrincipal principal = new UsuarioPrincipal(
                7L, "Gestora", "gestora@test.local", "hash", "Gestora", "GESTOR", false);

        JwtService.TokenGerado token = service.gerar(principal);
        var jwt = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build().decode(token.valor());

        assertThat(jwt.getSubject()).isEqualTo("7");
        assertThat(jwt.getClaimAsString("perfil")).isEqualTo("GESTOR");
        assertThat(Duration.between(jwt.getIssuedAt(), jwt.getExpiresAt())).isEqualTo(Duration.ofHours(24));
        assertThat(token.expiraEm()).isEqualTo(jwt.getExpiresAt());
    }
}
