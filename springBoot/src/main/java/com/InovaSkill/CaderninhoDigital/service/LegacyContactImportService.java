package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.response.LegacyContactImportResponse;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyContactPreviewResponse;
import com.InovaSkill.CaderninhoDigital.dto.response.LegacyHistoricalIssueResponse;
import com.InovaSkill.CaderninhoDigital.entity.Cliente;
import com.InovaSkill.CaderninhoDigital.entity.Fornecedor;
import com.InovaSkill.CaderninhoDigital.entity.LegacyImportRecord;
import com.InovaSkill.CaderninhoDigital.entity.LegacyImportRun;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.enums.LegacyImportRecordStatus;
import com.InovaSkill.CaderninhoDigital.enums.LegacyImportRunStatus;
import com.InovaSkill.CaderninhoDigital.exception.BusinessException;
import com.InovaSkill.CaderninhoDigital.legacy.LegacyCatalogClassifier;
import com.InovaSkill.CaderninhoDigital.legacy.LegacyTable;
import com.InovaSkill.CaderninhoDigital.repository.ClienteRepository;
import com.InovaSkill.CaderninhoDigital.repository.FornecedorRepository;
import com.InovaSkill.CaderninhoDigital.repository.LegacyImportRecordRepository;
import com.InovaSkill.CaderninhoDigital.repository.LegacyImportRunRepository;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class LegacyContactImportService {

    private static final String CONTACTS_FILE = "contatos.xls";
    private static final String CUSTOMER_DOMAIN = "CONTATO_CLIENTE";
    private static final String SUPPLIER_DOMAIN = "CONTATO_FORNECEDOR";

    private final LegacyDataAuditService auditService;
    private final UsuarioAcessoService usuarioAcessoService;
    private final ClienteRepository clienteRepository;
    private final FornecedorRepository fornecedorRepository;
    private final LegacyImportRunRepository runRepository;
    private final LegacyImportRecordRepository recordRepository;
    private final AuditoriaService auditoriaService;

    public LegacyContactImportService(
            LegacyDataAuditService auditService,
            UsuarioAcessoService usuarioAcessoService,
            ClienteRepository clienteRepository,
            FornecedorRepository fornecedorRepository,
            LegacyImportRunRepository runRepository,
            LegacyImportRecordRepository recordRepository,
            AuditoriaService auditoriaService
    ) {
        this.auditService = auditService;
        this.usuarioAcessoService = usuarioAcessoService;
        this.clienteRepository = clienteRepository;
        this.fornecedorRepository = fornecedorRepository;
        this.runRepository = runRepository;
        this.recordRepository = recordRepository;
        this.auditoriaService = auditoriaService;
    }

    @Transactional
    public LegacyContactImportResponse importContacts(Long usuarioId, List<MultipartFile> files) {
        Map<String, LegacyTable> tables = auditService.parseFiles(files);
        return importTables(usuarioId, tables, files == null ? 0 : files.size());
    }

    public LegacyContactPreviewResponse previewContacts(List<MultipartFile> files) {
        Map<String, LegacyTable> tables = auditService.parseFiles(files);
        return previewTables(tables);
    }

    public LegacyContactPreviewResponse previewTables(Map<String, LegacyTable> tables) {
        ContactAnalysis analysis = analyzeContacts(tables);
        long customers = analysis.roles().stream()
                .filter(role -> CUSTOMER_DOMAIN.equals(role.domain()))
                .count();
        long suppliers = analysis.roles().stream()
                .filter(role -> SUPPLIER_DOMAIN.equals(role.domain()))
                .count();
        return new LegacyContactPreviewResponse(
                analysis.contacts().fileName(),
                tables.size(),
                analysis.contacts().rows().size(),
                customers,
                suppliers,
                analysis.pending().size(),
                List.copyOf(analysis.pending()));
    }

    @Transactional
    public LegacyContactImportResponse importTables(
            Long usuarioId,
            Map<String, LegacyTable> tables,
            int filesAnalyzed
    ) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        ContactAnalysis analysis = analyzeContacts(tables);
        LegacyTable contacts = analysis.contacts();
        List<LegacyHistoricalIssueResponse> pending = analysis.pending();
        List<ContactRole> roles = analysis.roles();

        long importedCustomers = 0;
        long importedSuppliers = 0;
        long alreadyProcessed = 0;
        LegacyImportRun run = runRepository.save(LegacyImportRun.builder()
                .gestor(gestor)
                .status(LegacyImportRunStatus.EM_EXECUCAO)
                .arquivoPrincipal(contacts.fileName())
                .arquivosAnalisados(filesAnalyzed)
                .registrosAnalisados((long) contacts.rows().size())
                .build());

        for (ContactRole role : roles) {
            String domain = role.domain();
            Optional<LegacyImportRecord> existing = recordRepository
                    .findByGestorIdAndArquivoAndLinhaAndCodigoLegadoAndDominio(
                            gestor.getId(), contacts.fileName(), role.line(), role.code(), domain);
            if (existing.isPresent()) {
                alreadyProcessed++;
                continue;
            }
            if (CUSTOMER_DOMAIN.equals(domain)) {
                Cliente cliente = clienteRepository.save(toCliente(gestor, contacts, role));
                saveRecord(run, gestor, contacts, role, LegacyImportRecordStatus.IMPORTADO,
                        "CLIENTE", cliente.getId());
                auditoriaService.registrar(gestor, "CLIENTE", cliente.getId(), "IMPORTACAO_CONTATO",
                        null, role.code(), "Cliente importado do cadastro legado", "MIGRACAO");
                importedCustomers++;
            } else {
                Fornecedor fornecedor = fornecedorRepository.save(toFornecedor(gestor, contacts, role));
                saveRecord(run, gestor, contacts, role, LegacyImportRecordStatus.IMPORTADO,
                        "FORNECEDOR", fornecedor.getId());
                auditoriaService.registrar(gestor, "FORNECEDOR", fornecedor.getId(), "IMPORTACAO_CONTATO",
                        null, role.code(), "Fornecedor importado do cadastro legado", "MIGRACAO");
                importedSuppliers++;
            }
        }

        run.setStatus(LegacyImportRunStatus.CONCLUIDA);
        run.setFinalizadoEm(java.time.LocalDateTime.now());
        runRepository.save(run);
        return new LegacyContactImportResponse(
                run.getId(), run.getStatus(), contacts.fileName(), filesAnalyzed,
                contacts.rows().size(), importedCustomers, importedSuppliers,
                alreadyProcessed, pending.size(), List.copyOf(pending));
    }

    private Set<String> resolveDomains(
            String type,
            String code,
            Set<String> purchaseRefs,
            Set<String> saleRefs
    ) {
        boolean purchase = purchaseRefs.contains(code);
        boolean sale = saleRefs.contains(code);
        Set<String> domains = new LinkedHashSet<>();
        if ("1".equals(type) && sale && !purchase) domains.add(CUSTOMER_DOMAIN);
        if ("2".equals(type) && purchase && !sale) domains.add(SUPPLIER_DOMAIN);
        if ("3".equals(type) && (purchase || sale)) {
            if (sale) domains.add(CUSTOMER_DOMAIN);
            if (purchase) domains.add(SUPPLIER_DOMAIN);
        }
        return domains;
    }

    private Cliente toCliente(Usuario gestor, LegacyTable table, ContactRole role) {
        List<String> row = role.row();
        return Cliente.builder()
                .nome(role.name())
                .email(blankToNull(table.value(row, "EMAILS")))
                .telefone(blankToNull(table.value(row, "FONES")))
                .documento(blankToNull(table.value(row, "CPFCNPJ")))
                .endereco(blankToNull(table.value(row, "END")))
                .numero(blankToNull(table.value(row, "NUM")))
                .complemento(blankToNull(table.value(row, "COMPL")))
                .cep(blankToNull(table.value(row, "CEP")))
                .bairro(blankToNull(table.value(row, "BAIRRO")))
                .cidade(blankToNull(table.value(row, "CIDADENOME")))
                .estado(blankToNull(table.value(row, "UF")))
                .inscricaoEstadual(blankToNull(table.value(row, "IE")))
                .ativo(booleanValue(table.value(row, "ATIVO")))
                .gestor(gestor)
                .build();
    }

    private Fornecedor toFornecedor(Usuario gestor, LegacyTable table, ContactRole role) {
        List<String> row = role.row();
        return Fornecedor.builder()
                .nome(role.name())
                .email(blankToNull(table.value(row, "EMAILS")))
                .telefone(blankToNull(table.value(row, "FONES")))
                .documento(blankToNull(table.value(row, "CPFCNPJ")))
                .endereco(blankToNull(table.value(row, "END")))
                .ativo(booleanValue(table.value(row, "ATIVO")))
                .gestor(gestor)
                .build();
    }

    private void saveRecord(
            LegacyImportRun run,
            Usuario gestor,
            LegacyTable contacts,
            ContactRole role,
            LegacyImportRecordStatus status,
            String entityType,
            Long entityId
    ) {
        recordRepository.save(LegacyImportRecord.builder()
                .importacao(run)
                .gestor(gestor)
                .arquivo(contacts.fileName())
                .linha(role.line())
                .codigoLegado(role.code())
                .dominio(role.domain())
                .classificacao(role.domain())
                .status(status)
                .entidadeTipo(entityType)
                .entidadeId(entityId)
                .build());
    }

    private ContactAnalysis analyzeContacts(Map<String, LegacyTable> tables) {
        LegacyTable contacts = tables.get(CONTACTS_FILE);
        if (contacts == null) {
            throw new BusinessException("Envie o arquivo contatos.xls para verificar os contatos.");
        }

        Set<String> purchaseRefs = contactReferences(tables.get("compras.xls"));
        Set<String> saleRefs = contactReferences(tables.get("vendas.xls"));
        List<LegacyHistoricalIssueResponse> pending = new ArrayList<>();
        List<ContactRole> roles = new ArrayList<>();
        for (int index = 0; index < contacts.rows().size(); index++) {
            List<String> row = contacts.rows().get(index);
            int line = index + 2;
            String code = contacts.value(row, "CODIGO");
            String name = valueOrFallback(contacts, row, "NOME", "FANTASIA");
            if (code.isBlank() || name.isBlank()) {
                pending.add(issue(contacts, line, code, "CONTATO_INCOMPLETO",
                        "Contato sem código ou nome não pode ser mapeado com segurança."));
                continue;
            }

            Set<String> domains = resolveDomains(
                    contacts.value(row, "TIPO"), code, purchaseRefs, saleRefs);
            if (domains.isEmpty()) {
                pending.add(issue(contacts, line, code, "TIPO_CONTATO_NAO_MAPEADO",
                        "O tipo legado não permite decidir entre cliente e fornecedor."));
                continue;
            }
            for (String domain : domains) {
                roles.add(new ContactRole(line, code, name, row, domain));
            }
        }
        return new ContactAnalysis(contacts, roles, pending);
    }

    private Set<String> contactReferences(LegacyTable table) {
        if (table == null || !table.hasHeader("CODCONTATO")) return Set.of();
        Set<String> references = new HashSet<>();
        for (List<String> row : table.rows()) {
            String code = table.value(row, "CODCONTATO");
            if (!code.isBlank()) references.add(code);
        }
        return references;
    }

    private String valueOrFallback(LegacyTable table, List<String> row, String first, String second) {
        String value = table.firstAvailableValue(row, first, second);
        return value == null ? "" : value.trim();
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private Boolean booleanValue(String value) {
        if (value == null || value.isBlank()) return null;
        if (value.equals("1") || value.equalsIgnoreCase("true") || value.equalsIgnoreCase("sim")) return true;
        if (value.equals("0") || value.equalsIgnoreCase("false") || value.equalsIgnoreCase("nao")) return false;
        return null;
    }

    private LegacyHistoricalIssueResponse issue(
            LegacyTable table,
            int line,
            String code,
            String type,
            String message
    ) {
        return new LegacyHistoricalIssueResponse(
                table.fileName(), line, code, "CONTATOS", type, message, true);
    }

    private record ContactRole(int line, String code, String name, List<String> row, String domain) {
    }

    private record ContactAnalysis(
            LegacyTable contacts,
            List<ContactRole> roles,
            List<LegacyHistoricalIssueResponse> pending
    ) {
    }
}
