package com.InovaSkill.CaderninhoDigital.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.InovaSkill.CaderninhoDigital.dto.request.ProdutoRequestDTO;
import com.InovaSkill.CaderninhoDigital.entity.Produto;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.repository.CategoriaProdutoRepository;
import com.InovaSkill.CaderninhoDigital.repository.MateriaPrimaRepository;
import com.InovaSkill.CaderninhoDigital.repository.ProdutoRepository;
import java.math.BigDecimal;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ProdutoServiceTest {

    @Mock
    private ProdutoRepository produtoRepository;
    @Mock
    private MateriaPrimaRepository materiaPrimaRepository;
    @Mock
    private CategoriaProdutoRepository categoriaProdutoRepository;
    @Mock
    private UsuarioAcessoService usuarioAcessoService;
    @Mock
    private MovimentacaoEstoqueService movimentacaoEstoqueService;
    @Mock
    private HistoricoValorService historicoValorService;
    @Mock
    private AuditoriaService auditoriaService;

    @InjectMocks
    private ProdutoService produtoService;

    @Test
    void preservaCustoAtualQuandoClienteAntigoNaoEnviaCampo() {
        Usuario gestor = Usuario.builder().id(1L).build();
        Produto produto = Produto.builder()
                .id(10L)
                .nome("Paçoca")
                .unidadeMedida("UN")
                .precoVenda(new BigDecimal("8.00"))
                .custoAtual(new BigDecimal("3.25"))
                .estoqueAtual(new BigDecimal("20.000"))
                .ativo(true)
                .gestor(gestor)
                .build();
        ProdutoRequestDTO dto = new ProdutoRequestDTO();
        dto.setNome("Paçoca atualizada");
        dto.setUnidadeMedida("UN");
        dto.setPrecoVenda(new BigDecimal("8.00"));

        when(usuarioAcessoService.buscarGestor(1L)).thenReturn(gestor);
        when(produtoRepository.findById(10L)).thenReturn(Optional.of(produto));
        when(produtoRepository.save(produto)).thenReturn(produto);

        produtoService.atualizar(1L, 10L, dto);

        assertThat(produto.getCustoAtual()).isEqualByComparingTo("3.25");
    }
}
