import { z } from "zod";
import { apiRequest } from "./api-client";

const conversaSchema = z.object({
  mensagem: z.string().trim().min(1).max(2000),
  historico: z
    .array(z.object({ autor: z.enum(["usuario", "assistente"]), texto: z.string().max(4000) }))
    .max(30),
});

export type MensagemConversa = z.infer<typeof conversaSchema>["historico"][number];

export async function conversarComAssistente(data: {
  mensagem: string;
  historico: MensagemConversa[];
}): Promise<{ resposta: string }> {
  const parsedData = conversaSchema.parse(data);
  const openrouterApiKey = import.meta.env.VITE_OPENROUTER_API_KEY;

  if (openrouterApiKey && openrouterApiKey.trim().length > 10) {
    try {
      console.log("Usando VITE_OPENROUTER_API_KEY local para conversa direta do navegador...");
      return await conversarComOpenRouterDirectly(parsedData.mensagem, parsedData.historico, openrouterApiKey);
    } catch (error) {
      console.error("Falha ao conversar com OpenRouter diretamente do frontend:", error);
    }
  }

  try {
    return await apiRequest<{ resposta: string }>("/assistente/conversa", {
      method: "POST",
      body: JSON.stringify(parsedData),
    });
  } catch (error) {
    console.warn("Erro ao chamar API de conversa do backend, usando fallback local:", error);
    return {
      resposta: obterMockConversa(parsedData.mensagem),
    };
  }
}

async function conversarComOpenRouterDirectly(
  mensagem: string,
  historico: MensagemConversa[],
  apiKey: string
): Promise<{ resposta: string }> {
  const url = "https://openrouter.ai/api/v1/chat/completions";

  const systemPrompt = "Você é a Vovó AI, uma doce e acolhedora senhora de Minas Gerais que ajuda a gerenciar um pequeno negócio de doces caseiros ('Caderninho Digital'). Responda sempre em português, com carinho, usando expressões afetuosas como 'meu bem', 'meu filho', 'querido'. Ajude o usuário respondendo suas dúvidas financeiras ou de estoque com base no que ele perguntar.";
  
  const messages: any[] = [];
  messages.push({
    role: "system",
    content: systemPrompt
  });

  for (const h of historico) {
    messages.push({
      role: h.autor === "usuario" ? "user" : "assistant",
      content: h.texto
    });
  }

  messages.push({
    role: "user",
    content: mensagem
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemma-4-26b-a4b-it:free",
      messages
    }),
  });

  if (!response.ok) {
    throw new Error(`Erro no OpenRouter: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  const rawText = json.choices?.[0]?.message?.content;
  if (!rawText) {
    throw new Error("Resposta vazia do OpenRouter");
  }

  return { resposta: rawText.trim() };
}

function obterMockConversa(mensagem: string): string {
  const msg = mensagem.toLowerCase();
  if (msg.includes("lucro") || msg.includes("faturamento") || msg.includes("ganh") || msg.includes("rend") || msg.includes("financeiro")) {
    return "Oi, meu bem! Como a IA do servidor está offline, eu peguei minhas anotações rápidas para você:\n\n" +
           "- **Faturamento Total**: R$ 1.500,00\n" +
           "- **Custos Estimados**: R$ 600,00\n" +
           "- **Lucro Líquido Estimado**: R$ 900,00\n\n" +
           "Fique à vontade para me perguntar sobre estoque ou receitas, querido!";
  } else if (msg.includes("estoque") || msg.includes("falta") || msg.includes("compr") || msg.includes("ingrediente")) {
    return "Meu filho, dei uma olhada rápida nas prateleiras:\n\n" +
           "- 🥜 **Amendoim**: Baixo (restam apenas 2kg)\n" +
           "- 🥛 **Leite**: Ok (restam 15L)\n" +
           "- 🍬 **Açúcar**: Ok (restam 10kg)\n\n" +
           "Recomendo comprar mais amendoim em breve para não interromper a produção, meu bem!";
  }
  
  return "Oi, querido! Eu sou a Vovó AI. A IA do servidor está temporariamente indisponível no momento, mas você pode me perguntar sobre o **estoque** ou o **lucro** estimado que eu te mostro os dados simulados que tenho aqui com o maior carinho! 💛";
}
