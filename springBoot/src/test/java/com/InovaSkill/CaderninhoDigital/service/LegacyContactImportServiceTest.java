package com.InovaSkill.CaderninhoDigital.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import com.InovaSkill.CaderninhoDigital.dto.response.LegacyContactImportResponse;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyContactPreviewResponse;
import com.InovaSkill.CaderninhoDigital.entity.Cliente;
import com.InovaSkill.CaderninhoDigital.entity.Fornecedor;
import com.InovaSkill.CaderninhoDigital.entity.LegacyImportRun;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.legacy.LegacyTable;
import com.InovaSkill.CaderninhoDigital.repository.ClienteRepository;
import com.InovaSkill.CaderninhoDigital.repository.FornecedorRepository;
import com.InovaSkill.CaderninhoDigital.repository.LegacyImportRecordRepository;
import com.InovaSkill.CaderninhoDigital.repository.LegacyImportRunRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class LegacyContactImportServiceTest {

    @Mock
    private LegacyDataAuditService auditService;
    @Mock
    private UsuarioAcessoService usuarioAcessoService;
    @Mock
    private ClienteRepository clienteRepository;
    @Mock
    private FornecedorRepository fornecedorRepository;
    @Mock
    private LegacyImportRunRepository runRepository;
    @Mock
    private LegacyImportRecordRepository recordRepository;
    @Mock
    private AuditoriaService auditoriaService;

    private LegacyContactImportService service;

    @BeforeEach
    void configurar() {
        service = new LegacyContactImportService(
                auditService, usuarioAcessoService, clienteRepository, fornecedorRepository,
                runRepository, recordRepository, auditoriaService);
    }

    @Test
    void importaClienteEFornecedorPorTipoEReferenciaSemDuplicarEstoque() {
        Usuario gestor = Usuario.builder().id(7L).build();
        Map<String, LegacyTable> tables = tables();
        when(usuarioAcessoService.buscarGestor(7L)).thenReturn(gestor);
        when(runRepository.save(any(LegacyImportRun.class))).thenAnswer(invocation -> {
            LegacyImportRun run = invocation.getArgument(0);
            if (run.getId() == null) run.setId(50L);
            return run;
        });
        when(recordRepository.findByGestorIdAndArquivoAndLinhaAndCodigoLegadoAndDominio(
                anyLong(), anyString(), anyInt(), anyString(), anyString()))
                .thenReturn(Optional.empty());
        when(clienteRepository.save(any(Cliente.class))).thenAnswer(invocation -> {
            Cliente cliente = invocation.getArgument(0);
            cliente.setId(101L);
            return cliente;
        });
        when(fornecedorRepository.save(any(Fornecedor.class))).thenAnswer(invocation -> {
            Fornecedor fornecedor = invocation.getArgument(0);
            fornecedor.setId(202L);
            return fornecedor;
        });

        LegacyContactImportResponse response = service.importTables(7L, tables, 3);

        assertThat(response.importacaoId()).isEqualTo(50L);
        assertThat(response.clientesImportados()).isEqualTo(1);
        assertThat(response.fornecedoresImportados()).isEqualTo(1);
        assertThat(response.pendentes()).isEqualTo(1);
        assertThat(response.rejeicoes()).extracting(item -> item.tipo())
                .containsExactly("TIPO_CONTATO_NAO_MAPEADO");
    }

    @Test
    void exigeContatosNoArquivoEnviado() {
        Usuario gestor = Usuario.builder().id(7L).build();
        when(usuarioAcessoService.buscarGestor(7L)).thenReturn(gestor);

        org.assertj.core.api.Assertions.assertThatThrownBy(
                () -> service.importTables(7L, Map.of("produtos.xls", tables().get("produtos.xls")), 1))
                .isInstanceOf(com.InovaSkill.CaderninhoDigital.exception.BusinessException.class)
                .hasMessageContaining("contatos.xls");
    }

    @Test
    void geraPreviaDeContatosSemCriarExecucao() {
        LegacyContactPreviewResponse response = service.previewTables(tables());

        assertThat(response.arquivoPrincipal()).isEqualTo("contatos.xls");
        assertThat(response.clientesIdentificados()).isEqualTo(1);
        assertThat(response.fornecedoresIdentificados()).isEqualTo(1);
        assertThat(response.pendentes()).isEqualTo(1);
        assertThat(response.pendencias()).extracting(item -> item.tipo())
                .containsExactly("TIPO_CONTATO_NAO_MAPEADO");
    }

    private Map<String, LegacyTable> tables() {
        Map<String, LegacyTable> tables = new LinkedHashMap<>();
        tables.put("contatos.xls", new LegacyTable(
                "contatos.xls",
                List.of("CODIGO", "TIPO", "NOME", "EMAILS", "FONES", "ATIVO"),
                List.of(
                        List.of("30", "1", "Cliente", "cliente@teste.com", "11999999999", "1"),
                        List.of("3", "2", "Fornecedor", "fornecedor@teste.com", "1133333333", "1"),
                        List.of("99", "4", "Indefinido", "", "", "1"))));
        tables.put("vendas.xls", new LegacyTable(
                "vendas.xls", List.of("CODIGO", "CODCONTATO"), List.of(List.of("1", "30"))));
        tables.put("compras.xls", new LegacyTable(
                "compras.xls", List.of("CODIGO", "CODCONTATO"), List.of(List.of("2", "3"))));
        tables.put("produtos.xls", new LegacyTable(
                "produtos.xls", List.of("CODIGO"), List.of(List.of("1"))));
        return tables;
    }
}
