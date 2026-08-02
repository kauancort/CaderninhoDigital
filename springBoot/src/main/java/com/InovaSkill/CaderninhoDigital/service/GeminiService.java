package com.InovaSkill.CaderninhoDigital.service;

import com.InovaSkill.CaderninhoDigital.dto.request.CatalogoItemDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.ConversaRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.InterpretarVozRequestDTO;
import com.InovaSkill.CaderninhoDigital.dto.request.MensagemConversaDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.ConversaResponseDTO;
import com.InovaSkill.CaderninhoDigital.dto.response.VozResultadoResponseDTO;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
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

@Service
@RequiredArgsConstructor
@Slf4j
public class GeminiService {

    @Value("${app.gemini.key:}")
    private String apiKey;

    @Value("${app.gemini.url}")
    private String apiUrl;

    @Value("${app.openrouter.key:}")
    private String openrouterKey;

    @Value("${app.openrouter.url:https://openrouter.ai/api/v1/chat/completions}")
    private String openrouterUrl;

    @Value("${app.openrouter.model:google/gemini-2.5-flash}")
    private String openrouterModel;

    private final ObjectMapper objectMapper;
    private final MateriaPrimaRepository materiaPrimaRepository;
    private final ProdutoRepository produtoRepository;
    private final VendaRepository vendaRepository;
    private final CompraMateriaPrimaRepository compraMateriaPrimaRepository;
    private final ProducaoRepository producaoRepository;
    private final LancamentoRepository lancamentoRepository;
    private final UsuarioRepository usuarioRepository;

    public VozResultadoResponseDTO interpretarVoz(InterpretarVozRequestDTO request) {
        if (apiKey == null || apiKey.trim().isEmpty()) {
            log.warn("GEMINI_API_KEY não configurada. Retornando resposta mockada para testes.");
            return obterMockInterpretarVoz(request);
        }

        try {
            RestClient restClient = RestClient.create();

           String prompt = construirPromptVoz(request);
            if (request.getTextoTranscrito() != null && !request.getTextoTranscrito().isBlank()) {
                prompt = "Mensagem enviada por TEXTO pelo usuário (não há áudio, use este texto como base e copie-o no campo \"transcricao\"): \""
                        + request.getTextoTranscrito() + "\"\n\n" + prompt;
            }
            if (request.getTextoTranscrito() != null && !request.getTextoTranscrito().isBlank()) {
                prompt = "Mensagem enviada por TEXTO pelo usuário (não há áudio, use este texto como base e copie-o no campo \"transcricao\"): \""
                        + request.getTextoTranscrito() + "\"\n\n" + prompt;
            }

            ObjectNode requestBody = objectMapper.createObjectNode();
            ArrayNode contentsArray = requestBody.putArray("contents");
            ObjectNode contentObj = contentsArray.addObject();
            ArrayNode partsArray = contentObj.putArray("parts");

            // Parte 1: Audio (Base64)
            if (request.getAudioBase64() != null && !request.getAudioBase64().isEmpty()) {
                ObjectNode audioPart = partsArray.addObject();
                ObjectNode inlineData = audioPart.putObject("inlineData");
                
                // Normaliza o MIME type
                String mime = request.getMime();
                if (mime == null || mime.isEmpty()) {
                    mime = "audio/webm";
                } else if (mime.contains(";")) {
                    mime = mime.split(";")[0]; // remove codecs info
                }
                
                inlineData.put("mimeType", mime);
                inlineData.put("data", request.getAudioBase64());
            }

            // Parte 2: Texto (Prompt)
            ObjectNode textPart = partsArray.addObject();
            textPart.put("text", prompt);

            // Geração de JSON estruturado
            ObjectNode genConfig = requestBody.putObject("generationConfig");
            genConfig.put("responseMimeType", "application/json");

            String endpointUrl = apiUrl + "?key=" + apiKey;

            String rawResponse = restClient.post()
                    .uri(java.net.URI.create(endpointUrl))
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .body(String.class);

            JsonNode root = objectMapper.readTree(rawResponse);
            String jsonOutput = root.path("candidates")
                    .path(0)
                    .path("content")
                    .path("parts")
                    .path(0)
                    .path("text")
                    .asText();

            // Corrige possíveis blocos de código markdown que o modelo às vezes inclui mesmo com o request configurado
            if (jsonOutput.contains("```")) {
                jsonOutput = jsonOutput.replaceAll("```json|```", "").trim();
            }

            return objectMapper.readValue(jsonOutput, VozResultadoResponseDTO.class);

        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            String errorBody = e.getResponseBodyAsString();
            log.error("Erro HTTP ao chamar API do Gemini para interpretar voz (Status: {}): {}", e.getStatusCode(), errorBody, e);
            throw new RuntimeException("Erro ao processar a transcrição da voz. Código HTTP: " + e.getStatusCode() + ". Detalhes da API: " + errorBody, e);
        } catch (Exception e) {
            log.error("Erro ao chamar API do Gemini para interpretar voz: ", e);
            throw new RuntimeException("Erro ao processar a transcrição da voz. Detalhes: " + e.getMessage(), e);
        }
    }

