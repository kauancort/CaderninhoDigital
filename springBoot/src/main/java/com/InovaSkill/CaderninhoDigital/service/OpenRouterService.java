package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.request.CatalogoItemDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.ConversaRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.InterpretarVozRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.MensagemConversaDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ConversaResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.VozResultadoResponseDTO;
import com.InovaSkill.CaderninhoDigital.entity.CompraMateriaPrima;
import com.InovaSkill.CaderninhoDigital.entity.Lancamento;
import com.InovaSkill.CaderninhoDigital.entity.MateriaPrima;
import com.InovaSkill.CaderninhoDigital.entity.Producao;
import com.InovaSkill.CaderninhoDigital.entity.Produto;
import com.InovaSkill.CaderninhoDigital.entity.Usuario;
import com.InovaSkill.CaderninhoDigital.entity.Venda;
import com.InovaSkill.CaderninhoDigital.exception.BusinessException;
import com.InovaSkill.CaderninhoDigital.repository.CompraMateriaPrimaRepository;
import com.InovaSkill.CaderninhoDigital.repository.LancamentoRepository;
import com.InovaSkill.CaderninhoDigital.repository.MateriaPrimaRepository;
import com.InovaSkill.CaderninhoDigital.repository.ProducaoRepository;
import com.InovaSkill.CaderninhoDigital.repository.ProdutoRepository;
import com.InovaSkill.CaderninhoDigital.repository.UsuarioRepository;
import com.InovaSkill.CaderninhoDigital.repository.VendaRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClient;

@Service
@RequiredArgsConstructor
@Slf4j
public class OpenRouterService {

    @Value("${app.openrouter.key:}")
    private String apiKey;

    @Value("${app.openrouter.url:https://openrouter.ai/api/v1/chat/completions}")
    private String apiUrl;

    @Value("${app.openrouter.model:openrouter/free}")
    private String model;

    private final ObjectMapper objectMapper;
    private final MateriaPrimaRepository materiaPrimaRepository;
    private final ProdutoRepository produtoRepository;
    private final VendaRepository vendaRepository;
    private final CompraMateriaPrimaRepository compraMateriaPrimaRepository;
    private final ProducaoRepository producaoRepository;
    private final LancamentoRepository lancamentoRepository;
    private final UsuarioRepository usuarioRepository;

    public VozResultadoResponseDTO interpretarVoz(InterpretarVozRequestDTO request) {
        validarConfiguracao();
        String prompt = construirPromptLancamento(request);
        try {
            String resposta = chamarOpenRouter(List.of(mensagem("user", prompt)));
            String json = removerCercaMarkdown(resposta);
            return objectMapper.readValue(json, VozResultadoResponseDTO.class);
        } catch (HttpStatusCodeException e) {
            log.error("Erro HTTP ao interpretar transcrição com OpenRouter: status={}", e.getStatusCode());
            throw new BusinessException("A assistente de voz está temporariamente indisponível");
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("Falha ao interpretar transcrição com OpenRouter: tipo={}", e.getClass().getSimpleName());
            throw new BusinessException("Não foi possível interpretar o lançamento. Tente novamente");
        }
    }

    public ConversaResponseDTO conversar(Long usuarioId, ConversaRequestDTO request) {
        Usuario gestor = usuarioRepository.findById(usuarioId)
                .orElseThrow(() -> new BusinessException("Usuário autenticado não encontrado"));
        validarConfiguracao();

        try {
            ArrayNode mensagens = objectMapper.createArrayNode();
            mensagens.add(mensagem("system", construirPromptConversa(gestor)));
            if (request.getHistorico() != null) {
                for (MensagemConversaDTO item : request.getHistorico()) {
                    mensagens.add(mensagem(
                            "usuario".equals(item.getAutor()) ? "user" : "assistant",
                            item.getTexto()));
                }
            }
            mensagens.add(mensagem("user", request.getMensagem()));
            return new ConversaResponseDTO(chamarOpenRouter(mensagens));
        } catch (HttpStatusCodeException e) {
            log.error("Erro HTTP ao conversar com OpenRouter: status={}", e.getStatusCode());
            throw new BusinessException("A conversa com a assistente está temporariamente indisponível");
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("Falha ao conversar com OpenRouter: tipo={}", e.getClass().getSimpleName());
            throw new BusinessException("A conversa com a assistente está temporariamente indisponível");
        }
    }

    private String chamarOpenRouter(List<? extends JsonNode> mensagens) {
        ArrayNode array = objectMapper.createArrayNode();
        array.addAll(mensagens);
        return chamarOpenRouter(array);
    }

    private String chamarOpenRouter(ArrayNode mensagens) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("model", model == null || model.isBlank() ? "openrouter/free" : model);
        body.set("messages", mensagens);

        String rawResponse = RestClient.create().post()
                .uri(java.net.URI.create(apiUrl))
                .header("Authorization", "Bearer " + apiKey)
                .header("HTTP-Referer", "https://caderninhodigital.com")
                .header("X-Title", "Caderninho Digital")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(String.class);

