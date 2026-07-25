package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.ContatoDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.ContatoRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.ItemVendaRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.VendaRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ItemVendaResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.CobrancaResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ResumoCobrancasResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ResumoHistoricoVendasResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.VendaDetalhesResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.VendaHistoricoItemResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.VendaResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.VendaDuplicacaoResponseDTO;
import com.InovaSkill.CaderninhoDigital.entity.Cliente;
import com.InovaSkill.CaderninhoDigital.entity.ItemVenda;
import com.InovaSkill.CaderninhoDigital.entity.Produto;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.entity.Venda;
import com.InovaSkill.CaderninhoDigital.enums.FormaPagamento;
import com.InovaSkill.CaderninhoDigital.enums.StatusPagamento;
import com.InovaSkill.CaderninhoDigital.enums.SituacaoCobranca;
import com.InovaSkill.CaderninhoDigital.enums.TipoCartao;
import com.InovaSkill.CaderninhoDigital.enums.OrigemMovimentacaoEstoque;
import com.InovaSkill.CaderninhoDigital.enums.TipoMovimentacaoEstoque;
import com.InovaSkill.CaderninhoDigital.exception.BusinessException;
import com.InovaSkill.CaderninhoDigital.exception.ConflictException;
import com.InovaSkill.CaderninhoDigital.exception.ResourceNotFoundException;
import com.InovaSkill.CaderninhoDigital.repository.ClienteRepository;
import com.InovaSkill.CaderninhoDigital.repository.ProdutoRepository;
import com.InovaSkill.CaderninhoDigital.repository.VendaRepository;
import com.InovaSkill.CaderninhoDigital.repository.projection.ResumoCobrancasProjection;
import com.InovaSkill.CaderninhoDigital.repository.projection.ResumoHistoricoVendasProjection;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

@Service
@RequiredArgsConstructor
public class VendaService {

    private final VendaRepository vendaRepository;
    private final ProdutoRepository produtoRepository;
    private final ClienteRepository clienteRepository;
    private final UsuarioAcessoService usuarioAcessoService;
    private final ObjectMapper objectMapper;
    private final MovimentacaoEstoqueService movimentacaoEstoqueService;
    private final AuditoriaService auditoriaService;
    private final ClassificadorCobrancaService classificadorCobrancaService;

    @Transactional
    public VendaResponseDTO criar(Long usuarioId, VendaRequestDTO dto) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        Cliente cliente = buscarCliente(dto.getClienteId());

        StatusPagamento status = dto.getStatusPagamento() != null ? dto.getStatusPagamento() : StatusPagamento.PENDENTE;
        validarRegrasNegocio(dto, status);

        Venda venda = Venda.builder()
                .cliente(cliente)
                .gestor(gestor)
                .dataVenda(dto.getDataVenda())
                .formaPagamento(dto.getFormaPagamento())
                .statusPagamento(status)
                .observacao(dto.getObservacao())
                .dataVencimento(status == StatusPagamento.PENDENTE ? dto.getDataVencimento() : null)
                .tipoCartao(dto.getFormaPagamento() == FormaPagamento.CARTAO ? dto.getTipoCartao() : null)
                .parcelas(dto.getTipoCartao() == TipoCartao.CREDITO ? dto.getParcelas() : null)
                .valorTotal(BigDecimal.ZERO)
                .itens(new ArrayList<>())
                .build();