    public ConversaResponseDTO conversar(Long usuarioId, ConversaRequestDTO request) {
        Usuario gestor;
        try {
            gestor = usuarioRepository.findById(usuarioId)
                    .orElseThrow(() -> new RuntimeException("Gestor não encontrado"));
        } catch (Exception e) {
            log.error("Erro ao carregar usuário gestor: ", e);
            return new ConversaResponseDTO("Oi, meu bem. Não consegui carregar suas anotações no momento. Tente novamente.");
        }

        boolean temOpenRouter = openrouterKey != null && !openrouterKey.trim().isEmpty();
        boolean temGemini = apiKey != null && !apiKey.trim().isEmpty();

        if (!temOpenRouter && !temGemini) {
            log.warn("Nenhuma chave de IA configurada (OPENROUTER_API_KEY ou GEMINI_API_KEY). Usando Mock Operacional Inteligente.");
            return obterMockConversaInteligente(gestor, request);
        }

        String systemPrompt = construirPromptConversa(gestor, request);

        if (temOpenRouter) {
            return chamarOpenRouter(systemPrompt, request);
        } else {
            return chamarGeminiDirect(systemPrompt, request);
        }
    }

    private String construirPromptConversa(Usuario gestor, ConversaRequestDTO request) {
        StringBuilder sb = new StringBuilder();
        sb.append("Você é a Vovó AI, uma senhora muito carinhosa, afetuosa, acolhedora e experiente que auxilia o usuário a gerenciar sua pequena fábrica de doces artesanais (especialmente Biriba, Paçoca e Fondant de leite).\n");
        sb.append("Instruções de tom:\n");
        sb.append("- Responda sempre em português brasileiro de forma doce e paciente.\n");
        sb.append("- Use expressões afetuosas como 'meu filho', 'minha filha', 'meu bem', 'querido(a)'.\n");
        sb.append("- Dê conselhos práticos e encorajadores sobre negócios, estoque, vendas e lucros.\n");
        sb.append("- Seja calorosa, mas direta nas respostas, evitando textos extremamente longos.\n");
        sb.append("- Utilize os dados de estoque, vendas, compras, lançamentos e produção reais fornecidos abaixo para responder às perguntas do usuário com precisão.\n\n");

        sb.append(construirDadosSistemaContexto(gestor));
        sb.append("\n");

        return sb.toString();
    }

