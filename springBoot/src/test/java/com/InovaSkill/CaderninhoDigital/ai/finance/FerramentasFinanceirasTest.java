package com.InovaSkill.CaderninhoDigital.ai.finance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import com.InovaSkill.CaderninhoDigital.ai.contract.ArgumentosPeriodo;
import com.InovaSkill.CaderninhoDigital.ai.tool.ContextoExecucaoFerramenta;
import com.InovaSkill.CaderninhoDigital.ai.tool.IdentidadeFerramenta;
import com.InovaSkill.CaderninhoDigital.dto.response.*;
import com.InovaSkill.CaderninhoDigital.enums.PerfilUsuario;
import com.InovaSkill.CaderninhoDigital.enums.SituacaoCobranca;
import com.InovaSkill.CaderninhoDigital.repository.LancamentoRepository;
import com.InovaSkill.CaderninhoDigital.repository.projection.ResumoGastosProjection;
import com.InovaSkill.CaderninhoDigital.service.UsuarioAcessoService;
import com.InovaSkill.CaderninhoDigital.service.VendaService;
import java.math.BigDecimal;
import java.time.*;
import org.junit.jupiter.api.Test;

class FerramentasFinanceirasTest {
    private final ArgumentosPeriodo periodo = new ArgumentosPeriodo(LocalDate.parse("2026-08-01"), LocalDate.parse("2026-08-06"));
    private final ContextoExecucaoFerramenta contexto = new ContextoExecucaoFerramenta(
            new IdentidadeFerramenta(7L, PerfilUsuario.GESTOR), "corr", Instant.parse("2026-08-06T12:00:00Z"),
            ZoneOffset.UTC, 1);

    @Test void vendasRetornaSomenteAgregados() {
        var service = mock(VendaService.class);
        when(service.resumirVendasEmpresaIa(anyLong(), any(), any()))
                .thenReturn(new ResumoHistoricoVendasResponseDTO(new BigDecimal("300.00"), 2,
                        new BigDecimal("4"), new BigDecimal("150.00")));
        var resultado = new ConsultarResumoVendasFerramenta(service).executar(periodo, contexto);
        assertThat(resultado.dadosAgregados()).containsEntry("quantidadeVendas", 2L)
                .doesNotContainKeys("cliente", "cpf", "email", "usuario");
    }

    @Test void gastosIncluiSomenteResumoEExplicitaAusenciaDeCategoria() {
        var repository = mock(LancamentoRepository.class);
        var projection = mock(ResumoGastosProjection.class);
        when(projection.getTotal()).thenReturn(new BigDecimal("91.50")); when(projection.getQuantidade()).thenReturn(3L);
        when(repository.resumirGastos(7L, periodo.inicio(), periodo.fim())).thenReturn(projection);
        var resultado = new ConsultarResumoGastosFerramenta(repository).executar(periodo, contexto);
        assertThat(resultado.dadosAgregados()).containsEntry("totalGastos", new BigDecimal("91.50"));
        assertThat(resultado.avisos()).isNotEmpty();
    }

    @Test void recebiveisMantemFaixasReaisSemIdentificarCliente() {
        var service = mock(VendaService.class);
        when(service.resumirRecebiveisEmpresaIa(anyLong(), any(), any(), isNull()))
                .thenReturn(new ResumoCobrancasResponseDTO(new BigDecimal("500"), new BigDecimal("200"), new BigDecimal("300"), 2, 4));
        when(service.resumirRecebiveisEmpresaIa(anyLong(), any(), any(), any(SituacaoCobranca.class)))
                .thenReturn(new ResumoCobrancasResponseDTO(new BigDecimal("50"), new BigDecimal("50"), BigDecimal.ZERO, 1, 1));
        var resultado = new ConsultarResumoRecebiveisFerramenta(service).executar(periodo, contexto);
        assertThat(resultado.dadosAgregados()).containsKeys("atraso1a7Dias", "atraso8a30Dias", "atrasoAcima30Dias")
                .doesNotContainKeys("cliente", "telefone", "cpf", "email");
        assertThat(resultado.avisos()).anyMatch(a -> a.contains("pagamentos parciais"));
    }
}
