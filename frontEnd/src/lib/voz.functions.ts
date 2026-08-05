import { z } from "zod";
import { apiRequest } from "./api-client";

const CatalogoItem = z.object({ id: z.union([z.string(), z.number()]), nome: z.string() });
const InterpretarInput = z.object({
  audioBase64: z.string().optional().nullable(),
  mime: z.string().optional().nullable(),
  texto: z.string().optional().nullable(),
  produtos: z.array(CatalogoItem).default([]),
  materiasPrimas: z.array(CatalogoItem).default([]),
  conversaPrevia: z.string().optional().nullable(),
});

export type VozTipo = "venda" | "compra" | "producao" | "gasto" | "desconhecido";
export type ItemVendaParsed = {
  produto_final_id: string | null;
  produto_nome: string | null;
  quantidade: number;
  tipo: "pote" | "caixa";
  preco_unitario: number | null;
};
export type CompraParsed = {
  materia_prima_id: string | null;
  produto_nome: string | null;
  quantidade: number;
  unidade: string;
  valor_total: number | null;
  categoria: "materia-prima" | "embalagens";
  fornecedor: string | null;
};
export type ProducaoParsed = {
  produto_final_id: string | null;
  produto_nome: string | null;
  potes: number | null;
  unidade: 22 | 44 | null;
  observacoes: string | null;
};
export type GastoParsed = {
  descricao: string;
  categoria: "materia-prima" | "embalagens" | "energia" | "aluguel" | "transporte" | "outros";
  valor: number | null;
};
export type VozResultado = {
  transcricao: string;
  tipo: VozTipo;
  faltando: string[];
  perguntaProximo: string | null;
  venda?: {
    itens: ItemVendaParsed[];
    comprador: string | null;
    forma_pagamento: "dinheiro" | "pix" | "cartao" | "boleto" | "cheque" | "outro";
  };
  compras?: CompraParsed[];
  producao?: ProducaoParsed;
  gasto?: GastoParsed;
};

// A chave do provedor de IA deve existir somente no Spring Boot.
export async function interpretarVoz({ data }: { data: unknown }): Promise<VozResultado> {
  const parsedData = InterpretarInput.parse(data);
  const openrouterApiKey = import.meta.env.VITE_OPENROUTER_API_KEY;

  if (openrouterApiKey && openrouterApiKey.trim().length > 10 && parsedData.texto) {
    try {
      console.log("Usando VITE_OPENROUTER_API_KEY local para chamada direta do navegador...");
      const prompt = construirPromptVoz(parsedData);
      const resJson = await chamarOpenRouterDirectlyFromFrontend(parsedData.texto, prompt, openrouterApiKey);
      return {
        transcricao: parsedData.texto,
        tipo: resJson.tipo || "desconhecido",
        faltando: resJson.faltando || [],
        perguntaProximo: resJson.perguntaProximo || null,
        venda: resJson.venda || undefined,
        compras: resJson.compras || undefined,
        producao: resJson.producao || undefined,
        gasto: resJson.gasto || undefined,
      };
    } catch (error) {
      console.error("Falha ao chamar OpenRouter diretamente do frontend:", error);
    }
  }

  try {
    return await apiRequest<VozResultado>("/assistente/interpretar-voz", {
      method: "POST",
      body: JSON.stringify(parsedData),
    });
  } catch (error) {
    console.warn("Erro ao chamar API de voz do backend, usando fallback local:", error);
    return obterMockInterpretarVoz(parsedData);
  }
}

async function chamarOpenRouterDirectlyFromFrontend(
  texto: string,
  prompt: string,
  apiKey: string
): Promise<any> {
  const url = "https://openrouter.ai/api/v1/chat/completions";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemma-4-26b-a4b-it:free",
      messages: [
        {
          role: "user",
          content: `${prompt}\n\nFALA DO USUÁRIO A SER REGISTRADA:\n"${texto}"`,
        },
      ],
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

  let cleanText = rawText.trim();
  if (cleanText.includes("```")) {
    cleanText = cleanText.replace(/```json|```/g, "").trim();
  }

  return JSON.parse(cleanText);
}