    private String construirDadosSistemaContexto(Usuario gestor) {
        StringBuilder sb = new StringBuilder();
        sb.append("--- INFORMAÇÕES DO SISTEMA (CADERNINHO DIGITAL) ---\n");
        sb.append("Gestor: ").append(gestor.getNome()).append(" (Email: ").append(gestor.getEmail()).append(")\n\n");

        // 1. ESTOQUE DE MATÉRIAS-PRIMAS
        sb.append("1. Estoque de Matérias-Primas:\n");
        try {
            List<MateriaPrima> materias = materiaPrimaRepository.findByGestorOrderByNomeAsc(gestor);
            if (materias == null || materias.isEmpty()) {
                sb.append("  Nenhuma matéria-prima cadastrada.\n");
            } else {
                for (MateriaPrima mp : materias) {
                    sb.append("  - ").append(mp.getNome())
                      .append(": Atual = ").append(mp.getEstoqueAtual()).append(" ").append(mp.getUnidadeMedida())
                      .append(", Mínimo = ").append(mp.getEstoqueMinimo()).append(" ").append(mp.getUnidadeMedida());
                    if (mp.getEstoqueAtual().compareTo(mp.getEstoqueMinimo()) < 0) {
                        sb.append(" [ESTOQUE BAIXO - RECOMENDA-SE COMPRAR]");
                    }
                    sb.append("\n");
                }
            }
        } catch (Exception e) {
            log.error("Erro ao buscar matérias-primas para o contexto: ", e);
            sb.append("  Erro ao obter estoque.\n");
        }
        sb.append("\n");

        // 2. PRODUTOS DO CATÁLOGO
        sb.append("2. Produtos para Venda:\n");
        try {
            List<Produto> produtos = produtoRepository.findByGestorOrderByNomeAsc(gestor);
            if (produtos == null || produtos.isEmpty()) {
                sb.append("  Nenhum produto cadastrado no catálogo.\n");
            } else {
                for (Produto p : produtos) {
                    sb.append("  - ID: ").append(p.getId()).append(", Nome: ").append(p.getNome()).append(" (SKU: ").append(p.getSku()).append(")\n");
                }
            }
        } catch (Exception e) {
            log.error("Erro ao buscar produtos para o contexto: ", e);
            sb.append("  Erro ao obter produtos.\n");
        }
        sb.append("\n");

        // 3. ÚLTIMAS VENDAS
        sb.append("3. Histórico de Vendas Recentes:\n");
        try {
            List<Venda> vendas = vendaRepository.findByGestorOrderByDataVendaDesc(gestor);
            if (vendas == null || vendas.isEmpty()) {
                sb.append("  Nenhuma venda registrada.\n");
            } else {
                int limite = Math.min(vendas.size(), 8);
                for (int i = 0; i < limite; i++) {
                    Venda v = vendas.get(i);
                    sb.append("  - Data: ").append(v.getDataVenda())
                      .append(", Cliente: ").append(v.getCliente() != null ? v.getCliente().getNome() : "Não Informado")
                      .append(", Valor Total: R$ ").append(v.getValorTotal())
                      .append(", Pagamento: ").append(v.getStatusPagamento())
                      .append(", Itens: ");
                    if (v.getItens() != null) {
                        List<String> itensStr = new ArrayList<>();
                        for (var item : v.getItens()) {
                            if (item.getProduto() != null) {
                                itensStr.add(item.getProduto().getNome() + " (Qtd: " + item.getQuantidade() + ")");
                            }
                        }
                        sb.append(String.join(", ", itensStr));
                    }
                    sb.append("\n");
                }
            }
        } catch (Exception e) {
            log.error("Erro ao buscar vendas para o contexto: ", e);
            sb.append("  Erro ao obter vendas.\n");
        }
        sb.append("\n");

        // 4. ÚLTIMAS PRODUÇÕES
        sb.append("4. Histórico de Produção Recente:\n");
        try {
            List<Producao> producoes = producaoRepository.findByGestorOrderByDataProducaoDesc(gestor);
            if (producoes == null || producoes.isEmpty()) {
                sb.append("  Nenhuma produção registrada.\n");
            } else {
                int limite = Math.min(producoes.size(), 8);
                for (int i = 0; i < limite; i++) {
                    Producao p = producoes.get(i);
                    sb.append("  - Data: ").append(p.getDataProducao())
                      .append(", Produto: ").append(p.getProduto() != null ? p.getProduto().getNome() : "Desconhecido")
                      .append(", Quantidade: ").append(p.getQuantidadeProduzida())
                      .append(" potes\n");
                }
            }
        } catch (Exception e) {
            log.error("Erro ao buscar produções para o contexto: ", e);
            sb.append("  Erro ao obter produções.\n");
        }
        sb.append("\n");

        // 5. COMPRAS RECENTES DE INSUMOS
        sb.append("5. Histórico de Compras de Matérias-Primas:\n");
        try {
            List<CompraMateriaPrima> compras = compraMateriaPrimaRepository.findByGestorOrderByDataCompraDesc(gestor);
            if (compras == null || compras.isEmpty()) {
                sb.append("  Nenhuma compra registrada.\n");
            } else {
                int limite = Math.min(compras.size(), 8);
                for (int i = 0; i < limite; i++) {
                    CompraMateriaPrima c = compras.get(i);
                    sb.append("  - Data: ").append(c.getDataCompra())
                      .append(", Fornecedor: ").append(c.getFornecedor() != null ? c.getFornecedor().getNome() : "Não Informado")
                      .append(", Valor Total: R$ ").append(c.getValorTotal())
                      .append(", Pagamento: ").append(c.getStatusPagamento());
                    if (c.getItens() != null) {
                        List<String> itensStr = new ArrayList<>();
                        for (var item : c.getItens()) {
                            if (item.getMateriaPrima() != null) {
                                itensStr.add(item.getMateriaPrima().getNome() + " (Qtd: " + item.getQuantidade() + " " + item.getMateriaPrima().getUnidadeMedida() + ")");
                            }
                        }
                        sb.append(", Itens: ").append(String.join(", ", itensStr));
                    }
                    sb.append("\n");
                }
            }
        } catch (Exception e) {
            log.error("Erro ao buscar compras para o contexto: ", e);
            sb.append("  Erro ao obter compras.\n");
        }
        sb.append("\n");

        // 6. LANÇAMENTOS FINANCEIROS GERAIS
        sb.append("6. Resumo Financeiro Recente (Outros Lançamentos):\n");
        try {
            List<Lancamento> lancs = lancamentoRepository.findByGestorOrderByDataLancamentoDesc(gestor);
            if (lancs == null || lancs.isEmpty()) {
                sb.append("  Nenhum lançamento financeiro registrado.\n");
            } else {
                int limite = Math.min(lancs.size(), 8);
                for (int i = 0; i < limite; i++) {
                    Lancamento l = lancs.get(i);
                    sb.append("  - Data: ").append(l.getDataLancamento())
                      .append(", Tipo: ").append(l.getTipo())
                      .append(", Descrição: ").append(l.getDescricao())
                      .append(", Valor: R$ ").append(l.getValorTotal())
                      .append(", Status: ").append(l.getStatusPagamento())
                      .append("\n");
                }
            }
        } catch (Exception e) {
            log.error("Erro ao buscar lançamentos para o contexto: ", e);
            sb.append("  Erro ao obter lançamentos.\n");
        }
        sb.append("\n-----------------------------------------------\n");
        return sb.toString();
    }