        BigDecimal total = BigDecimal.ZERO;
        for (ItemVendaRequestDTO itemDto : dto.getItens()) {
            Produto produto = buscarProdutoDoGestor(itemDto.getProdutoId(), gestor);
            BigDecimal estoqueAnterior = produto.getEstoqueAtual();
            BigDecimal valorUnitario = itemDto.getValorUnitario() != null ? itemDto.getValorUnitario() : produto.getPrecoVenda();
            BigDecimal valorTotal = valorUnitario.multiply(itemDto.getQuantidade());
            baixarEstoque(produto, itemDto.getQuantidade());
            movimentacaoEstoqueService.registrarProduto(
                    produto, gestor, estoqueAnterior, produto.getEstoqueAtual(),
                    TipoMovimentacaoEstoque.SAIDA, OrigemMovimentacaoEstoque.VENDA,
                    dto.getObservacao());
            ItemVenda item = ItemVenda.builder()
                    .venda(venda)
                    .produto(produto)
                    .quantidade(itemDto.getQuantidade())
                    .valorUnitario(valorUnitario)
                    .valorTotal(valorTotal)
                    .custoConsiderado(produto.getCustoAtual())
                    .build();
            venda.getItens().add(item);
            total = total.add(valorTotal);
        }

        venda.setValorTotal(total);
        Venda salva = vendaRepository.save(venda);
        // A auditoria registra o fato sensível sem serializar dados pessoais do cliente.
        auditoriaService.registrar(gestor, "VENDA", salva.getId(), "CRIACAO", null, salva.getValorTotal(), dto.getObservacao(), "VENDA");
        return toResponse(salva);
    }

    private void validarRegrasNegocio(VendaRequestDTO dto, StatusPagamento status) {
        if (status == StatusPagamento.PENDENTE && dto.getDataVencimento() == null) {
            throw new BusinessException("Informe a data de vencimento para vendas pendentes");
        }
        if (dto.getFormaPagamento() == FormaPagamento.CARTAO) {
            if (dto.getTipoCartao() == null) {
                throw new BusinessException("Informe se o pagamento no cartão foi crédito ou débito");
            }
            if (dto.getTipoCartao() == TipoCartao.CREDITO
                    && (dto.getParcelas() == null || dto.getParcelas() < 1)) {
                throw new BusinessException("Informe a quantidade de parcelas");
            }
        }
    }

    public List<VendaResponseDTO> listar(Long usuarioId) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        return vendaRepository.findByGestorOrderByDataVendaDesc(gestor).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public Page<VendaResponseDTO> listarPaginado(
            Long usuarioId,
            int pagina,
            int tamanho,
            String ordenarPor,
            Sort.Direction direcao,
            LocalDate inicio,
            LocalDate fim,
            Long clienteId,
            StatusPagamento status
    ) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        int tamanhoSeguro = Math.min(Math.max(tamanho, 1), 100);
        String campoOrdenacao = switch (ordenarPor) {
            case "valorTotal", "criadoEm" -> ordenarPor;
            default -> "dataVenda";
        };
        Specification<Venda> filtros = (root, query, builder) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(builder.equal(root.get("gestor"), gestor));
            if (inicio != null) predicates.add(builder.greaterThanOrEqualTo(root.get("dataVenda"), inicio));
            if (fim != null) predicates.add(builder.lessThanOrEqualTo(root.get("dataVenda"), fim));
            if (clienteId != null) predicates.add(builder.equal(root.get("cliente").get("id"), clienteId));
            if (status != null) predicates.add(builder.equal(root.get("statusPagamento"), status));
            return builder.and(predicates.toArray(Predicate[]::new));
        };
        PageRequest pageable = PageRequest.of(
                Math.max(pagina, 0), tamanhoSeguro, Sort.by(direcao, campoOrdenacao).and(Sort.by(direcao, "id")));
        Page<Venda> paginaEntidades = vendaRepository.findAll(filtros, pageable);
        if (paginaEntidades.isEmpty()) {
            return new PageImpl<>(List.of(), pageable, paginaEntidades.getTotalElements());
        }
        List<Long> ids = paginaEntidades.getContent().stream().map(Venda::getId).toList();
        Map<Long, Venda> detalhes = vendaRepository.buscarDetalhesPorIds(ids).stream()
                .collect(Collectors.toMap(Venda::getId, Function.identity()));
        List<VendaResponseDTO> registros = ids.stream().map(detalhes::get).map(this::toResponse).toList();
        return new PageImpl<>(registros, pageable, paginaEntidades.getTotalElements());
    }

    public VendaResponseDTO buscar(Long usuarioId, Long id) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        Venda venda = buscarVenda(id, gestor);
        return toResponse(venda);
    }

    @Transactional(readOnly = true)
    public VendaDetalhesResponseDTO buscarDetalhes(Long usuarioId, Long id) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        Venda venda = vendaRepository.buscarDetalhesPorId(id, gestor)
                .orElseThrow(() -> new ResourceNotFoundException("Venda não encontrada"));
        return toDetalhesResponse(venda);
    }

    @Transactional(readOnly = true)
    public Page<VendaHistoricoItemResponseDTO> listarHistorico(
            Long usuarioId,
            int pagina,
            int tamanho,
            String ordenarPor,
            Sort.Direction direcao,
            String busca,
            Long clienteId,
            Long produtoId,
            LocalDate inicio,
            LocalDate fim,
            StatusPagamento status,
            FormaPagamento forma,
            Boolean parcelada
    ) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        PageRequest pageable = PageRequest.of(
                Math.max(pagina, 0),
                Math.min(Math.max(tamanho, 1), 100),
                ordenacaoHistorico(ordenarPor, direcao));
        Page<Venda> paginaEntidades = vendaRepository.findAll(
                filtrosHistorico(gestor, busca, clienteId, produtoId, inicio, fim, status, forma, parcelada),
                pageable);
        if (paginaEntidades.isEmpty()) {
            return new PageImpl<>(List.of(), pageable, paginaEntidades.getTotalElements());
        }
        List<Long> ids = paginaEntidades.getContent().stream().map(Venda::getId).toList();
        Map<Long, BigDecimal> quantidades = vendaRepository.contarItensPorVendas(ids).stream()
                .collect(Collectors.toMap(
                        linha -> ((Number) linha[0]).longValue(),
                        linha -> decimal(linha[1])));
        List<VendaHistoricoItemResponseDTO> registros = paginaEntidades.getContent().stream()
                .map(venda -> toHistoricoResponse(
                        venda, quantidades.getOrDefault(venda.getId(), BigDecimal.ZERO)))
                .toList();
        return new PageImpl<>(registros, pageable, paginaEntidades.getTotalElements());
    }

    @Transactional(readOnly = true)
    public ResumoHistoricoVendasResponseDTO resumirHistorico(
            Long usuarioId,
            String busca,
            Long clienteId,
            Long produtoId,
            LocalDate inicio,
            LocalDate fim,
            StatusPagamento status,
            FormaPagamento forma,
            Boolean parcelada
    ) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        String termo = normalizarBuscaResumo(busca);
        ResumoHistoricoVendasProjection valores = vendaRepository.resumirHistoricoVendas(
                gestor, termo, clienteId, produtoId, inicio, fim, status, forma, parcelada);
        BigDecimal itens = vendaRepository.totalItensHistoricoVendas(
                gestor, termo, clienteId, produtoId, inicio, fim, status, forma, parcelada);
        return new ResumoHistoricoVendasResponseDTO(
                decimal(valores.getFaturamento()),
                numero(valores.getQuantidadeVendas()),
                itens != null ? itens : BigDecimal.ZERO,
                decimal(valores.getTicketMedio()));
    }

    @Transactional(readOnly = true)
    public Page<CobrancaResponseDTO> listarCobrancas(
            Long usuarioId,
            int pagina,
            int tamanho,
            String ordenarPor,
            String busca,
            Long clienteId,
            Long produtoId,
            LocalDate inicio,
            LocalDate fim,
            SituacaoCobranca situacao,
            FormaPagamento forma,
            Boolean parcelada
    ) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        int tamanhoSeguro = Math.min(Math.max(tamanho, 1), 100);
        Sort ordenacao = ordenacaoCobrancas(ordenarPor);
        PageRequest pageable = PageRequest.of(Math.max(pagina, 0), tamanhoSeguro, ordenacao);
        Page<Venda> paginaEntidades = vendaRepository.findAll(
                filtrosCobrancas(gestor, busca, clienteId, produtoId, inicio, fim, situacao, forma, parcelada), pageable);
        if (paginaEntidades.isEmpty()) {
            return new PageImpl<>(List.of(), pageable, paginaEntidades.getTotalElements());
        }
        List<Long> ids = paginaEntidades.getContent().stream().map(Venda::getId).toList();
        Map<Long, Venda> detalhes = vendaRepository.buscarDetalhesPorIds(ids).stream()
                .collect(Collectors.toMap(Venda::getId, Function.identity()));
        List<CobrancaResponseDTO> registros = ids.stream()
                .map(detalhes::get)
                .map(this::toCobrancaResponse)
                .toList();
        return new PageImpl<>(registros, pageable, paginaEntidades.getTotalElements());
    }

    @Transactional(readOnly = true)
    public ResumoCobrancasResponseDTO resumirCobrancas(
            Long usuarioId,
            String busca,
            Long clienteId,
            Long produtoId,
            LocalDate inicio,
            LocalDate fim,
            SituacaoCobranca situacao,
            FormaPagamento forma,
            Boolean parcelada
    ) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        LocalDate hoje = classificadorCobrancaService.hoje();
        String buscaNormalizada = normalizarBuscaResumo(busca);
        ResumoCobrancasProjection valores = vendaRepository.resumirCobrancas(
                gestor,
                hoje,
                hoje.minusDays(1),
                hoje.minusDays(ClassificadorCobrancaService.LIMITE_ATRASO_RECENTE_DIAS),
                hoje.minusDays(ClassificadorCobrancaService.LIMITE_ATRASO_RECENTE_DIAS + 1L),
                hoje.minusDays(ClassificadorCobrancaService.LIMITE_ATRASO_MEDIO_DIAS),
                situacao != null ? situacao.name() : "",
                buscaNormalizada,
                clienteId,
                produtoId,
                inicio,
                fim,
                forma,
                parcelada);
        return new ResumoCobrancasResponseDTO(
                decimal(valores.getTotalReceber()),
                decimal(valores.getTotalVencido()),
                decimal(valores.getTotalEmDia()),
                numero(valores.getQuantidadeAtrasadas()),
                numero(valores.getQuantidadeCobrancas()));
    }

    @Transactional
    public VendaResponseDTO confirmarPagamento(Long usuarioId, Long vendaId) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        Venda venda = vendaRepository.buscarParaConfirmacao(vendaId, gestor)
                .orElseThrow(() -> new ResourceNotFoundException("Cobrança não encontrada"));
        if (venda.getStatusPagamento() == StatusPagamento.PAGO) {
            throw new ConflictException("Esta cobrança já foi confirmada como paga");
        }
        if (venda.getStatusPagamento() != StatusPagamento.PENDENTE
                && venda.getStatusPagamento() != StatusPagamento.ATRASADO) {
            throw new BusinessException("Esta venda não possui uma cobrança pendente");
        }
        StatusPagamento statusAnterior = venda.getStatusPagamento();
        venda.setStatusPagamento(StatusPagamento.PAGO);
        Venda salva = vendaRepository.save(venda);
        auditoriaService.registrar(
                gestor,
                "VENDA",
                salva.getId(),
                "CONFIRMACAO_PAGAMENTO",
                statusAnterior,
                StatusPagamento.PAGO,
                "Pagamento confirmado",
                "A_RECEBER");
        return toResponse(salva);
    }

    @Transactional(readOnly = true)
    public VendaDuplicacaoResponseDTO prepararDuplicacao(Long usuarioId, Long id) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        Venda venda = buscarVenda(id, gestor);
        List<String> avisos = new ArrayList<>();
        var itens = venda.getItens().stream().map(item -> {
            Produto produto = item.getProduto();
            if (item.getValorUnitario().compareTo(produto.getPrecoVenda()) != 0) {
                avisos.add("O preço de " + produto.getNome() + " mudou de " + item.getValorUnitario() + " para " + produto.getPrecoVenda());
            }
            if (produto.getEstoqueAtual().compareTo(item.getQuantidade()) < 0) {
                avisos.add("Estoque insuficiente para " + produto.getNome() + "; revise a quantidade antes de concluir");
            }
            return new VendaDuplicacaoResponseDTO.ItemDuplicacao(produto.getId(), produto.getNome(),
                    item.getQuantidade(), item.getValorUnitario(), produto.getPrecoVenda(), produto.getEstoqueAtual());
        }).toList();
        return new VendaDuplicacaoResponseDTO(venda.getId(), venda.getCliente().getId(), venda.getCliente().getNome(), itens, avisos);
    }

    @Transactional
    public VendaResponseDTO adicionarContato(Long usuarioId, Long vendaId, ContatoRequestDTO dto) {
        Usuario gestor = usuarioAcessoService.buscarGestor(usuarioId);
        Venda venda = buscarVenda(vendaId, gestor);
        List<ContatoDTO> contatos = lerContatos(venda.getContatos());
        contatos.add(ContatoDTO.builder()
                .data(LocalDateTime.now())
                .tipo(dto.getTipo())
                .resposta(dto.getResposta())
                .build());
        venda.setContatos(escreverContatos(contatos));
        return toResponse(vendaRepository.save(venda));
    }

    private Cliente buscarCliente(Long clienteId) {
        if (clienteId == null) {
            throw new BusinessException("Selecione um cliente para registrar a venda");
        }
        return clienteRepository.findById(clienteId)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado"));
    }

    private Produto buscarProdutoDoGestor(Long produtoId, Usuario gestor) {
        return produtoRepository.findById(produtoId)
                .orElseThrow(() -> new ResourceNotFoundException("Produto não encontrado"));
    }

    private void baixarEstoque(Produto produto, BigDecimal quantidade) {
        if (produto.getEstoqueAtual().compareTo(quantidade) < 0) {
            throw new BusinessException("Estoque insuficiente para o produto " + produto.getNome());
        }
        produto.setEstoqueAtual(produto.getEstoqueAtual().subtract(quantidade));
    }

    private Venda buscarVenda(Long id, Usuario gestor) {
        return vendaRepository.findById(id)
                .filter(venda -> venda.getGestor().getId().equals(gestor.getId()))
                .orElseThrow(() -> new ResourceNotFoundException("Venda não encontrada"));
    }

    private Specification<Venda> filtrosCobrancas(
            Usuario gestor,
            String busca,
            Long clienteId,
            Long produtoId,
            LocalDate inicio,
            LocalDate fim,
            SituacaoCobranca situacao,
            FormaPagamento forma,
            Boolean parcelada
    ) {
        LocalDate hoje = classificadorCobrancaService.hoje();
        String termo = normalizarBusca(busca);
        return (root, query, builder) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(builder.equal(root.get("gestor"), gestor));
            predicates.add(builder.equal(root.get("statusPagamento"), StatusPagamento.PENDENTE));
            if (clienteId != null) {
                predicates.add(builder.equal(root.get("cliente").get("id"), clienteId));
            }
            if (inicio != null) {
                predicates.add(builder.greaterThanOrEqualTo(root.get("dataVencimento"), inicio));
            }
            if (fim != null) {
                predicates.add(builder.lessThanOrEqualTo(root.get("dataVencimento"), fim));
            }
            if (forma != null) predicates.add(builder.equal(root.get("formaPagamento"), forma));
            if (parcelada != null) {
                Predicate possuiParcelas = builder.greaterThan(root.get("parcelas"), 1);
                predicates.add(parcelada
                        ? possuiParcelas
                        : builder.or(builder.isNull(root.get("parcelas")), builder.lessThanOrEqualTo(root.get("parcelas"), 1)));
            }
            if (produtoId != null) {
                predicates.add(existeProduto(root, query.subquery(Long.class), produtoId, builder));
            }
            if (termo != null) {
                String like = "%" + termo.toLowerCase() + "%";
                Subquery<Long> produtoPorNome = query.subquery(Long.class);
                Root<ItemVenda> item = produtoPorNome.from(ItemVenda.class);
                produtoPorNome.select(item.get("id")).where(
                        builder.equal(item.get("venda"), root),
                        builder.like(builder.lower(item.get("produto").get("nome")), like));
                predicates.add(builder.or(
                        builder.like(builder.lower(root.get("cliente").get("nome")), like),
                        builder.like(builder.lower(root.get("cliente").get("email")), like),
                        builder.like(builder.lower(root.get("cliente").get("telefone")), like),
                        builder.like(builder.lower(root.get("observacao")), like),
                        builder.exists(produtoPorNome)));
            }
            adicionarFiltroSituacao(predicates, root, builder, situacao, hoje);
            return builder.and(predicates.toArray(Predicate[]::new));
        };
    }

    private Specification<Venda> filtrosHistorico(
            Usuario gestor,
            String busca,
            Long clienteId,
            Long produtoId,
            LocalDate inicio,
            LocalDate fim,
            StatusPagamento status,
            FormaPagamento forma,
            Boolean parcelada
    ) {
        String termo = normalizarBusca(busca);
        return (root, query, builder) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(builder.equal(root.get("gestor"), gestor));
            if (clienteId != null) {
                predicates.add(builder.equal(root.get("cliente").get("id"), clienteId));
            }
            if (inicio != null) predicates.add(builder.greaterThanOrEqualTo(root.get("dataVenda"), inicio));
            if (fim != null) predicates.add(builder.lessThanOrEqualTo(root.get("dataVenda"), fim));
            if (status != null) predicates.add(builder.equal(root.get("statusPagamento"), status));
            if (forma != null) predicates.add(builder.equal(root.get("formaPagamento"), forma));
            if (parcelada != null) {
                Predicate possuiParcelas = builder.greaterThan(root.get("parcelas"), 1);
                predicates.add(parcelada
                        ? possuiParcelas
                        : builder.or(builder.isNull(root.get("parcelas")), builder.lessThanOrEqualTo(root.get("parcelas"), 1)));
            }
            if (produtoId != null) {
                predicates.add(existeProduto(root, query.subquery(Long.class), produtoId, builder));
            }
            if (termo != null) {
                String like = "%" + termo.toLowerCase() + "%";
                Subquery<Long> produtoPorNome = query.subquery(Long.class);
                Root<ItemVenda> item = produtoPorNome.from(ItemVenda.class);
                produtoPorNome.select(item.get("id")).where(
                        builder.equal(item.get("venda"), root),
                        builder.like(builder.lower(item.get("produto").get("nome")), like));
                predicates.add(builder.or(
                        builder.like(builder.lower(root.get("cliente").get("nome")), like),
                        builder.like(builder.lower(root.get("observacao")), like),
                        builder.exists(produtoPorNome)));
            }
            return builder.and(predicates.toArray(Predicate[]::new));
        };
    }

    private Sort ordenacaoHistorico(String ordenarPor, Sort.Direction direcao) {
        String campo = switch (ordenarPor == null ? "" : ordenarPor) {
            case "valorTotal" -> "valorTotal";
            case "cliente" -> "cliente.nome";
            case "statusPagamento" -> "statusPagamento";
            default -> "dataVenda";
        };
        return Sort.by(direcao, campo).and(Sort.by(direcao, "id"));
    }

    private Predicate existeProduto(
            Root<Venda> venda,
            Subquery<Long> subquery,
            Long produtoId,
            jakarta.persistence.criteria.CriteriaBuilder builder
    ) {
        Root<ItemVenda> item = subquery.from(ItemVenda.class);
        subquery.select(item.get("id")).where(
                builder.equal(item.get("venda"), venda),
                builder.equal(item.get("produto").get("id"), produtoId));
        return builder.exists(subquery);
    }

    private void adicionarFiltroSituacao(
            List<Predicate> predicates,
            Root<Venda> root,
            jakarta.persistence.criteria.CriteriaBuilder builder,
            SituacaoCobranca situacao,
            LocalDate hoje
    ) {
        if (situacao == null) return;
        switch (situacao) {
            case EM_DIA -> predicates.add(builder.greaterThanOrEqualTo(root.get("dataVencimento"), hoje));
            case ATRASO_RECENTE -> predicates.add(builder.between(
                    root.get("dataVencimento"),
                    hoje.minusDays(ClassificadorCobrancaService.LIMITE_ATRASO_RECENTE_DIAS),
                    hoje.minusDays(1)));
            case ATRASO_MEDIO -> predicates.add(builder.between(
                    root.get("dataVencimento"),
                    hoje.minusDays(ClassificadorCobrancaService.LIMITE_ATRASO_MEDIO_DIAS),
                    hoje.minusDays(ClassificadorCobrancaService.LIMITE_ATRASO_RECENTE_DIAS + 1L)));
            case MUITO_ATRASADO -> predicates.add(builder.lessThan(
                    root.get("dataVencimento"),
                    hoje.minusDays(ClassificadorCobrancaService.LIMITE_ATRASO_MEDIO_DIAS)));
        }
    }

    private Sort ordenacaoCobrancas(String ordenarPor) {
        return switch (ordenarPor == null ? "" : ordenarPor) {
            case "maiorValor" -> Sort.by(Sort.Direction.DESC, "valorTotal").and(Sort.by("id"));
            case "menorValor" -> Sort.by("valorTotal").and(Sort.by("id"));
            case "cliente" -> Sort.by("cliente.nome").and(Sort.by("id"));
            case "vencimentoProximo" -> Sort.by("dataVencimento").and(Sort.by("id"));
            case "vencimentoAntigo", "maiorAtraso" ->
                    Sort.by("dataVencimento").and(Sort.by("id"));
            default -> Sort.by("dataVencimento").and(Sort.by("id"));
        };
    }

    private String normalizarBusca(String busca) {
        if (busca == null || busca.isBlank()) return null;
        return busca.trim();
    }

    private String normalizarBuscaResumo(String busca) {
        return busca == null ? "" : busca.trim();
    }

    private BigDecimal decimal(Object valor) {
        return valor instanceof BigDecimal decimal ? decimal : BigDecimal.ZERO;
    }

    private long numero(Object valor) {
        return valor instanceof Number numero ? numero.longValue() : 0;
    }

    private List<ContatoDTO> lerContatos(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<ContatoDTO>>() {});
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private String escreverContatos(List<ContatoDTO> contatos) {
        try {
            return objectMapper.writeValueAsString(contatos);
        } catch (Exception e) {
            return "[]";
        }
    }

    private VendaResponseDTO toResponse(Venda venda) {
        boolean emAtraso = venda.getStatusPagamento() == StatusPagamento.PENDENTE
                && venda.getDataVencimento() != null
                && venda.getDataVencimento().isBefore(LocalDate.now());

        return VendaResponseDTO.builder()
                .id(venda.getId())
                .clienteId(venda.getCliente() != null ? venda.getCliente().getId() : null)
                .clienteNome(venda.getCliente() != null ? venda.getCliente().getNome() : null)
                .dataVenda(venda.getDataVenda())
                .formaPagamento(venda.getFormaPagamento())
                .statusPagamento(venda.getStatusPagamento())
                .valorTotal(venda.getValorTotal())
                .observacao(venda.getObservacao())
                .dataVencimento(venda.getDataVencimento())
                .tipoCartao(venda.getTipoCartao())
                .parcelas(venda.getParcelas())
                .emAtraso(emAtraso)
                .contatos(lerContatos(venda.getContatos()))
                .criadoEm(venda.getCriadoEm())
                .itens(venda.getItens().stream().map(this::toItemResponse).toList())
                .build();
    }

    private CobrancaResponseDTO toCobrancaResponse(Venda venda) {
        Cliente cliente = venda.getCliente();
        return CobrancaResponseDTO.builder()
                .id(venda.getId())
                .clienteId(cliente != null ? cliente.getId() : null)
                .clienteNome(cliente != null ? cliente.getNome() : null)
                .clienteTelefone(cliente != null ? cliente.getTelefone() : null)
                .clienteEmail(cliente != null ? cliente.getEmail() : null)
                .descricao(venda.getObservacao())
                .dataVenda(venda.getDataVenda())
                .dataVencimento(venda.getDataVencimento())
                .valor(venda.getValorTotal())
                .formaPagamento(venda.getFormaPagamento())
                .parcelas(venda.getParcelas())
                .diasAtraso(classificadorCobrancaService.calcularDiasAtraso(
                        venda.getDataVencimento(), venda.getStatusPagamento()))
                .situacao(classificadorCobrancaService.classificar(
                        venda.getDataVencimento(), venda.getStatusPagamento()))
                .gestorNome(venda.getGestor() != null ? venda.getGestor().getNome() : null)
                .itens(venda.getItens().stream().map(this::toItemResponse).toList())
                .build();
    }

    private VendaHistoricoItemResponseDTO toHistoricoResponse(Venda venda, BigDecimal quantidadeItens) {
        boolean emAtraso = venda.getStatusPagamento() == StatusPagamento.PENDENTE
                && venda.getDataVencimento() != null
                && venda.getDataVencimento().isBefore(classificadorCobrancaService.hoje());
        return VendaHistoricoItemResponseDTO.builder()
                .id(venda.getId())
                .dataVenda(venda.getDataVenda())
                .clienteId(venda.getCliente() != null ? venda.getCliente().getId() : null)
                .clienteNome(venda.getCliente() != null ? venda.getCliente().getNome() : null)
                .quantidadeItens(quantidadeItens)
                .valorTotal(venda.getValorTotal())
                .formaPagamento(venda.getFormaPagamento())
                .parcelas(venda.getParcelas())
                .statusPagamento(venda.getStatusPagamento())
                .emAtraso(emAtraso)
                .build();
    }

    private VendaDetalhesResponseDTO toDetalhesResponse(Venda venda) {
        Cliente cliente = venda.getCliente();
        boolean emAtraso = venda.getStatusPagamento() == StatusPagamento.PENDENTE
                && venda.getDataVencimento() != null
                && venda.getDataVencimento().isBefore(classificadorCobrancaService.hoje());
        return VendaDetalhesResponseDTO.builder()
                .id(venda.getId())
                .clienteId(cliente != null ? cliente.getId() : null)
                .clienteNome(cliente != null ? cliente.getNome() : null)
                .clienteTelefone(cliente != null ? cliente.getTelefone() : null)
                .clienteEmail(cliente != null ? cliente.getEmail() : null)
                .clienteDocumento(cliente != null ? cliente.getDocumento() : null)
                .dataVenda(venda.getDataVenda())
                .formaPagamento(venda.getFormaPagamento())
                .statusPagamento(venda.getStatusPagamento())
                .valorTotal(venda.getValorTotal())
                .observacao(venda.getObservacao())
                .dataVencimento(venda.getDataVencimento())
                .tipoCartao(venda.getTipoCartao())
                .parcelas(venda.getParcelas())
                .emAtraso(emAtraso)
                .gestorNome(venda.getGestor() != null ? venda.getGestor().getNome() : null)
                .contatos(lerContatos(venda.getContatos()))
                .criadoEm(venda.getCriadoEm())
                .itens(venda.getItens().stream().map(this::toItemResponse).toList())
                .build();
    }

    private ItemVendaResponseDTO toItemResponse(ItemVenda item) {
        return ItemVendaResponseDTO.builder()
                .id(item.getId())
                .produtoId(item.getProduto().getId())
                .produtoNome(item.getProduto().getNome())
                .quantidade(item.getQuantidade())
                .valorUnitario(item.getValorUnitario())
                .valorTotal(item.getValorTotal())
                .custoConsiderado(item.getCustoConsiderado())
                .build();
    }
}