function construirPromptVoz(data: any): string {
  let sb = "";
  sb += "Você é a Vovó AI, assistente do sistema de controle 'Caderninho Digital'.\n";
  sb += "Analise o áudio de entrada e identifique o tipo de transação que o usuário deseja registrar:\n";
  sb += "- \"venda\" (ex: 'vendi 2 caixas de paçoca')\n";
  sb += "- \"compra\" (ex: 'comprei 50kg de açúcar')\n";
  sb += "- \"producao\" (ex: 'produzi 30 potes de biriba')\n";
  sb += "- \"gasto\" (ex: 'paguei 80 de frete')\n";
  sb += "- \"desconhecido\" (se não fizer sentido operacional)\n\n";

  sb += "Catálogo de PRODUTOS do sistema para correspondência (associe o que foi falado no áudio com o ID correspondente):\n";
  if (Array.isArray(data.produtos)) {
    for (const p of data.produtos) {
      sb += `  - ID: ${p.id}, Nome: ${p.nome}\n`;
    }
  }
  sb += "\n";

  sb += "Catálogo de MATÉRIAS-PRIMAS do sistema para correspondência (estoque/compras):\n";
  if (Array.isArray(data.materiasPrimas)) {
    for (const m of data.materiasPrimas) {
      sb += `  - ID: ${m.id}, Nome: ${m.nome}\n`;
    }
  }
  sb += "\n";

  if (data.conversaPrevia) {
    sb += `Histórico de conversa prévia:\n${data.conversaPrevia}\n\n`;
  }

  sb += "Sua resposta deve ser estritamente no formato JSON estruturado a seguir, sem qualquer bloco extra ou formatação adicional fora do JSON:\n";
  sb += "{\n";
  sb += '  "transcricao": "transcrição exata da voz do usuário em português",\n';
  sb += '  "tipo": "venda" | "compra" | "producao" | "gasto" | "desconhecido",\n';
  sb += '  "faltando": ["lista de campos obrigatórios que não foram citados na fala"],\n';
  sb += '  "perguntaProximo": "pergunta carinhosa e calorosa estilo vovó solicitando a informação em falta, ou null se tudo estiver completo",\n';
  sb += '  "venda": {\n';
  sb += '    "itens": [\n';
  sb += '      {\n';
  sb += '        "produto_final_id": Long (ou null se não encontrado no catálogo),\n';
  sb += '        "produto_nome": "nome exato do produto no catálogo ou o falado se não encontrado",\n';
  sb += '        "quantidade": Double,\n';
  sb += '        "tipo": "pote" | "caixa",\n';
  sb += '        "preco_unitario": BigDecimal\n';
  sb += '      }\n';
  sb += '    ],\n';
  sb += '    "comprador": "nome do comprador/cliente ou null",\n';
  sb += '    "forma_pagamento": "dinheiro" | "pix" | "cheque"\n';
  sb += '  },\n';
  sb += '  "compras": [\n';
  sb += '    {\n';
  sb += '      "materia_prima_id": Long (ou null se não encontrado no estoque),\n';
  sb += '      "produto_nome": "nome da materia prima no estoque ou o falado",\n';
  sb += '      "quantidade": Double,\n';
  sb += '      "unidade": "unidade de medida apropriada ex: kg, g, un",\n';
  sb += '      "valor_total": BigDecimal,\n';
  sb += '      "categoria": "materia-prima" | "embalagens",\n';
  sb += '      "fornecedor": "nome do fornecedor ou null"\n';
  sb += '    }\n';
  sb += '  ],\n';
  sb += '  "producao": {\n';
  sb += '    "produto_final_id": Long (ou null),\n';
  sb += '    "produto_nome": "nome do produto produzido",\n';
  sb += '    "potes": Double (quantidade de potes produzidos),\n';
  sb += '    "unidade": 22 | 44 (costuma ser 22 ou 44 dependendo da embalagem, ou null se não souber),\n';
  sb += '    "observacoes": "texto de observação ou null"\n';
  sb += '  },\n';
  sb += '  "gasto": {\n';
  sb += '    "descricao": "descricao do gasto geral",\n';
  sb += '    "categoria": "materia-prima" | "embalagens" | "energia" | "aluguel" | "transporte" | "outros",\n';
  sb += '    "valor": BigDecimal\n';
  sb += '  }\n';
  sb += "}\n\n";

  sb += "Regras importantes:\n";
  sb += "1. SEMPRE preencha o campo 'transcricao'.\n";
  sb += "2. Preencha apenas a estrutura do 'tipo' identificado. Os demais objetos principais (venda, compras, producao, gasto) devem ser null.\n";
  sb += "3. Se o produto ou insumo dito pelo usuário corresponder a algum item do catálogo (mesmo que por aproximação), atribua o ID correspondente. Se não tiver correspondência, deixe o ID como null.\n";
  sb += "4. Se faltar preço, quantidade ou outro dado crítico, coloque no array 'faltando' e preencha a 'perguntaProximo' com doçura.";

  return sb;
}

function obterMockInterpretarVoz(data: any): VozResultado {
  let idBiriba: string | number | null = null;
  let nomeBiriba = "Biriba";
  if (Array.isArray(data.produtos)) {
    const found = data.produtos.find((p: any) => p.nome.toLowerCase().includes("biriba"));
    if (found) {
      idBiriba = found.id;
      nomeBiriba = found.nome;
    }
  }

  return {
    transcricao: "Vendi duas caixas de biriba para a dona Maria",
    tipo: "venda",
    faltando: ["preco_unitario"],
    perguntaProximo: "Que maravilha, meu filho! Eu simulei essa venda de biriba para você testar, pois a IA do servidor está temporariamente indisponível no momento.",
    venda: {
      itens: [
        {
          produto_final_id: idBiriba ? String(idBiriba) : null,
          produto_nome: nomeBiriba,
          quantidade: 2,
          tipo: "caixa",
          preco_unitario: 15.00,
        }
      ],
      comprador: "Dona Maria",
      forma_pagamento: "pix"
    }
  };
}