    private ConversaResponseDTO chamarOpenRouter(String systemPrompt, ConversaRequestDTO request) {
        try {
            RestClient restClient = RestClient.create();
            
            ObjectNode requestBody = objectMapper.createObjectNode();
            requestBody.put("model", openrouterModel != null && !openrouterModel.isEmpty() ? openrouterModel : "google/gemini-2.5-flash");
            
            ArrayNode messagesArray = requestBody.putArray("messages");
            
            // 1. Mensagem de Sistema
            ObjectNode systemMessage = messagesArray.addObject();
            systemMessage.put("role", "system");
            systemMessage.put("content", systemPrompt);
            
            // 2. Histórico de Conversa
            if (request.getHistorico() != null) {
                for (MensagemConversaDTO msg : request.getHistorico()) {
                    ObjectNode msgNode = messagesArray.addObject();
                    String role = "usuario".equals(msg.getAutor()) ? "user" : "assistant";
                    msgNode.put("role", role);
                    msgNode.put("content", msg.getTexto());
                }
            }
            
            // 3. Última mensagem do usuário
            ObjectNode userMessage = messagesArray.addObject();
            userMessage.put("role", "user");
            userMessage.put("content", request.getMensagem());
            
            log.info("Enviando requisição para OpenRouter com modelo: {}", requestBody.get("model").asText());

            String rawResponse = restClient.post()
                    .uri(java.net.URI.create(openrouterUrl))
                    .header("Authorization", "Bearer " + openrouterKey)
                    .header("HTTP-Referer", "https://caderninhodigital.com")
                    .header("X-Title", "Caderninho Digital")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .body(String.class);

            JsonNode root = objectMapper.readTree(rawResponse);
            
            String responseText = root.path("choices")
                    .path(0)
                    .path("message")
                    .path("content")
                    .asText();

            if (responseText == null || responseText.trim().isEmpty()) {
                log.warn("Resposta vazia do OpenRouter. Resposta bruta: {}", rawResponse);
                return new ConversaResponseDTO("Desculpe, meu filho, perguntei para o meu caderninho digital mas ele não soube responder. Pode tentar de novo?");
            }

            return new ConversaResponseDTO(responseText.trim());
            
        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            log.error("Erro HTTP ao chamar API do OpenRouter (Status: {}): {}", e.getStatusCode(), e.getResponseBodyAsString(), e);
            return new ConversaResponseDTO("Desculpe, meu filho, meu caderninho de anotações caiu no chão e me perdi. Pode tentar perguntar de novo? (Erro no OpenRouter: " + e.getStatusCode() + ")");
        } catch (Exception e) {
            log.error("Erro ao chamar API do OpenRouter para conversa: ", e);
            return new ConversaResponseDTO("Desculpe, meu filho, meu caderninho de anotações caiu no chão e me perdi. Pode tentar perguntar de novo? (Erro no OpenRouter)");
        }
    }

