package com.InovaSkill.CaderninhoDigital.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.InovaSkill.CaderninhoDigital.dto.request.ClienteRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.CriarUsuarioRequestDTO;
import com.InovaSkill.CaderninhoDigital.entity.TipoCliente;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class ClienteRequestDTOValidationTest {
    private static Validator validator;

    @BeforeAll
    static void configurarValidator() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @Test
    void clienteAceitaEmailAusenteMasRejeitaEmailInvalido() {
        ClienteRequestDTO dto = clienteValido();
        dto.setEmail(null);
        assertThat(validator.validate(dto)).isEmpty();

        dto.setEmail("email-invalido");
        assertThat(validator.validate(dto)).anyMatch(v -> v.getPropertyPath().toString().equals("email"));
    }

    @Test
    void exigeNomeDoCliente() {
        ClienteRequestDTO dto = clienteValido();
        dto.setNome("");

        assertThat(validator.validate(dto)).extracting(v -> v.getPropertyPath().toString())
                .contains("nome");
    }

    @Test
    void transportadoraAceitaSomenteNome() {
        ClienteRequestDTO dto = new ClienteRequestDTO();
        dto.setNome("Jadlog");
        dto.setTipo(TipoCliente.TRANSPORTADORA);

        assertThat(validator.validate(dto)).isEmpty();
    }

    @Test
    void cadastroDeUsuarioContinuaExigindoEmail() {
        CriarUsuarioRequestDTO usuario = new CriarUsuarioRequestDTO();
        usuario.setNome("Gestora");
        usuario.setEmail("");
        assertThat(validator.validate(usuario)).anyMatch(v -> v.getPropertyPath().toString().equals("email"));
    }

    private ClienteRequestDTO clienteValido() {
        ClienteRequestDTO dto = new ClienteRequestDTO();
        dto.setNome("Maria");
        dto.setTelefone("(11) 99999-9999");
        dto.setDocumento("529.982.247-25");
        dto.setEndereco("Rua A");
        dto.setNumero("10");
        dto.setBairro("Centro");
        dto.setCidade("São Paulo");
        dto.setEstado("SP");
        return dto;
    }
}
