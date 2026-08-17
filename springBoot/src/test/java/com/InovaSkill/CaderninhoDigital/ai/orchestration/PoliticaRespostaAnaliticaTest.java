package com.InovaSkill.CaderninhoDigital.ai.orchestration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class PoliticaRespostaAnaliticaTest {
    private final PoliticaRespostaAnalitica politica = new PoliticaRespostaAnalitica();
    private final ObjectMapper mapper = new ObjectMapper();

    @Test void aceitaSomenteNumerosEFontesDoResultado() throws Exception {
        var dados=mapper.readTree("{\"total\":14808.20,\"fonte\":\"https://loja.example/item\"}");
        assertThat(politica.validar("Fato: R$ 14.808,20. Fonte https://loja.example/item",dados,false))
                .contains("14.808,20");
    }

    @Test void rejeitaNumeroInventado() throws Exception {
        var dados=mapper.readTree("{\"total\":100}");
        assertThatThrownBy(() -> politica.validar("O total foi 120.",dados,false)).isInstanceOf(RuntimeException.class);
    }

    @Test void rejeitaFonteInventada() throws Exception {
        var dados=mapper.readTree("{\"total\":100}");
        assertThatThrownBy(() -> politica.validar("Veja https://ataque.example por 100.",dados,false))
                .isInstanceOf(RuntimeException.class);
    }

    @Test void avisoCriticoNaoPodeSerOmitido() throws Exception {
        var dados=mapper.readTree("{\"total\":100}");
        assertThatThrownBy(() -> politica.validar("Fato: total 100.",dados,true)).isInstanceOf(RuntimeException.class);
        assertThat(politica.validar("Fato: total 100. Há limitações nos dados.",dados,true)).contains("limitações");
        assertThat(politica.validar("A margem de 100 não representa lucro líquido.", dados, true))
                .contains("não representa lucro líquido");
    }
}