    private ConversaResponseDTO chamarGeminiDirect(String systemPrompt, ConversaRequestDTO request) {
        try {
            RestClient restClient = RestClient.create();

            // Monta o prompt concatenado com histórico
            StringBuilder promptBuilder = new StringBuilder();
            promptBuilder.append(systemPrompt).append("\n\n");
            promptBuilder.append("Histórico da conversa:\n");
            if (request.getHistorico() != null) {
                for (MensagemConversaDTO msg : request.getHistorico()) {
                    String autor = "usuario".equals(msg.getAutor()) ? "Usuário" : "Vovó AI";
                    promptBuilder.append(autor).append(": ").append(msg.getTexto()).append("\n");
                }
            }
            promptBuilder.append("Usuário: ").append(request.getMensagem()).append("\n");
            promptBuilder.append("Vovó AI: ");

            ObjectNode requestBody = objectMapper.createObjectNode();
            ArrayNode contentsArray = requestBody.putArray("contents");
            ObjectNode contentObj = contentsArray.addObject();
            ArrayNode partsArray = contentObj.putArray("parts");

            ObjectNode textPart = partsArray.addObject();
            textPart.put("text", promptBuilder.toString());

            String endpointUrl = apiUrl + "?key=" + apiKey;

            String rawResponse = restClient.post()
                    .uri(java.net.URI.create(endpointUrl))
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .body(String.class);

            JsonNode root = objectMapper.readTree(rawResponse);
            String responseText = root.path("candidates")
                    .path(0)
                    .path("content")
                    .path("parts")
                    .path(0)
                    .path("text")
                    .asText();

            return new ConversaResponseDTO(responseText.trim());

        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            log.error("Erro HTTP ao chamar API do Gemini para conversa (Status: {}): {}", e.getStatusCode(), e.getResponseBodyAsString(), e);
            return new ConversaResponseDTO("Desculpe, meu filho, meu caderninho de anotações caiu no chão e me perdi. Pode tentar perguntar de novo? (Erro no Gemini: " + e.getStatusCode() + ")");
        } catch (Exception e) {
            log.error("Erro ao chamar API do Gemini para conversa: ", e);
            return new ConversaResponseDTO("Desculpe, meu filho, meu caderninho de anotações caiu no chão e me perdi. Pode tentar perguntar de novo? (Erro no Gemini)");
        }
    }

