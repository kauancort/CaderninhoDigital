package com.InovaSkill.CaderninhoDigital.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.InovaSkill.CaderninhoDigital.entity.MovimentacaoEstoque;
import com.InovaSkill.CaderninhoDigital.entity.Produto;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.enums.OrigemMovimentacaoEstoque;
import com.InovaSkill.CaderninhoDigital.enums.TipoMovimentacaoEstoque;
import com.InovaSkill.CaderninhoDigital.repository.MovimentacaoEstoqueRepository;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class MovimentacaoEstoqueServiceTest {

    @Mock private MovimentacaoEstoqueRepository repository;
    @Mock private UsuarioAcessoService usuarioAcessoService;

    @InjectMocks private MovimentacaoEstoqueService service;

    @Test
    void gravaOrigemConfiavelESnapshotDoItem() {
        Usuario gestor = Usuario.builder().id(1L).nome("Gestora").build();
        Produto produto = Produto.builder()
                .id(5L)
                .nome("Paçoca")
                .unidadeMedida("UN")
                .build();
        when(repository.save(any(MovimentacaoEstoque.class)))
                .thenAnswer(invocacao -> invocacao.getArgument(0));

        service.registrarProduto(
                produto,
                gestor,
                new BigDecimal("20.000"),
                new BigDecimal("10.000"),
                TipoMovimentacaoEstoque.SAIDA,
                OrigemMovimentacaoEstoque.VENDA,
                183L,
                "Venda balcão");

        ArgumentCaptor<MovimentacaoEstoque> captor = ArgumentCaptor.forClass(MovimentacaoEstoque.class);
        verify(repository).save(captor.capture());
        MovimentacaoEstoque movimento = captor.getValue();
        assertThat(movimento.getOrigemId()).isEqualTo(183L);
        assertThat(movimento.getItemNome()).isEqualTo("Paçoca");
        assertThat(movimento.getUnidadeMedida()).isEqualTo("UN");
        assertThat(movimento.getQuantidade()).isEqualByComparingTo("10.000");
        assertThat(movimento.getSaldoAnterior()).isEqualByComparingTo("20.000");
        assertThat(movimento.getSaldoPosterior()).isEqualByComparingTo("10.000");
    }
}
