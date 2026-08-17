package com.InovaSkill.CaderninhoDigital.ai.orchestration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import com.InovaSkill.CaderninhoDigital.ai.contract.ArgumentosRentabilidadeProduto;
import com.InovaSkill.CaderninhoDigital.ai.contract.FerramentaPermitida;
import com.InovaSkill.CaderninhoDigital.entity.Produto;
import com.InovaSkill.CaderninhoDigital.enums.ModalidadeVenda;
import com.InovaSkill.CaderninhoDigital.repository.ProdutoRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;

class ClassificadorRentabilidadeProdutoTest {
    private final ProdutoRepository produtos = mock(ProdutoRepository.class);
    private final ClassificadorRentabilidadeProduto classificador = new ClassificadorRentabilidadeProduto(produtos,
            Clock.fixed(Instant.parse("2026-08-16T12:00:00Z"), ZoneOffset.UTC));

    @Test void variantesSemanticasUsamAMesmaReceitaSemIa() {
        when(produtos.listarAtivosParaEmpresa(11L)).thenReturn(List.of(
                Produto.builder().id(3L).nome("Paçoca").build()));
        for (String pergunta : List.of("Estou tendo prejuízo na paçoca?", "A paçoca dá dinheiro?",
                "Minha margem na paçoca está boa?", "R$ 4,20 está barato para vender a paçoca?",
                "A caixa de paçoca por R$ 30 compensa?",
                "Vender a caixa está compensando menos que vender separado a paçoca?")) {
            var chamada = classificador.classificar(pergunta, 11L);
            assertThat(chamada).as(pergunta).isNotNull();
            assertThat(chamada.ferramenta()).isEqualTo(FerramentaPermitida.ANALISAR_RENTABILIDADE_PRODUTO);
            assertThat(((ArgumentosRentabilidadeProduto) chamada.argumentos()).produtoId()).isEqualTo(3L);
        }
    }

    @Test void extraiModalidadeEPrecoSemConfundirComProduto() {
        when(produtos.listarAtivosParaEmpresa(11L)).thenReturn(List.of(
                Produto.builder().id(3L).nome("Paçoca").build()));
        var argumentos = (ArgumentosRentabilidadeProduto) classificador
                .classificar("A caixa de paçoca por R$ 30 compensa?", 11L).argumentos();
        assertThat(argumentos.modalidade()).isEqualTo(ModalidadeVenda.CAIXA);
        assertThat(argumentos.precoConsultado()).isEqualByComparingTo("30");
    }

    @Test void produtoNaoCadastradoNaoDisparaPesquisaInventada() {
        when(produtos.listarAtivosParaEmpresa(11L)).thenReturn(List.of());
        assertThat(classificador.classificar("Estou vendendo brigadeiro no prejuízo?", 11L)).isNull();
    }
}
