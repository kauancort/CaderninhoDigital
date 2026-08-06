package com.InovaSkill.CaderninhoDigital.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.InovaSkill.CaderninhoDigital.entity.CompraMateriaPrima;
import com.InovaSkill.CaderninhoDigital.entity.Lancamento;
import com.InovaSkill.CaderninhoDigital.entity.MateriaPrima;
import com.InovaSkill.CaderninhoDigital.entity.Producao;
import com.InovaSkill.CaderninhoDigital.entity.Produto;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.entity.Venda;
import com.InovaSkill.CaderninhoDigital.repository.CompraMateriaPrimaRepository;
import com.InovaSkill.CaderninhoDigital.repository.LancamentoRepository;
import com.InovaSkill.CaderninhoDigital.repository.MateriaPrimaRepository;
import com.InovaSkill.CaderninhoDigital.repository.ProducaoRepository;
import com.InovaSkill.CaderninhoDigital.repository.ProdutoRepository;
import com.InovaSkill.CaderninhoDigital.repository.UsuarioRepository;
import com.InovaSkill.CaderninhoDigital.repository.VendaRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class OpenRouterServicePrivacyTest {

    @Test
    void contextoDoChatUsaSomenteDadosAgregadosSemIdentificarPessoas() {
        MateriaPrimaRepository materias = mock(MateriaPrimaRepository.class);
        ProdutoRepository produtos = mock(ProdutoRepository.class);
        VendaRepository vendas = mock(VendaRepository.class);
        CompraMateriaPrimaRepository compras = mock(CompraMateriaPrimaRepository.class);
        ProducaoRepository producoes = mock(ProducaoRepository.class);
        LancamentoRepository lancamentos = mock(LancamentoRepository.class);
        UsuarioRepository usuarios = mock(UsuarioRepository.class);
        Usuario gestor = mock(Usuario.class);

        MateriaPrima materia = mock(MateriaPrima.class);
        when(materia.getEstoqueAtual()).thenReturn(BigDecimal.ONE);
        when(materia.getEstoqueMinimo()).thenReturn(BigDecimal.TEN);
        Venda venda = mock(Venda.class);
        when(venda.getValorTotal()).thenReturn(new BigDecimal("100.00"));
        CompraMateriaPrima compra = mock(CompraMateriaPrima.class);
        when(compra.getValorTotal()).thenReturn(new BigDecimal("40.00"));
        Producao producao = mock(Producao.class);
        when(producao.getQuantidadeProduzida()).thenReturn(new BigDecimal("12"));
        Lancamento lancamento = mock(Lancamento.class);
        when(lancamento.getValorTotal()).thenReturn(new BigDecimal("20.00"));

        when(materias.findByGestorOrderByNomeAsc(gestor)).thenReturn(List.of(materia));
        when(produtos.findByGestorOrderByNomeAsc(gestor)).thenReturn(List.of(mock(Produto.class)));
        when(vendas.findByGestorOrderByDataVendaDesc(gestor)).thenReturn(List.of(venda));
        when(compras.findByGestorOrderByDataCompraDesc(gestor)).thenReturn(List.of(compra));
        when(producoes.findByGestorOrderByDataProducaoDesc(gestor)).thenReturn(List.of(producao));
        when(lancamentos.findByGestorOrderByDataLancamentoDesc(gestor)).thenReturn(List.of(lancamento));
        when(gestor.getNome()).thenReturn("Pessoa Sensível");
        when(gestor.getEmail()).thenReturn("pessoa@example.invalid");

        OpenRouterService service = new OpenRouterService(
                new ObjectMapper(), materias, produtos, vendas, compras, producoes, lancamentos, usuarios);

        String contexto = (String) ReflectionTestUtils.invokeMethod(
                service, "construirDadosSistemaContexto", gestor);

        assertThat(contexto)
                .contains("RESUMO OPERACIONAL SEM DADOS PESSOAIS")
                .contains("Vendas registradas: 1")
                .doesNotContain("Pessoa Sensível", "pessoa@example.invalid", "Cliente:", "Fornecedor:");
    }
}
