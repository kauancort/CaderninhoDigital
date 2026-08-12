package com.InovaSkill.CaderninhoDigital.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.ZoneId;
import org.junit.jupiter.api.Test;

class TimeConfigTest {
    @Test
    void criaRelogioNoFusoConfigurado() {
        assertThat(new TimeConfig().applicationClock("America/Sao_Paulo").getZone())
                .isEqualTo(ZoneId.of("America/Sao_Paulo"));
    }
}
