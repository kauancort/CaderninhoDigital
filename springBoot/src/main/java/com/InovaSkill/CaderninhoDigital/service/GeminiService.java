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

@Service
@RequiredArgsConstructor
@Slf4j
public class GeminiService {

    @Value("${app.gemini.key:}")
    private String apiKey;

    @Value("${app.gemini.url}")
    private String apiUrl;

    private final ObjectMapper objectMapper;

    public VozResultadoResponseDTO interpretarVoz(InterpretarVozRequestDTO request) {
        if (apiKey == null || apiKey.trim().isEmpty()) {
            log.warn("GEMINI_API_KEY não configurada. Retornando resposta mockada para testes.");
            return obterMockInterpretarVoz(request);
        }

        try {
            RestClient restClient = RestClient.create();

            String prompt = construirPromptVoz(request);

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
                    .uri(endpointUrl)
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

        } catch (Exception e) {
            log.error("Erro ao chamar API do Gemini para interpretar voz: ", e);
            throw new RuntimeException("Erro ao processar a transcrição da voz. Detalhes: " + e.getMessage(), e);
        }
    }

    public ConversaResponseDTO conversar(ConversaRequestDTO request) {
        if (apiKey == null || apiKey.trim().isEmpty()) {
            log.warn("GEMINI_API_KEY não configurada. Retornando conversa mockada.");
            return obterMockConversa(request);
        }

        try {
            RestClient restClient = RestClient.create();

            String prompt = construirPromptConversa(request);

            ObjectNode requestBody = objectMapper.createObjectNode();
            ArrayNode contentsArray = requestBody.putArray("contents");
            ObjectNode contentObj = contentsArray.addObject();
            ArrayNode partsArray = contentObj.putArray("parts");

            ObjectNode textPart = partsArray.addObject();
            textPart.put("text", prompt);

            String endpointUrl = apiUrl + "?key=" + apiKey;

            String rawResponse = restClient.post()
                    .uri(endpointUrl)
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

        } catch (Exception e) {
            log.error("Erro ao chamar API do Gemini para conversa: ", e);
            return new ConversaResponseDTO("Desculpe, meu filho, meu caderninho de anotações caiu no chão e me perdi. Pode tentar perguntar de novo? (Erro interno da IA)");
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

    private String construirPromptConversa(ConversaRequestDTO request) {
        StringBuilder sb = new StringBuilder();
        sb.append("Você é a Vovó AI, uma senhora muito carinhosa, afetuosa, acolhedora e experiente que auxilia o usuário a gerenciar sua pequena fábrica de doces artesanais (especialmente Biriba, Paçoca e Fondant de leite).\n");
        sb.append("Instruções de tom:\n");
        sb.append("- Responda sempre em português brasileiro de forma doce e paciente.\n");
        sb.append("- Use expressões afetuosas como 'meu filho', 'minha filha', 'meu bem', 'querido(a)'.\n");
        sb.append("- Dê conselhos práticos e encorajadores sobre negócios, estoque, vendas e lucros.\n");
        sb.append("- Seja calorosa, mas direta nas respostas, evitando textos extremamente longos.\n\n");

        sb.append("Histórico da conversa:\n");
        if (request.getHistorico() != null) {
            for (MensagemConversaDTO msg : request.getHistorico()) {
                String autor = "usuario".equals(msg.getAutor()) ? "Usuário" : "Vovó AI";
                sb.append(autor).append(": ").append(msg.getTexto()).append("\n");
            }
        }
        sb.append("Usuário: ").append(request.getMensagem()).append("\n");
        sb.append("Vovó AI: ");

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

        // Se o usuário não passou uma chave, adiciona uma mensagem explicativa no perguntaProximo para fins didáticos
        mock.setPerguntaProximo("Que maravilha, meu filho! Eu simulei essa venda de biriba para você testar, mas lembre-se de configurar a chave GEMINI_API_KEY no servidor para eu te ouvir de verdade.");
        mock.setFaltando(List.of("preco_unitario")); // Força a exibição da pergunta

        return mock;
    }

    private ConversaResponseDTO obterMockConversa(ConversaRequestDTO request) {
        String msg = request.getMensagem().toLowerCase();
        String resp;

        if (msg.contains("lucro") || msg.contains("faturamento")) {
            resp = "Ah, meu querido, os lucros são o doce fruto do seu trabalho! Dando uma olhada por cima no seu caderninho, vejo que as vendas de Biriba estão indo muito bem. Mas para eu fazer as contas certinhas e te dar um relatório detalhado com a IA, você precisa configurar a chave GEMINI_API_KEY no servidor. Que tal dar uma olhada nisso?";
        } else if (msg.contains("estoque") || msg.contains("falta")) {
            resp = "Meu filho, manter os ingredientes em dia é o segredo de um bom doce! Eu posso monitorar as matérias-primas e te avisar quando o amendoim ou o açúcar estiverem acabando. Só preciso que você configure a chave GEMINI_API_KEY no docker-compose do backend para que eu possa analisar tudo com inteligência. Não deixe faltar açúcar no tacho!";
        } else {
            resp = "Oi, meu bem! Que bom ver você na cozinha. Eu sou a Vovó AI e posso te ajudar a gerenciar as vendas, compras e produções de doces por aqui. Para a gente conversar de verdade, peça para configurar a chave GEMINI_API_KEY no backend. Enquanto isso, coma um pedaço de bolo e continue registrando tudo no caderninho!";
        }

        return new ConversaResponseDTO(resp);
    }
}
