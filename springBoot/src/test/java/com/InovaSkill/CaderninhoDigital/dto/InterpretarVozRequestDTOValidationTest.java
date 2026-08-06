package com.InovaSkill.CaderninhoDigital.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.InovaSkill.CaderninhoDigital.dto.request.InterpretarVozRequestDTO;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

class InterpretarVozRequestDTOValidationTest {

    @Test
    void exigeTranscricaoNaoVazia() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            InterpretarVozRequestDTO request = new InterpretarVozRequestDTO();
            request.setTexto("   ");

            assertThat(validator.validate(request))
                    .extracting(violation -> violation.getPropertyPath().toString())
                    .containsExactly("texto");
        }
    }

    @Test
    void aceitaTranscricaoPreenchida() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            InterpretarVozRequestDTO request = new InterpretarVozRequestDTO();
            request.setTexto("Vendi duas caixas de paçoca");

            assertThat(validator.validate(request)).isEmpty();
        }
    }
}
