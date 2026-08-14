package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.ContatoDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.ContatoRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.ItemVendaRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.VendaRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.CobrancaResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ItemVendaResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ResumoCobrancasResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ResumoHistoricoVendasResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.VendaDetalhesResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.VendaDuplicacaoResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.VendaHistoricoItemResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.VendaResponseDTO;
import com.InovaSkill.CaderninhoDigital.entity.Cliente;
import com.InovaSkill.CaderninhoDigital.entity.ItemVenda;
import com.InovaSkill.CaderninhoDigital.entity.Produto;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.entity.Venda;
import com.InovaSkill.CaderninhoDigital.enums.FormaPagamento;
import com.InovaSkill.CaderninhoDigital.enums.OrigemMovimentacaoEstoque;
import com.InovaSkill.CaderninhoDigital.enums.SituacaoCobranca;
import com.InovaSkill.CaderninhoDigital.enums.StatusPagamento;
import com.InovaSkill.CaderninhoDigital.enums.TipoCartao;
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
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

        StatusPagamento statusSolicitado =
                dto.getStatusPagamento() != null
                        ? dto.getStatusPagamento()
                        : StatusPagamento.PENDENTE;

        validarRegrasNegocio(dto, statusSolicitado);

        /*
         * Verifica se existe estoque suficiente para TODOS os produtos.
         */
        boolean possuiEstoqueSuficiente = true;

        for (ItemVendaRequestDTO itemDto : dto.getItens()) {

            Produto produto =
                    buscarProdutoDoGestor(itemDto.getProdutoId(), gestor);

            if (produto.getEstoqueAtual()
                    .compareTo(itemDto.getQuantidade()) < 0) {

                possuiEstoqueSuficiente = false;
                break;
            }
        }

        /*
         * O status de pagamento é sempre o que a gestora escolheu.
         * Falta de estoque NUNCA sobrescreve o status de pagamento — isso
         * é controlado separadamente pelo campo aguardandoEstoque.
         */
        LocalDate dataVencimentoFinal = null;

        if (statusSolicitado == StatusPagamento.PENDENTE) {

            dataVencimentoFinal =
                    dto.getDataVencimento() != null
                            ? dto.getDataVencimento()
                            : dto.getDataVenda();
        }

        Venda venda = Venda.builder()
                .cliente(cliente)
                .gestor(gestor)
                .dataVenda(dto.getDataVenda())
                .formaPagamento(dto.getFormaPagamento())
                .statusPagamento(statusSolicitado)
                .aguardandoEstoque(!possuiEstoqueSuficiente)
                .observacao(dto.getObservacao())
                .dataVencimento(dataVencimentoFinal)
                .tipoCartao(
                        dto.getFormaPagamento() == FormaPagamento.CARTAO
                                ? dto.getTipoCartao()
                                : null)
                .parcelas(
                        dto.getTipoCartao() == TipoCartao.CREDITO
                                ? dto.getParcelas()
                                : null)
                .valorTotal(BigDecimal.ZERO)
                .itens(new ArrayList<>())
                .build();
        vendaRepository.save(venda);

        BigDecimal total = BigDecimal.ZERO;

        for (ItemVendaRequestDTO itemDto : dto.getItens()) {

            Produto produto =
                    buscarProdutoDoGestor(itemDto.getProdutoId(), gestor);

            BigDecimal valorUnitario =
                    itemDto.getValorUnitario() != null
                            ? itemDto.getValorUnitario()
                            : produto.getPrecoVenda();

            BigDecimal valorTotal =
                    valorUnitario.multiply(itemDto.getQuantidade());

            /*
             * Só baixa estoque quando TODOS os produtos possuem estoque.
             *
             * Assim, uma venda futura não consome estoque que ainda não existe.
             */
            if (possuiEstoqueSuficiente) {

                BigDecimal estoqueAnterior =
                        produto.getEstoqueAtual();

                baixarEstoque(
                        produto,
                        itemDto.getQuantidade()
                );

                movimentacaoEstoqueService.registrarProduto(
                        produto,
                        gestor,
                        estoqueAnterior,
                        produto.getEstoqueAtual(),
                        TipoMovimentacaoEstoque.SAIDA,
                        OrigemMovimentacaoEstoque.VENDA,
                        venda.getId(),
                        dto.getObservacao()
                );
            }

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

        auditoriaService.registrar(
                gestor,
                "VENDA",
                salva.getId(),
                "CRIACAO",
                null,
                salva.getValorTotal(),
                possuiEstoqueSuficiente
                        ? dto.getObservacao()
                        : "Venda gravada aguardando estoque (produção pendente)",
                "VENDA"
        );

        return toResponse(salva);
    }

    /**
     * Tenta reprocessar vendas que ficaram aguardando estoque.
     * Só mexe no campo aguardandoEstoque — nunca no statusPagamento.
     */
    @Transactional
    public void processarVendasPendentesPorEstoque(
            Produto produto,
            Usuario gestor
    ) {

        List<Venda> vendasAguardandoEstoque =
                vendaRepository.findByAguardandoEstoqueTrueOrderByDataVendaAsc();

        for (Venda venda : vendasAguardandoEstoque) {

            boolean podeConcluir = true;

            for (ItemVenda item : venda.getItens()) {

                Produto produtoVenda = item.getProduto();

                if (produtoVenda.getEstoqueAtual()
                        .compareTo(item.getQuantidade()) < 0) {

                    podeConcluir = false;
                    break;
                }
            }

            if (podeConcluir) {

                for (ItemVenda item : venda.getItens()) {

                    Produto produtoVenda = item.getProduto();

                    BigDecimal estoqueAnterior =
                            produtoVenda.getEstoqueAtual();

                    baixarEstoque(
                            produtoVenda,
                            item.getQuantidade()
                    );

                    movimentacaoEstoqueService.registrarProduto(
                            produtoVenda,
                            gestor,
                            estoqueAnterior,
                            produtoVenda.getEstoqueAtual(),
                            TipoMovimentacaoEstoque.SAIDA,
                            OrigemMovimentacaoEstoque.VENDA,
                            venda.getId(),
                            "Baixa automática de Venda Pendente por reabastecimento"
                    );
                }

                venda.setAguardandoEstoque(false);

                Venda salva = vendaRepository.save(venda);

                auditoriaService.registrar(
                        gestor,
                        "VENDA",
                        salva.getId(),
                        "BAIXA_AUTOMATICA_PENDENTE",
                        true,
                        false,
                        "Venda concluída automaticamente após reposição de estoque",
                        "VENDA"
                );
            }
        }
    }

    /**
     * Lista as vendas registradas sem estoque suficiente, ainda aguardando
     * produção. Usada para alimentar os cards amarelos em /registrar/venda.
     */
    @Transactional(readOnly = true)
    public List<VendaResponseDTO> listarAguardandoEstoque(Long usuarioId) {

        usuarioAcessoService.buscarGestor(usuarioId);

        return vendaRepository
                .findByAguardandoEstoqueTrueOrderByDataVendaAsc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private void validarRegrasNegocio(
            VendaRequestDTO dto,
            StatusPagamento status
    ) {

        if (status == StatusPagamento.PENDENTE
                && dto.getDataVencimento() == null) {

            throw new BusinessException(
                    "Informe a data de vencimento para vendas pendentes"
            );
        }

        if (dto.getFormaPagamento() == FormaPagamento.CARTAO) {

            if (dto.getTipoCartao() == null) {

                throw new BusinessException(
                        "Informe se o pagamento no cartão foi crédito ou débito"
                );
            }

            if (dto.getTipoCartao() == TipoCartao.CREDITO
                    && (dto.getParcelas() == null
                    || dto.getParcelas() < 1)) {

                throw new BusinessException(
                        "Informe a quantidade de parcelas"
                );
            }
        }
    }

    public List<VendaResponseDTO> listar(Long usuarioId) {

        usuarioAcessoService.buscarGestor(usuarioId);

        return vendaRepository
                .findAllByOrderByDataVendaDesc()
                .stream()
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

        usuarioAcessoService.buscarGestor(usuarioId);

        int tamanhoSeguro =
                Math.min(Math.max(tamanho, 1), 100);

        String campoOrdenacao =
                switch (ordenarPor == null ? "" : ordenarPor) {

                    case "valorTotal", "criadoEm" ->
                            ordenarPor;

                    default ->
                            "dataVenda";
                };

        Specification<Venda> filtros =
                (root, query, builder) -> {

                    List<Predicate> predicates =
                            new ArrayList<>();

                    if (inicio != null) {

                        predicates.add(
                                builder.greaterThanOrEqualTo(
                                        root.get("dataVenda"),
                                        inicio
                                )
                        );
                    }

                    if (fim != null) {

                        predicates.add(
                                builder.lessThanOrEqualTo(
                                        root.get("dataVenda"),
                                        fim
                                )
                        );
                    }

                    if (clienteId != null) {

                        predicates.add(
                                builder.equal(
                                        root.get("cliente").get("id"),
                                        clienteId
                                )
                        );
                    }

                    if (status != null) {

                        predicates.add(
                                builder.equal(
                                        root.get("statusPagamento"),
                                        status
                                )
                        );
                    }

                    return builder.and(
                            predicates.toArray(Predicate[]::new)
                    );
                };

        PageRequest pageable =
                PageRequest.of(
                        Math.max(pagina, 0),
                        tamanhoSeguro,
                        Sort.by(direcao, campoOrdenacao)
                                .and(Sort.by(direcao, "id"))
                );

        Page<Venda> paginaEntidades =
                vendaRepository.findAll(
                        filtros,
                        pageable
                );

        if (paginaEntidades.isEmpty()) {

            return new PageImpl<>(
                    List.of(),
                    pageable,
                    paginaEntidades.getTotalElements()
            );
        }

        List<Long> ids =
                paginaEntidades
                        .getContent()
                        .stream()
                        .map(Venda::getId)
                        .toList();

        Map<Long, Venda> detalhes =
                vendaRepository
                        .buscarDetalhesPorIds(ids)
                        .stream()
                        .collect(
                                Collectors.toMap(
                                        Venda::getId,
                                        Function.identity()
                                )
                        );

        List<VendaResponseDTO> registros =
                ids.stream()
                        .map(detalhes::get)
                        .map(this::toResponse)
                        .toList();

        return new PageImpl<>(
                registros,
                pageable,
                paginaEntidades.getTotalElements()
        );
    }

    public VendaResponseDTO buscar(
            Long usuarioId,
            Long id
    ) {

        usuarioAcessoService.buscarGestor(usuarioId);

        Venda venda = buscarVenda(id);

        return toResponse(venda);
    }

    @Transactional(readOnly = true)
    public VendaDetalhesResponseDTO buscarDetalhes(
            Long usuarioId,
            Long id
    ) {

        usuarioAcessoService.buscarGestor(usuarioId);

        Venda venda =
                vendaRepository.buscarDetalhesPorId(id)
                        .orElseThrow(
                                () -> new ResourceNotFoundException(
                                        "Venda não encontrada"
                                )
                        );

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

        usuarioAcessoService.buscarGestor(usuarioId);

        PageRequest pageable =
                PageRequest.of(
                        Math.max(pagina, 0),
                        Math.min(Math.max(tamanho, 1), 100),
                        ordenacaoHistorico(
                                ordenarPor,
                                direcao
                        )
                );

        Page<Venda> paginaEntidades =
                vendaRepository.findAll(
                        filtrosHistorico(
                                busca,
                                clienteId,
                                produtoId,
                                inicio,
                                fim,
                                status,
                                forma,
                                parcelada
                        ),
                        pageable
                );

        if (paginaEntidades.isEmpty()) {

            return new PageImpl<>(
                    List.of(),
                    pageable,
                    paginaEntidades.getTotalElements()
            );
        }

        List<Long> ids =
                paginaEntidades
                        .getContent()
                        .stream()
                        .map(Venda::getId)
                        .toList();

        Map<Long, BigDecimal> quantidades =
                vendaRepository
                        .contarItensPorVendas(ids)
                        .stream()
                        .collect(
                                Collectors.toMap(
                                        linha ->
                                                ((Number) linha[0])
                                                        .longValue(),

                                        linha ->
                                                decimal(linha[1])
                                )
                        );

        List<VendaHistoricoItemResponseDTO> registros =
                paginaEntidades
                        .getContent()
                        .stream()
                        .map(
                                venda ->
                                        toHistoricoResponse(
                                                venda,
                                                quantidades.getOrDefault(
                                                        venda.getId(),
                                                        BigDecimal.ZERO
                                                )
                                        )
                        )
                        .toList();

        return new PageImpl<>(
                registros,
                pageable,
                paginaEntidades.getTotalElements()
        );
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

        usuarioAcessoService.buscarGestor(usuarioId);

        String termo =
                normalizarBuscaResumo(busca);

        ResumoHistoricoVendasProjection valores =
                vendaRepository.resumirHistoricoVendas(
                        termo,
                        clienteId,
                        produtoId,
                        inicio,
                        fim,
                        status,
                        forma,
                        parcelada
                );

        BigDecimal itens =
                vendaRepository.totalItensHistoricoVendas(
                        termo,
                        clienteId,
                        produtoId,
                        inicio,
                        fim,
                        status,
                        forma,
                        parcelada
                );

        return new ResumoHistoricoVendasResponseDTO(
                decimal(valores.getFaturamento()),
                numero(valores.getQuantidadeVendas()),
                itens != null
                        ? itens
                        : BigDecimal.ZERO,
                decimal(valores.getTicketMedio())
        );
    }

    @Transactional(readOnly = true)
    public ResumoHistoricoVendasResponseDTO resumirVendasIa(
            Long usuarioId, LocalDate inicio, LocalDate fim
    ) {
        usuarioAcessoService.buscarGestor(usuarioId);
        ResumoHistoricoVendasProjection valores = vendaRepository.resumirVendasIa(inicio, fim);
        BigDecimal itens = vendaRepository.totalItensVendasIa(inicio, fim);
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

        usuarioAcessoService.buscarGestor(usuarioId);

        int tamanhoSeguro =
                Math.min(Math.max(tamanho, 1), 100);

        Sort ordenacao =
                ordenacaoCobrancas(ordenarPor);

        PageRequest pageable =
                PageRequest.of(
                        Math.max(pagina, 0),
                        tamanhoSeguro,
                        ordenacao
                );

        Page<Venda> paginaEntidades =
                vendaRepository.findAll(
                        filtrosCobrancas(
                                busca,
                                clienteId,
                                produtoId,
                                inicio,
                                fim,
                                situacao,
                                forma,
                                parcelada
                        ),
                        pageable
                );

        if (paginaEntidades.isEmpty()) {

            return new PageImpl<>(
                    List.of(),
                    pageable,
                    paginaEntidades.getTotalElements()
            );
        }

        List<Long> ids =
                paginaEntidades
                        .getContent()
                        .stream()
                        .map(Venda::getId)
                        .toList();

        Map<Long, Venda> detalhes =
                vendaRepository
                        .buscarDetalhesPorIds(ids)
                        .stream()
                        .collect(
                                Collectors.toMap(
                                        Venda::getId,
                                        Function.identity()
                                )
                        );

        List<CobrancaResponseDTO> registros =
                ids.stream()
                        .map(detalhes::get)
                        .map(this::toCobrancaResponse)
                        .toList();

        return new PageImpl<>(
                registros,
                pageable,
                paginaEntidades.getTotalElements()
        );
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

        usuarioAcessoService.buscarGestor(usuarioId);

        LocalDate hoje =
                classificadorCobrancaService.hoje();

        String buscaNormalizada =
                normalizarBuscaResumo(busca);

        ResumoCobrancasProjection valores =
                vendaRepository.resumirCobrancas(
                        hoje,
                        hoje.minusDays(1),
                        hoje.minusDays(
                                ClassificadorCobrancaService
                                        .LIMITE_ATRASO_RECENTE_DIAS
                        ),
                        hoje.minusDays(
                                ClassificadorCobrancaService
                                        .LIMITE_ATRASO_RECENTE_DIAS + 1L
                        ),
                        hoje.minusDays(
                                ClassificadorCobrancaService
                                        .LIMITE_ATRASO_MEDIO_DIAS
                        ),
                        situacao != null
                                ? situacao.name()
                                : "",
                        buscaNormalizada,
                        clienteId,
                        produtoId,
                        inicio,
                        fim,
                        forma,
                        parcelada
                );

        return new ResumoCobrancasResponseDTO(
                decimal(valores.getTotalReceber()),
                decimal(valores.getTotalVencido()),
                decimal(valores.getTotalEmDia()),
                numero(valores.getQuantidadeAtrasadas()),
                numero(valores.getQuantidadeCobrancas())
        );
    }

    @Transactional(readOnly = true)
    public ResumoCobrancasResponseDTO resumirRecebiveisIa(
            Long usuarioId, LocalDate inicio, LocalDate fim, SituacaoCobranca situacao
    ) {
        usuarioAcessoService.buscarGestor(usuarioId);
        LocalDate hoje = classificadorCobrancaService.hoje();
        ResumoCobrancasProjection valores = vendaRepository.resumirRecebiveisIa(
                hoje,
                hoje.minusDays(1),
                hoje.minusDays(ClassificadorCobrancaService.LIMITE_ATRASO_RECENTE_DIAS),
                hoje.minusDays(ClassificadorCobrancaService.LIMITE_ATRASO_RECENTE_DIAS + 1L),
                hoje.minusDays(ClassificadorCobrancaService.LIMITE_ATRASO_MEDIO_DIAS),
                situacao != null ? situacao.name() : "",
                inicio,
                fim);
        return new ResumoCobrancasResponseDTO(
                decimal(valores.getTotalReceber()),
                decimal(valores.getTotalVencido()),
                decimal(valores.getTotalEmDia()),
                numero(valores.getQuantidadeAtrasadas()),
                numero(valores.getQuantidadeCobrancas()));
    }

    @Transactional
    public VendaResponseDTO confirmarPagamento(
            Long usuarioId,
            Long vendaId
    ) {

        Usuario gestor =
                usuarioAcessoService.buscarGestor(usuarioId);

        Venda venda =
                vendaRepository.buscarParaConfirmacao(vendaId)
                        .orElseThrow(
                                () -> new ResourceNotFoundException(
                                        "Cobrança não encontrada"
                                )
                        );

        if (venda.getStatusPagamento()
                == StatusPagamento.PAGO) {

            throw new ConflictException(
                    "Esta cobrança já foi confirmada como paga"
            );
        }

        if (venda.getStatusPagamento()
                != StatusPagamento.PENDENTE
                && venda.getStatusPagamento()
                != StatusPagamento.ATRASADO) {

            throw new BusinessException(
                    "Esta venda não possui uma cobrança pendente"
            );
        }

        StatusPagamento statusAnterior =
                venda.getStatusPagamento();

        venda.setStatusPagamento(
                StatusPagamento.PAGO
        );

        Venda salva =
                vendaRepository.save(venda);

        auditoriaService.registrar(
                gestor,
                "VENDA",
                salva.getId(),
                "CONFIRMACAO_PAGAMENTO",
                statusAnterior,
                StatusPagamento.PAGO,
                "Pagamento confirmado",
                "A_RECEBER"
        );

        return toResponse(salva);
    }

    @Transactional(readOnly = true)
    public VendaDuplicacaoResponseDTO prepararDuplicacao(
            Long usuarioId,
            Long id
    ) {

        usuarioAcessoService.buscarGestor(usuarioId);

        Venda venda =
                buscarVenda(id);

        List<String> avisos =
                new ArrayList<>();

        var itens =
                venda.getItens()
                        .stream()
                        .map(item -> {

                            Produto produto =
                                    item.getProduto();

                            if (item.getValorUnitario()
                                    .compareTo(
                                            produto.getPrecoVenda()
                                    ) != 0) {

                                avisos.add(
                                        "O preço de "
                                                + produto.getNome()
                                                + " mudou de "
                                                + item.getValorUnitario()
                                                + " para "
                                                + produto.getPrecoVenda()
                                );
                            }

                            if (produto.getEstoqueAtual()
                                    .compareTo(
                                            item.getQuantidade()
                                    ) < 0) {

                                avisos.add(
                                        "Estoque insuficiente para "
                                                + produto.getNome()
                                                + "; a venda ficará aguardando estoque"
                                );
                            }

                            return new VendaDuplicacaoResponseDTO.ItemDuplicacao(
                                    produto.getId(),
                                    produto.getNome(),
                                    item.getQuantidade(),
                                    item.getValorUnitario(),
                                    produto.getPrecoVenda(),
                                    produto.getEstoqueAtual()
                            );
                        })
                        .toList();

        return new VendaDuplicacaoResponseDTO(
                venda.getId(),
                venda.getCliente().getId(),
                venda.getCliente().getNome(),
                itens,
                avisos
        );
    }

    @Transactional
    public VendaResponseDTO adicionarContato(
            Long usuarioId,
            Long vendaId,
            ContatoRequestDTO dto
    ) {

        usuarioAcessoService.buscarGestor(usuarioId);

        Venda venda =
                buscarVenda(vendaId);

        List<ContatoDTO> contatos =
                lerContatos(venda.getContatos());

        contatos.add(
                ContatoDTO.builder()
                        .data(LocalDateTime.now())
                        .tipo(dto.getTipo())
                        .resposta(dto.getResposta())
                        .build()
        );

        venda.setContatos(
                escreverContatos(contatos)
        );

        return toResponse(
                vendaRepository.save(venda)
        );
    }

    private Cliente buscarCliente(Long clienteId) {

        if (clienteId == null) {

            throw new BusinessException(
                    "Selecione um cliente para registrar a venda"
            );
        }

        return clienteRepository
                .findById(clienteId)
                .orElseThrow(
                        () -> new ResourceNotFoundException(
                                "Cliente não encontrado"
                        )
                );
    }

    private Produto buscarProdutoDoGestor(
            Long produtoId,
            Usuario gestor
    ) {

        Produto produto = produtoRepository
                .findById(produtoId)
                .orElseThrow(
                        () -> new ResourceNotFoundException(
                                "Produto não encontrado"
                        )
                );
        if (!Boolean.TRUE.equals(produto.getAtivo())) {
            throw new BusinessException(
                    "O produto está removido e não pode ser usado em novas vendas"
            );
        }
        return produto;
    }

    private void baixarEstoque(
            Produto produto,
            BigDecimal quantidade
    ) {

        if (produto.getEstoqueAtual()
                .compareTo(quantidade) < 0) {

            throw new BusinessException(
                    "Estoque insuficiente para o produto "
                            + produto.getNome()
            );
        }

        produto.setEstoqueAtual(
                produto.getEstoqueAtual()
                        .subtract(quantidade)
        );
    }

    private Venda buscarVenda(Long id) {

        return vendaRepository
                .findById(id)
                .orElseThrow(
                        () -> new ResourceNotFoundException(
                                "Venda não encontrada"
                        )
                );
    }

    private Specification<Venda> filtrosCobrancas(
            String busca,
            Long clienteId,
            Long produtoId,
            LocalDate inicio,
            LocalDate fim,
            SituacaoCobranca situacao,
            FormaPagamento forma,
            Boolean parcelada
    ) {

        LocalDate hoje =
                classificadorCobrancaService.hoje();

        String termo =
                normalizarBusca(busca);

        return (root, query, builder) -> {

            List<Predicate> predicates =
                    new ArrayList<>();

            predicates.add(
                    builder.equal(
                            root.get("statusPagamento"),
                            StatusPagamento.PENDENTE
                    )
            );

            /*
             * Vendas aguardando estoque NUNCA aparecem em "a receber",
             * mesmo que o pagamento também esteja pendente. Elas só
             * entram aqui depois que a produção resolver o estoque.
             */
            predicates.add(
                    builder.equal(
                            root.get("aguardandoEstoque"),
                            false
                    )
            );

            if (clienteId != null) {

                predicates.add(
                        builder.equal(
                                root.get("cliente").get("id"),
                                clienteId
                        )
                );
            }

            if (inicio != null) {

                predicates.add(
                        builder.greaterThanOrEqualTo(
                                root.get("dataVencimento"),
                                inicio
                        )
                );
            }

            if (fim != null) {

                predicates.add(
                        builder.lessThanOrEqualTo(
                                root.get("dataVencimento"),
                                fim
                        )
                );
            }

            if (forma != null) {

                predicates.add(
                        builder.equal(
                                root.get("formaPagamento"),
                                forma
                        )
                );
            }

            if (parcelada != null) {

                Predicate possuiParcelas =
                        builder.greaterThan(
                                root.get("parcelas"),
                                1
                        );

                predicates.add(
                        parcelada
                                ? possuiParcelas
                                : builder.or(
                                        builder.isNull(
                                                root.get("parcelas")
                                        ),
                                        builder.lessThanOrEqualTo(
                                                root.get("parcelas"),
                                                1
                                        )
                                )
                );
            }

            if (produtoId != null) {

                predicates.add(
                        existeProduto(
                                root,
                                query.subquery(Long.class),
                                produtoId,
                                builder
                        )
                );
            }

            if (termo != null) {

                String like =
                        "%" + termo.toLowerCase() + "%";

                Subquery<Long> produtoPorNome =
                        query.subquery(Long.class);

                Root<ItemVenda> item =
                        produtoPorNome.from(ItemVenda.class);

                produtoPorNome
                        .select(item.get("id"))
                        .where(
                                builder.equal(
                                        item.get("venda"),
                                        root
                                ),
                                builder.like(
                                        builder.lower(
                                                item.get("produto")
                                                        .get("nome")
                                        ),
                                        like
                                )
                        );

                predicates.add(
                        builder.or(
                                builder.like(
                                        builder.lower(
                                                root.get("cliente")
                                                        .get("nome")
                                        ),
                                        like
                                ),
                                builder.like(
                                        builder.lower(
                                                root.get("cliente")
                                                        .get("email")
                                        ),
                                        like
                                ),
                                builder.like(
                                        builder.lower(
                                                root.get("cliente")
                                                        .get("telefone")
                                        ),
                                        like
                                ),
                                builder.like(
                                        builder.lower(
                                                root.get("observacao")
                                        ),
                                        like
                                ),
                                builder.exists(
                                        produtoPorNome
                                )
                        )
                );
            }

            adicionarFiltroSituacao(
                    predicates,
                    root,
                    builder,
                    situacao,
                    hoje
            );

            return builder.and(
                    predicates.toArray(Predicate[]::new)
            );
        };
    }

    private Specification<Venda> filtrosHistorico(
            String busca,
            Long clienteId,
            Long produtoId,
            LocalDate inicio,
            LocalDate fim,
            StatusPagamento status,
            FormaPagamento forma,
            Boolean parcelada
    ) {

        String termo =
                normalizarBusca(busca);

        return (root, query, builder) -> {

            List<Predicate> predicates =
                    new ArrayList<>();

            if (clienteId != null) {

                predicates.add(
                        builder.equal(
                                root.get("cliente").get("id"),
                                clienteId
                        )
                );
            }

            if (inicio != null) {

                predicates.add(
                        builder.greaterThanOrEqualTo(
                                root.get("dataVenda"),
                                inicio
                        )
                );
            }

            if (fim != null) {

                predicates.add(
                        builder.lessThanOrEqualTo(
                                root.get("dataVenda"),
                                fim
                        )
                );
            }

            if (status != null) {

                predicates.add(
                        builder.equal(
                                root.get("statusPagamento"),
                                status
                        )
                );
            }

            if (forma != null) {

                predicates.add(
                        builder.equal(
                                root.get("formaPagamento"),
                                forma
                        )
                );
            }

            if (parcelada != null) {

                Predicate possuiParcelas =
                        builder.greaterThan(
                                root.get("parcelas"),
                                1
                        );

                predicates.add(
                        parcelada
                                ? possuiParcelas
                                : builder.or(
                                        builder.isNull(
                                                root.get("parcelas")
                                        ),
                                        builder.lessThanOrEqualTo(
                                                root.get("parcelas"),
                                                1
                                        )
                                )
                );
            }

            if (produtoId != null) {

                predicates.add(
                        existeProduto(
                                root,
                                query.subquery(Long.class),
                                produtoId,
                                builder
                        )
                );
            }

            if (termo != null) {

                String like =
                        "%" + termo.toLowerCase() + "%";

                Subquery<Long> produtoPorNome =
                        query.subquery(Long.class);

                Root<ItemVenda> item =
                        produtoPorNome.from(ItemVenda.class);

                produtoPorNome
                        .select(item.get("id"))
                        .where(
                                builder.equal(
                                        item.get("venda"),
                                        root
                                ),
                                builder.like(
                                        builder.lower(
                                                item.get("produto")
                                                        .get("nome")
                                        ),
                                        like
                                )
                        );

                predicates.add(
                        builder.or(
                                builder.like(
                                        builder.lower(
                                                root.get("cliente")
                                                        .get("nome")
                                        ),
                                        like
                                ),
                                builder.like(
                                        builder.lower(
                                                root.get("observacao")
                                        ),
                                        like
                                ),
                                builder.exists(
                                        produtoPorNome
                                )
                        )
                );
            }

            return builder.and(
                    predicates.toArray(Predicate[]::new)
            );
        };
    }

    private Sort ordenacaoHistorico(
            String ordenarPor,
            Sort.Direction direcao
    ) {

        String campo =
                switch (
                        ordenarPor == null
                                ? ""
                                : ordenarPor
                ) {

                    case "valorTotal" ->
                            "valorTotal";

                    case "cliente" ->
                            "cliente.nome";

                    case "statusPagamento" ->
                            "statusPagamento";

                    default ->
                            "dataVenda";
                };

        return Sort.by(
                        direcao,
                        campo
                )
                .and(
                        Sort.by(
                                direcao,
                                "id"
                        )
                );
    }

    private Sort ordenacaoCobrancas(
            String ordenarPor
    ) {

        String campo =
                switch (
                        ordenarPor == null
                                ? ""
                                : ordenarPor
                ) {

                    case "cliente" ->
                            "cliente.nome";

                    case "valorTotal" ->
                            "valorTotal";

                    default ->
                            "dataVencimento";
                };

        return Sort.by(
                        Sort.Direction.ASC,
                        campo
                )
                .and(
                        Sort.by(
                                Sort.Direction.ASC,
                                "id"
                        )
                );
    }

    private Predicate existeProduto(
            Root<Venda> root,
            Subquery<Long> subquery,
            Long produtoId,
            jakarta.persistence.criteria.CriteriaBuilder builder
    ) {

        Root<ItemVenda> item =
                subquery.from(ItemVenda.class);

        subquery
                .select(item.get("id"))
                .where(
                        builder.equal(
                                item.get("venda"),
                                root
                        ),
                        builder.equal(
                                item.get("produto").get("id"),
                                produtoId
                        )
                );

        return builder.exists(subquery);
    }

    private void adicionarFiltroSituacao(
            List<Predicate> predicates,
            Root<Venda> root,
            jakarta.persistence.criteria.CriteriaBuilder builder,
            SituacaoCobranca situacao,
            LocalDate hoje
    ) {

        if (situacao == null) {
            return;
        }

        switch (situacao) {

            case EM_DIA -> {

                predicates.add(
                        builder.or(
                                builder.isNull(
                                        root.get("dataVencimento")
                                ),
                                builder.greaterThanOrEqualTo(
                                        root.get("dataVencimento"),
                                        hoje
                                )
                        )
                );
            }

            case ATRASO_RECENTE -> {

                predicates.add(
                        builder.and(
                                builder.lessThan(
                                        root.get("dataVencimento"),
                                        hoje
                                ),
                                builder.greaterThanOrEqualTo(
                                        root.get("dataVencimento"),
                                        hoje.minusDays(
                                                ClassificadorCobrancaService
                                                        .LIMITE_ATRASO_RECENTE_DIAS
                                        )
                                )
                        )
                );
            }

            case ATRASO_MEDIO -> {

                predicates.add(
                        builder.and(
                                builder.lessThan(
                                        root.get("dataVencimento"),
                                        hoje.minusDays(
                                                ClassificadorCobrancaService
                                                        .LIMITE_ATRASO_RECENTE_DIAS
                                        )
                                ),
                                builder.greaterThanOrEqualTo(
                                        root.get("dataVencimento"),
                                        hoje.minusDays(
                                                ClassificadorCobrancaService
                                                        .LIMITE_ATRASO_MEDIO_DIAS
                                        )
                                )
                        )
                );
            }

            case MUITO_ATRASADO -> {

                predicates.add(
                        builder.lessThan(
                                root.get("dataVencimento"),
                                hoje.minusDays(
                                        ClassificadorCobrancaService
                                                .LIMITE_ATRASO_MEDIO_DIAS
                                )
                        )
                );
            }
        }
    }

    private String normalizarBusca(String busca) {

        if (busca == null
                || busca.trim().isEmpty()) {

            return null;
        }

        return busca.trim();
    }

    private String normalizarBuscaResumo(
            String busca
    ) {

        String termo =
                normalizarBusca(busca);

        return termo != null
                ? termo
                : "";
    }

    /*
     * Aceita BigDecimal, Number e Object.
     *
     * Isso corrige o erro:
     * Object cannot be converted to BigDecimal.
     */
    private BigDecimal decimal(Object valor) {

        if (valor == null) {
            return BigDecimal.ZERO;
        }

        if (valor instanceof BigDecimal bigDecimal) {
            return bigDecimal;
        }

        if (valor instanceof Number number) {
            return BigDecimal.valueOf(
                    number.doubleValue()
            );
        }

        try {
            return new BigDecimal(
                    valor.toString()
            );
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }

    private Integer numero(Number valor) {

        return valor != null
                ? valor.intValue()
                : 0;
    }

    private List<ContatoDTO> lerContatos(
            String json
    ) {

        if (json == null
                || json.trim().isEmpty()) {

            return new ArrayList<>();
        }

        try {

            return objectMapper.readValue(
                    json,
                    new TypeReference<List<ContatoDTO>>() {}
            );

        } catch (Exception e) {

            return new ArrayList<>();
        }
    }

    private String escreverContatos(
            List<ContatoDTO> contatos
    ) {

        try {

            return objectMapper.writeValueAsString(
                    contatos
            );

        } catch (Exception e) {

            return "[]";
        }
    }

    private Boolean calcularEmAtraso(
            Venda venda
    ) {

        if (venda.getStatusPagamento()
                == StatusPagamento.PAGO) {

            return false;
        }

        if (venda.getDataVencimento() == null) {
            return false;
        }

        return venda.getDataVencimento()
                .isBefore(
                        classificadorCobrancaService.hoje()
                );
    }

    private String obterGestorNome(
            Venda venda
    ) {

        if (venda.getGestor() == null) {
            return null;
        }

        return venda.getGestor().getNome();
    }

    private List<ItemVendaResponseDTO> criarItensResponse(
            Venda venda
    ) {

        return venda.getItens()
                .stream()
                .map(item ->
                        ItemVendaResponseDTO.builder()
                                .id(item.getId())
                                .produtoId(
                                        item.getProduto().getId()
                                )
                                .produtoNome(
                                        item.getProduto().getNome()
                                )
                                .quantidade(
                                        item.getQuantidade()
                                )
                                .valorUnitario(
                                        item.getValorUnitario()
                                )
                                .valorTotal(
                                        item.getValorTotal()
                                )
                                .custoConsiderado(
                                        item.getCustoConsiderado()
                                )
                                .build()
                )
                .toList();
    }

    private VendaResponseDTO toResponse(
            Venda venda
    ) {

        List<ItemVendaResponseDTO> itens =
                criarItensResponse(venda);

        return VendaResponseDTO.builder()
                .id(venda.getId())
                .clienteId(
                        venda.getCliente().getId()
                )
                .clienteNome(
                        venda.getCliente().getNome()
                )
                .dataVenda(
                        venda.getDataVenda()
                )
                .formaPagamento(
                        venda.getFormaPagamento()
                )
                .statusPagamento(
                        venda.getStatusPagamento()
                )
                .valorTotal(
                        venda.getValorTotal()
                )
                .observacao(
                        venda.getObservacao()
                )
                .dataVencimento(
                        venda.getDataVencimento()
                )
                .tipoCartao(
                        venda.getTipoCartao()
                )
                .parcelas(
                        venda.getParcelas()
                )
                .emAtraso(
                        calcularEmAtraso(venda)
                )
                .aguardandoEstoque(
                        venda.getAguardandoEstoque()
                )
                .contatos(
                        lerContatos(
                                venda.getContatos()
                        )
                )
                .criadoEm(
                        venda.getCriadoEm()
                )
                .itens(itens)
                .build();
    }

    private VendaDetalhesResponseDTO toDetalhesResponse(
            Venda venda
    ) {

        List<ItemVendaResponseDTO> itens =
                criarItensResponse(venda);

        return VendaDetalhesResponseDTO.builder()
                .id(venda.getId())
                .clienteId(
                        venda.getCliente().getId()
                )
                .clienteNome(
                        venda.getCliente().getNome()
                )
                .clienteTelefone(
                        venda.getCliente().getTelefone()
                )
                .clienteEmail(
                        venda.getCliente().getEmail()
                )
                .clienteDocumento(null)
                .dataVenda(
                        venda.getDataVenda()
                )
                .formaPagamento(
                        venda.getFormaPagamento()
                )
                .statusPagamento(
                        venda.getStatusPagamento()
                )
                .valorTotal(
                        venda.getValorTotal()
                )
                .observacao(
                        venda.getObservacao()
                )
                .dataVencimento(
                        venda.getDataVencimento()
                )
                .tipoCartao(
                        venda.getTipoCartao()
                )
                .parcelas(
                        venda.getParcelas()
                )
                .emAtraso(
                        calcularEmAtraso(venda)
                )
                .gestorNome(
                        obterGestorNome(venda)
                )
                .contatos(
                        lerContatos(
                                venda.getContatos()
                        )
                )
                .criadoEm(
                        venda.getCriadoEm()
                )
                .itens(itens)
                .build();
    }

    private VendaHistoricoItemResponseDTO toHistoricoResponse(
            Venda venda,
            BigDecimal totalItens
    ) {

        return VendaHistoricoItemResponseDTO.builder()
                .id(venda.getId())
                .dataVenda(
                        venda.getDataVenda()
                )
                .clienteId(
                        venda.getCliente().getId()
                )
                .clienteNome(
                        venda.getCliente().getNome()
                )
                .quantidadeItens(
                        totalItens
                )
                .valorTotal(
                        venda.getValorTotal()
                )
                .formaPagamento(
                        venda.getFormaPagamento()
                )
                .parcelas(
                        venda.getParcelas()
                )
                .statusPagamento(
                        venda.getStatusPagamento()
                )
                .emAtraso(
                        calcularEmAtraso(venda)
                )
                .build();
    }

    private CobrancaResponseDTO toCobrancaResponse(
            Venda venda
    ) {

        SituacaoCobranca situacao =
                classificadorCobrancaService.classificar(
                        venda.getDataVencimento(),
                        venda.getStatusPagamento()
                );

        long diasAtraso =
                classificadorCobrancaService.calcularDiasAtraso(
                        venda.getDataVencimento(),
                        venda.getStatusPagamento()
                );

        List<ItemVendaResponseDTO> itens =
                criarItensResponse(venda);

        return CobrancaResponseDTO.builder()
                .id(venda.getId())
                .clienteId(
                        venda.getCliente().getId()
                )
                .clienteNome(
                        venda.getCliente().getNome()
                )
                .clienteTelefone(
                        venda.getCliente().getTelefone()
                )
                .clienteEmail(
                        venda.getCliente().getEmail()
                )
                .descricao(
                        venda.getObservacao()
                )
                .dataVenda(
                        venda.getDataVenda()
                )
                .dataVencimento(
                        venda.getDataVencimento()
                )
                .valor(
                        venda.getValorTotal()
                )
                .formaPagamento(
                        venda.getFormaPagamento()
                )
                .parcelas(
                        venda.getParcelas()
                )
                .diasAtraso(
                        diasAtraso
                )
                .situacao(
                        situacao
                )
                .gestorNome(
                        obterGestorNome(venda)
                )
                .itens(itens)
                .build();
    }
}
