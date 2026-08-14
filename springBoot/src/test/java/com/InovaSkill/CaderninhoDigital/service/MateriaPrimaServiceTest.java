package com.InovaSkill.CaderninhoDigital.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.InovaSkill.CaderninhoDigital.dto.response.MateriaPrimaResponseDTO;
import com.InovaSkill.CaderninhoDigital.entity.MateriaPrima;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.repository.MateriaPrimaRepository;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class MateriaPrimaServiceTest {

    @Mock private MateriaPrimaRepository materiaPrimaRepository;
    @Mock private UsuarioAcessoService usuarioAcessoService;
    @Mock private MovimentacaoEstoqueService movimentacaoEstoqueService;
    @Mock private HistoricoValorService historicoValorService;
    @Mock private AuditoriaService auditoriaService;

    @InjectMocks private MateriaPrimaService materiaPrimaService;

    @Test
    void inativaSemExcluirEPreservaConsultaHistorica() {
        Usuario gestor = Usuario.builder().id(1L).nome("Gestora").build();
        MateriaPrima materiaPrima = MateriaPrima.builder()
                .id(10L)
                .nome("Amendoim")
                .unidadeMedida("kg")
                .estoqueAtual(new BigDecimal("30.000"))
                .estoqueMinimo(new BigDecimal("5.000"))
                .custoMedio(new BigDecimal("12.50"))
                .ativo(true)
                .gestor(gestor)
                .build();

        when(usuarioAcessoService.buscarGestor(1L)).thenReturn(gestor);
        when(materiaPrimaRepository.findById(10L)).thenReturn(Optional.of(materiaPrima));
        when(materiaPrimaRepository.save(materiaPrima)).thenReturn(materiaPrima);

        materiaPrimaService.deletar(1L, 10L, "Não será mais utilizada");
        MateriaPrimaResponseDTO historico = materiaPrimaService.buscar(1L, 10L);

        assertThat(materiaPrima.getAtivo()).isFalse();
        assertThat(materiaPrima.getEstoqueAtual()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(historico.getNome()).isEqualTo("Amendoim");
        assertThat(historico.getAtivo()).isFalse();
        verify(materiaPrimaRepository, never()).delete(materiaPrima);
        verify(movimentacaoEstoqueService).registrarRemocaoMateriaPrima(
                materiaPrima, gestor, new BigDecimal("30.000"), "Não será mais utilizada");
    }

    @Test
    void leCorretamenteLinhaAgregadaDoResumoDeEstoque() {
        Usuario gestor = Usuario.builder().id(1L).build();
        when(usuarioAcessoService.buscarGestor(1L)).thenReturn(gestor);
        when(materiaPrimaRepository.resumirEstoque("%amendoim%", true)).thenReturn(
                List.<Object[]>of(new Object[] {2L, 1L, new BigDecimal("125.50")}));

        var resumo = materiaPrimaService.resumirEstoque(1L, " Amendoim ", true);

        assertThat(resumo.totalItens()).isEqualTo(2L);
        assertThat(resumo.itensEmAlerta()).isEqualTo(1L);
        assertThat(resumo.valorEstoque()).isEqualByComparingTo("125.50");
    }
}