    private ConversaResponseDTO obterMockConversaInteligente(Usuario gestor, ConversaRequestDTO request) {
        String msg = request.getMensagem().toLowerCase();
        
        // 1. Busca estoque baixo
        List<MateriaPrima> materias = materiaPrimaRepository.findByGestorOrderByNomeAsc(gestor);
        List<String> estoqueBaixo = new ArrayList<>();
        for (MateriaPrima mp : materias) {
            if (mp.getEstoqueAtual().compareTo(mp.getEstoqueMinimo()) < 0) {
                estoqueBaixo.add(mp.getNome() + " (Atual: " + mp.getEstoqueAtual() + " " + mp.getUnidadeMedida() + ", Mín: " + mp.getEstoqueMinimo() + " " + mp.getUnidadeMedida() + ")");
            }
        }

        // 2. Calcula finanças
        BigDecimal receitaVendas = BigDecimal.ZERO;
        List<Venda> vendas = vendaRepository.findByGestorOrderByDataVendaDesc(gestor);
        for (Venda v : vendas) {
            receitaVendas = receitaVendas.add(v.getValorTotal());
        }
        
        List<Lancamento> lancamentos = lancamentoRepository.findByGestorOrderByDataLancamentoDesc(gestor);
        for (Lancamento l : lancamentos) {
            if ("VENDA".equals(l.getTipo().name())) {
                receitaVendas = receitaVendas.add(l.getValorTotal());
            }
        }

        BigDecimal despesasCompras = BigDecimal.ZERO;
        List<CompraMateriaPrima> compras = compraMateriaPrimaRepository.findByGestorOrderByDataCompraDesc(gestor);
        for (CompraMateriaPrima c : compras) {
            despesasCompras = despesasCompras.add(c.getValorTotal());
        }

        BigDecimal despesasGerais = BigDecimal.ZERO;
        for (Lancamento l : lancamentos) {
            if ("GASTO_GERAL".equals(l.getTipo().name()) || "COMPRA_PRODUTO".equals(l.getTipo().name())) {
                despesasGerais = despesasGerais.add(l.getValorTotal());
            }
        }
        
        BigDecimal despesasTotais = despesasCompras.add(despesasGerais);
        BigDecimal lucroDocinho = receitaVendas.subtract(despesasTotais);

        List<Producao> producoes = producaoRepository.findByGestorOrderByDataProducaoDesc(gestor);

        // 3. Resposta baseada em palavras-chave
        if (msg.contains("lucro") || msg.contains("faturamento") || msg.contains("ganh") || msg.contains("rend") || msg.contains("financeiro") || msg.contains("vendi")) {
            return new ConversaResponseDTO(
                "Ah, meu querido " + gestor.getNome() + ", os lucros são o doce fruto do seu trabalho! 🍯 Dando uma olhada por cima no seu caderninho digital:\n\n" +
                "- **Faturamento Total**: R$ " + receitaVendas + "\n" +
                "- **Custos e Despesas**: R$ " + despesasTotais + "\n" +
                "- **Lucro Líquido**: R$ " + lucroDocinho + "\n\n" +
                (lucroDocinho.compareTo(BigDecimal.ZERO) > 0 
                  ? "Que bênção! Estamos no azul. Continue controlando tudo com carinho, meu bem."
                  : "Parece que as despesas estão altas, querido. Vamos dar uma olhada onde podemos economizar?") +
                "\n\n*(Lembre-se: Configure a chave `OPENROUTER_API_KEY` para que eu use inteligência artificial completa para prever suas próximas vendas!)*"
            );
        } else if (msg.contains("estoque") || msg.contains("falta") || msg.contains("compr") || msg.contains("ingrediente")) {
            if (estoqueBaixo.isEmpty()) {
                return new ConversaResponseDTO(
                    "Meu filho, manter os ingredientes em dia é o segredo de um bom doce! 🥐 Dei uma olhada detalhada no seu estoque e **está tudo em ordem**!\n\n" +
                    "Nenhuma matéria-prima está abaixo do limite mínimo recomendado. Que orgulho de você!\n\n" +
                    "*(Lembre-se: Configure a chave `OPENROUTER_API_KEY` para previsões e alertas avançados com IA!)*"
                );
            } else {
                StringBuilder sb = new StringBuilder();
                sb.append("Meu filho, manter os ingredientes em dia é o segredo de um bom doce! 🥐 Dei uma olhada detalhada no armário e notei que os seguintes insumos estão abaixo do estoque mínimo:\n\n");
                for (String item : estoqueBaixo) {
                    sb.append("- ").append(item).append("\n");
                }
                sb.append("\nRecomendo fazer uma comprinha de reposição para não deixar faltar nada no tacho. Quer ajuda para registrar?\n\n");
                sb.append("*(Lembre-se: Configure a chave `OPENROUTER_API_KEY` para eu gerar listas de compras inteligentes para você!)*");
                return new ConversaResponseDTO(sb.toString());
            }
        } else if (msg.contains("produ") || msg.contains("doce") || msg.contains("biriba") || msg.contains("paçoca") || msg.contains("fondant")) {
            if (producoes.isEmpty()) {
                return new ConversaResponseDTO(
                    "Minha filha, produzir com amor é o ingrediente secreto! 🧁 Vejo que você ainda não registrou nenhuma produção recente no caderninho.\n\n" +
                    "Que tal registrar sua primeira produção de doces hoje para que eu possa te ajudar a planejar?\n\n" +
                    "*(Lembre-se: Configure a chave `OPENROUTER_API_KEY` para previsões de demanda e sugestões de quanto produzir!)*"
                );
            } else {
                Producao ultima = producoes.get(0);
                return new ConversaResponseDTO(
                    "Minha filha, produzir com amor é o ingrediente secreto! 🧁 No seu histórico, a última produção registrada foi de **" + 
                    ultima.getQuantidadeProduzida() + " potes** de **" + (ultima.getProduto() != null ? ultima.getProduto().getNome() : "Doce") + 
                    "** no dia " + ultima.getDataProducao() + ".\n\n" +
                    (estoqueBaixo.isEmpty() 
                      ? "Como seu estoque está em ordem, você pode continuar produzindo de acordo com os pedidos, querido." 
                      : "Atenção: como temos insumos baixos no estoque, recomendo comprar o que falta antes de iniciar a próxima grande produção!") +
                    "\n\n*(Lembre-se: Configure a chave `OPENROUTER_API_KEY` para eu prever qual doce venderá mais nas próximas semanas!)*"
                );
            }
        } else {
            return new ConversaResponseDTO(
                "Oi, meu bem " + gestor.getNome() + "! Que bom ver você na cozinha. 💛\n\n" +
                "Eu sou a **Vovó AI** e estou aqui no seu caderninho digital para ajudar nas decisões sobre compras, produção e próximas vendas.\n\n" +
                "Para conversarmos com inteligência artificial de verdade, peça para configurar a chave `OPENROUTER_API_KEY` nas variáveis de ambiente do backend. Enquanto isso, eu analisei seu caderninho e montei esse painel para você:\n\n" +
                "### 📊 Painel de Decisões da Vovó\n" +
                "- **Estoque**: " + (estoqueBaixo.isEmpty() ? "✅ Tudo em ordem!" : "⚠️ " + estoqueBaixo.size() + " insumos baixos.") + "\n" +
                "- **Última Produção**: " + (producoes.isEmpty() ? "Nenhuma registrada." : (producoes.get(0).getProduto() != null ? producoes.get(0).getProduto().getNome() : "Doce") + " (" + producoes.get(0).getQuantidadeProduzida() + " potes)") + "\n" +
                "- **Finanças do Mês**: Lucro estimado de R$ " + lucroDocinho + "\n\n" +
                "Fique à vontade para me perguntar sobre o lucro, estoque ou produções. Pegue um pedaço de bolo e continue registrando tudo!"
            );
        }
    }