        try {
            String content = objectMapper.readTree(rawResponse)
                    .path("choices").path(0).path("message").path("content").asText();
            if (content == null || content.isBlank()) {
                throw new BusinessException("O provedor retornou uma resposta vazia");
            }
            return content.trim();
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("O provedor retornou uma resposta inválida");
        }
    }

    private ObjectNode mensagem(String role, String content) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("role", role);
        node.put("content", content);
        return node;
    }

    private void validarConfiguracao() {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("OpenRouter indisponível: chave não configurada");
            throw new BusinessException("A assistente está temporariamente indisponível");
        }
    }

    private String construirPromptConversa(Usuario gestor) {
        return """
                Você é a Vovó AI, assistente carinhosa do Caderninho Digital.
                Responda em português brasileiro, de forma paciente, direta e breve.
                Use somente o resumo operacional agregado abaixo.
                Não tente identificar clientes, fornecedores ou usuários.

                %s
                """.formatted(construirDadosSistemaContexto(gestor));
    }

    private String construirDadosSistemaContexto(Usuario gestor) {
        StringBuilder contexto = new StringBuilder("--- RESUMO OPERACIONAL SEM DADOS PESSOAIS ---\n");
        try {
            List<MateriaPrima> materias = materiaPrimaRepository.findByGestorOrderByNomeAsc(gestor);
            long abaixoMinimo = materias.stream()
                    .filter(item -> item.getEstoqueAtual().compareTo(item.getEstoqueMinimo()) < 0)
                    .count();
            contexto.append("Matérias-primas cadastradas: ").append(materias.size()).append('\n');
            contexto.append("Matérias-primas abaixo do mínimo: ").append(abaixoMinimo).append('\n');
        } catch (Exception e) {
            contexto.append("Resumo de matérias-primas indisponível.\n");
        }
        try {
            List<Produto> produtos = produtoRepository.findByGestorOrderByNomeAsc(gestor);
            contexto.append("Produtos cadastrados: ").append(produtos.size()).append('\n');
        } catch (Exception e) {
            contexto.append("Resumo de produtos indisponível.\n");
        }
        adicionarTotal(contexto, "Vendas", vendaRepository.findByGestorOrderByDataVendaDesc(gestor).stream()
                .map(Venda::getValorTotal).filter(Objects::nonNull).toList());
        adicionarTotal(contexto, "Compras", compraMateriaPrimaRepository.findByGestorOrderByDataCompraDesc(gestor).stream()
                .map(CompraMateriaPrima::getValorTotal).filter(Objects::nonNull).toList());
        adicionarTotal(contexto, "Lançamentos gerais", lancamentoRepository.findByGestorOrderByDataLancamentoDesc(gestor).stream()
                .map(Lancamento::getValorTotal).filter(Objects::nonNull).toList());
        List<Producao> producoes = producaoRepository.findByGestorOrderByDataProducaoDesc(gestor);
        BigDecimal quantidade = producoes.stream().map(Producao::getQuantidadeProduzida)
                .filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        contexto.append("Produções registradas: ").append(producoes.size()).append('\n');
        contexto.append("Quantidade total produzida: ").append(quantidade).append('\n');
        return contexto.toString();
    }

    private void adicionarTotal(StringBuilder contexto, String titulo, List<BigDecimal> valores) {
        BigDecimal total = valores.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        contexto.append(titulo).append(" registradas: ").append(valores.size()).append('\n');
        contexto.append("Valor agregado de ").append(titulo.toLowerCase()).append(": R$ ").append(total).append('\n');
    }

    private String construirPromptLancamento(InterpretarVozRequestDTO request) {
        return """
                Interprete a transcrição de um lançamento do Caderninho Digital.
                Transcrição: %s
                Produtos permitidos:
                %s
                Matérias-primas permitidas:
                %s
                Contexto anterior: %s

                Responda somente com JSON válido, sem markdown, compatível com este formato:
                {"transcricao":"texto","tipo":"venda|compra|producao|gasto|desconhecido",
                "faltando":[],"perguntaProximo":null,"venda":null,"compras":null,
                "producao":null,"gasto":null}
                Use apenas IDs presentes nos catálogos. Nunca invente IDs. Se faltar informação crítica,
                liste-a em "faltando" e não presuma o valor.
                """.formatted(
                request.getTexto(), catalogo(request.getProdutos()), catalogo(request.getMateriasPrimas()),
                request.getConversaPrevia() == null ? "nenhum" : request.getConversaPrevia());
    }

    private String catalogo(List<CatalogoItemDTO> itens) {
        if (itens == null || itens.isEmpty()) return "nenhum";
        return itens.stream().map(item -> item.getId() + ": " + item.getNome())
                .reduce((a, b) -> a + "\n" + b).orElse("nenhum");
    }

    private String removerCercaMarkdown(String resposta) {
        return resposta.replace("```json", "").replace("```", "").trim();
    }
}