    private String construirPromptVoz(InterpretarVozRequestDTO request) {
        StringBuilder sb = new StringBuilder();
        sb.append("Você é a Vovó AI, assistente do sistema de controle 'Caderninho Digital'.\n");
        sb.append("Analise o áudio de entrada e identifique o tipo de transação que o usuário deseja registrar:\n");
        sb.append("- \"venda\" (ex: 'vendi 2 caixas de paçoca')\n");
        sb.append("- \"compra\" (ex: 'comprei 50kg de açúcar')\n");
        sb.append("- \"producao\" (ex: 'produzi 30 potes de biriba')\n");
        sb.append("- \"gasto\" (ex: 'paguei 80 de frete')\n");
        sb.append("- \"desconhecido\" (se não fizer sentido operacional)\n\n");

        sb.append("Catálogo de PRODUTOS do sistema para correspondência (associe o que foi falado no áudio com o ID correspondente):\n");
        if (request.getProdutos() != null) {
            for (CatalogoItemDTO p : request.getProdutos()) {
                sb.append("  - ID: ").append(p.getId()).append(", Nome: ").append(p.getNome()).append("\n");
            }
        }
        sb.append("\n");

        sb.append("Catálogo de MATÉRIAS-PRIMAS do sistema para correspondência (estoque/compras):\n");
        if (request.getMateriasPrimas() != null) {
            for (CatalogoItemDTO m : request.getMateriasPrimas()) {
                sb.append("  - ID: ").append(m.getId()).append(", Nome: ").append(m.getNome()).append("\n");
            }
        }
        sb.append("\n");

        if (request.getConversaPrevia() != null && !request.getConversaPrevia().isEmpty()) {
            sb.append("Histórico de conversa prévia:\n").append(request.getConversaPrevia()).append("\n\n");
        }

        sb.append("Sua resposta deve ser estritamente no formato JSON estruturado a seguir, sem qualquer bloco extra ou formatação adicional fora do JSON:\n");
        sb.append("{\n");
        sb.append("  \"transcricao\": \"transcrição exata da voz do usuário em português\",\n");
        sb.append("  \"tipo\": \"venda\" | \"compra\" | \"producao\" | \"gasto\" | \"desconhecido\",\n");
        sb.append("  \"faltando\": [\"lista de campos obrigatórios que não foram citados na fala\"],\n");
        sb.append("  \"perguntaProximo\": \"pergunta carinhosa e calorosa estilo vovó solicitando a informação em falta, ou null se tudo estiver completo\",\n");
        
        sb.append("  \"venda\": {\n");
        sb.append("    \"itens\": [\n");
        sb.append("      {\n");
        sb.append("        \"produto_final_id\": Long (ou null se não encontrado no catálogo),\n");
        sb.append("        \"produto_nome\": \"nome exato do produto no catálogo ou o falado se não encontrado\",\n");
        sb.append("        \"quantidade\": Double,\n");
        sb.append("        \"tipo\": \"pote\" | \"caixa\",\n");
        sb.append("        \"preco_unitario\": BigDecimal\n");
        sb.append("      }\n");
        sb.append("    ],\n");
        sb.append("    \"comprador\": \"nome do comprador/cliente ou null\",\n");
        sb.append("    \"forma_pagamento\": \"dinheiro\" | \"pix\" | \"cartao\"\n");
        sb.append("  },\n");

        sb.append("  \"compras\": [\n");
        sb.append("    {\n");
        sb.append("      \"materia_prima_id\": Long (ou null se não encontrado no estoque),\n");
        sb.append("      \"produto_nome\": \"nome da materia prima no estoque ou o falado\",\n");
        sb.append("      \"quantidade\": Double,\n");
        sb.append("      \"unidade\": \"unidade de medida apropriada ex: kg, g, un\",\n");
        sb.append("      \"valor_total\": BigDecimal,\n");
        sb.append("      \"categoria\": \"materia-prima\" | \"embalagens\",\n");
        sb.append("      \"fornecedor\": \"nome do fornecedor ou null\"\n");
        sb.append("    }\n");
        sb.append("  ],\n");

        sb.append("  \"producao\": {\n");
        sb.append("    \"produto_final_id\": Long (ou null),\n");
        sb.append("    \"produto_nome\": \"nome do produto produzido\",\n");
        sb.append("    \"potes\": Double (quantidade de potes produzidos),\n");
        sb.append("    \"unidade\": 22 | 44 (costuma ser 22 ou 44 dependendo da embalagem, ou null se não souber),\n");
        sb.append("    \"observacoes\": \"texto de observação ou null\"\n");
        sb.append("  },\n");

        sb.append("  \"gasto\": {\n");
        sb.append("    \"descricao\": \"descricao do gasto geral\",\n");
        sb.append("    \"categoria\": \"materia-prima\" | \"embalagens\" | \"energia\" | \"aluguel\" | \"transporte\" | \"outros\",\n");
        sb.append("    \"valor\": BigDecimal\n");
        sb.append("  }\n");
        sb.append("}\n\n");

        sb.append("Regras importantes:\n");
        sb.append("1. SEMPRE preencha o campo 'transcricao'.\n");
        sb.append("2. Preencha apenas a estrutura do 'tipo' identificado. Os demais objetos principais (venda, compras, producao, gasto) devem ser null.\n");
        sb.append("3. Se o produto ou insumo dito pelo usuário corresponder a algum item do catálogo (mesmo que por aproximação), atribua o ID correspondente. Se não tiver correspondência, deixe o ID como null.\n");
        sb.append("4. Se faltar preço, quantidade ou outro dado crítico, coloque no array 'faltando' e preencha a 'perguntaProximo' com doçura.");

        return sb.toString();
    }

    private VozResultadoResponseDTO obterMockInterpretarVoz(InterpretarVozRequestDTO request) {
        VozResultadoResponseDTO mock = new VozResultadoResponseDTO();
        mock.setTranscricao("Vendi duas caixas de biriba para a dona Maria");
        mock.setTipo("venda");
        mock.setFaltando(Collections.emptyList());
        mock.setPerguntaProximo(null);

        VozResultadoResponseDTO.VendaDTO venda = new VozResultadoResponseDTO.VendaDTO();
        venda.setComprador("Dona Maria");
        venda.setForma_pagamento("pix");

        VozResultadoResponseDTO.ItemVendaDTO item = new VozResultadoResponseDTO.ItemVendaDTO();
        
        // Tenta achar Biriba no catálogo enviado
        Long idBiriba = null;
        String nomeBiriba = "Biriba";
        if (request.getProdutos() != null) {
            for (CatalogoItemDTO p : request.getProdutos()) {
                if (p.getNome().toLowerCase().contains("biriba")) {
                    idBiriba = p.getId();
                    nomeBiriba = p.getNome();
                    break;
                }
            }
        }
        
        item.setProduto_final_id(idBiriba);
        item.setProduto_nome(nomeBiriba);
        item.setQuantidade(2.0);
        item.setTipo("caixa");
        item.setPreco_unitario(new BigDecimal("15.00"));

        venda.setItens(List.of(item));
        mock.setVenda(venda);

        mock.setPerguntaProximo("Que maravilha, meu filho! Eu simulei essa venda de biriba para você testar, mas lembre-se de configurar a chave GEMINI_API_KEY no servidor para eu te ouvir de verdade.");
        mock.setFaltando(List.of("preco_unitario"));

        return mock;
    }
}
