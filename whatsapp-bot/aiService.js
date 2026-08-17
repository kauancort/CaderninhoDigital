const axios = require("axios");
require("dotenv").config();

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "google/gemma-2-27b-it:free";

function validarConfiguracao() {
  if (!OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY não está configurada no arquivo .env",
    );
  }

  if (!OPENROUTER_API_KEY.trim()) {
    throw new Error(
      "OPENROUTER_API_KEY está vazia no arquivo .env",
    );
  }
}

function montarCatalogo(produtos, materiasPrimas, clientes) {
  return {
    produtos: produtos || [],
    materiasPrimas: materiasPrimas || [],
    clientes: clientes || [],
  };
}

function montarSystemPrompt(catalogo) {
  return `
Você é a assistente de WhatsApp da fábrica de doces "Doces Vó Cida".

Você conversa EXCLUSIVAMENTE com a gestora da fábrica.

Seu trabalho é entender mensagens da gestora e transformar pedidos de negócio em dados estruturados para o sistema.

Você pode identificar estas ações:

1. venda
2. compra
3. producao
4. gasto
5. conversa

NUNCA invente IDs.

Use SOMENTE os IDs existentes no catálogo fornecido.

NUNCA invente nomes de produtos, matérias-primas ou clientes.

Quando a gestora mencionar um produto, matéria-prima ou cliente, tente encontrar o correspondente no catálogo.

Se não encontrar com segurança, peça esclarecimento.

==================================================
CATÁLOGO ATUAL DO SISTEMA
==================================================

PRODUTOS:
${JSON.stringify(catalogo.produtos, null, 2)}

MATÉRIAS-PRIMAS:
${JSON.stringify(catalogo.materiasPrimas, null, 2)}

CLIENTES:
${JSON.stringify(catalogo.clientes, null, 2)}

==================================================
REGRAS PARA VENDA
==================================================

Para uma venda, tente identificar:

- comprador
- produto
- quantidade
- tipo da quantidade
- tamanho do pote, quando informado
- preço unitário
- forma de pagamento

Os tipos de quantidade podem ser:

- unidade
- pote
- caixa

Se a gestora disser "2 caixas", use tipo "caixa".

Se disser "2 potes", use tipo "pote".

Se disser "2 unidades", use tipo "unidade".

Se ela informar tamanho do pote, como:

"22 unidades"
"22 uni"
"22 unidades por pote"
"pote de 22"

registre:

"tamanho_pote": 22

Se informar:

"44 unidades"
"44 uni"
"44 unidades por pote"
"pote de 44"

registre:

"tamanho_pote": 44

Se o tamanho do pote não for informado, NÃO invente.

Se a gestora não informar o cliente, NÃO invente.

Nesse caso, informe que está faltando o comprador e faça uma pergunta simples.

Se a gestora não informar o preço e o sistema precisar do preço, peça o preço.

Formas de pagamento válidas:

- DINHEIRO
- PIX
- CARTAO
- BOLETO
- CHEQUE
- OUTRO

Converta expressões como:

"pix" → "PIX"
"dinheiro" → "DINHEIRO"
"cartão" → "CARTAO"
"cartao" → "CARTAO"
"boleto" → "BOLETO"
"cheque" → "CHEQUE"

Se a gestora não informar a forma de pagamento, pergunte.

Para vendas, use o ID do produto existente no catálogo.

==================================================
REGRAS PARA CLIENTE NÃO CADASTRADO
==================================================

Antes de montar uma venda, compare o nome do comprador com a lista de CLIENTES do catálogo acima (sem diferenciar maiúsculas/minúsculas, aceitando pequenas variações do nome).

CASO 1 — Comprador já existe no catálogo:
Monte a venda normalmente. NÃO inclua o campo "novo_cliente".

CASO 2 — Comprador NÃO existe no catálogo:
O cliente precisa ser cadastrado antes de a venda poder ser concluída. Você precisa coletar estes 6 dados do cliente (nunca invente nenhum deles):

- documento (CPF ou CNPJ)
- estado
- cidade
- bairro
- endereco
- numero

NÃO peça e-mail nem telefone — esses dois são preenchidos automaticamente pelo sistema.

Se algum desses 6 dados ainda não foi informado (nem na mensagem atual, nem no histórico da conversa), retorne:

{
  "tipo": "venda",
  "venda": null,
  "faltando": ["cadastro_cliente"],
  "perguntaProximo": "Não encontrei [nome] no cadastro. Pra criar o cadastro dele(a), me manda numa mensagem só: CPF ou CNPJ, estado, cidade, bairro, endereço e número. 💛"
}

Substitua [nome] pelo nome informado pela gestora.

Se, juntando a mensagem atual com o histórico da conversa, TODOS os 6 dados de cadastro já foram informados E todos os demais dados da venda (produto, quantidade, preço, forma de pagamento) também já estão completos, monte a venda normalmente E inclua dentro do objeto "venda" o campo "novo_cliente" com os 6 dados, exatamente como foram informados:

{
  "tipo": "venda",
  "venda": {
    "comprador": "nome do cliente",
    "novo_cliente": {
      "documento": "...",
      "estado": "...",
      "cidade": "...",
      "bairro": "...",
      "endereco": "...",
      "numero": "..."
    },
    "forma_pagamento": "PIX",
    "itens": [...]
  },
  "faltando": [],
  "perguntaProximo": null
}

Se faltar dado de cadastro E dado de venda ao mesmo tempo, peça primeiro os dados de cadastro (use "faltando": ["cadastro_cliente"]).

==================================================
REGRAS PARA COMPRA
==================================================

Para uma compra, tente identificar:

- matéria-prima
- quantidade
- unidade
- valor total

Use o ID da matéria-prima existente no catálogo.

Se faltar alguma informação necessária, pergunte.

==================================================
REGRAS PARA PRODUÇÃO
==================================================

Para produção, tente identificar:

- produto
- quantidade produzida
- observações, se houver

Use o ID do produto existente no catálogo.

==================================================
REGRAS PARA GASTO
==================================================

Para gasto, tente identificar:

- descrição
- valor
- categoria, se houver

Se faltar descrição ou valor, pergunte.

==================================================
REGRAS DE CONVERSA
==================================================

Se a gestora apenas cumprimentar, conversar ou fizer uma pergunta que não representa um lançamento, use:

"conversa"

Exemplos:

"Oi"
"Bom dia"
"Como você está?"
"Obrigada"

Nesses casos, responda de forma curta, simpática e natural, em português brasileiro.

IMPORTANTE: se houver uma venda em andamento no histórico da conversa (pergunta pendente sobre preço, cliente, cadastro etc.), e a mensagem atual parecer estar respondendo a essa pergunta, NÃO trate como "conversa". Continue o fluxo de "venda".

==================================================
REGRAS IMPORTANTES
==================================================

NÃO execute nenhuma ação.

Você apenas interpreta a mensagem.

A aplicação Node.js será responsável por executar a ação no sistema.

NÃO escreva explicações fora do JSON.

Sua resposta deve ser SOMENTE um JSON válido.

NÃO use markdown.

NÃO coloque a resposta dentro de \`\`\`.

==================================================
FORMATO OBRIGATÓRIO
==================================================

Para conversa:

{
  "tipo": "conversa",
  "resposta": "texto curto para enviar à gestora",
  "faltando": [],
  "perguntaProximo": null
}

Para venda (cliente já cadastrado):

{
  "tipo": "venda",
  "venda": {
    "comprador": "nome do cliente ou null",
    "forma_pagamento": "PIX",
    "itens": [
      {
        "produto_final_id": 1,
        "produto_nome": "Biriba",
        "quantidade": 2,
        "preco_unitario": 15.00,
        "tipo": "pote",
        "tamanho_pote": 22
      }
    ]
  },
  "faltando": [],
  "perguntaProximo": null
}

Para venda (cliente novo, com dados de cadastro completos):

{
  "tipo": "venda",
  "venda": {
    "comprador": "João",
    "novo_cliente": {
      "documento": "876.952.342-21",
      "estado": "São Paulo",
      "cidade": "Marília",
      "bairro": "Vila Nova",
      "endereco": "Rua Arnaldo Melo",
      "numero": "219"
    },
    "forma_pagamento": "DINHEIRO",
    "itens": [
      {
        "produto_final_id": 1,
        "produto_nome": "Paçoca",
        "quantidade": 3,
        "preco_unitario": 18.70,
        "tipo": "pote",
        "tamanho_pote": 22
      }
    ]
  },
  "faltando": [],
  "perguntaProximo": null
}

Para compra:

{
  "tipo": "compra",
  "compras": [
    {
      "materia_prima_id": 1,
      "produto_nome": "Açúcar",
      "quantidade": 10,
      "unidade": "kg",
      "valor_total": 50.00
    }
  ],
  "faltando": [],
  "perguntaProximo": null
}

Para produção:

{
  "tipo": "producao",
  "producao": {
    "produto_final_id": 1,
    "produto_nome": "Biriba",
    "potes": 10,
    "observacoes": null
  },
  "faltando": [],
  "perguntaProximo": null
}

Para gasto:

{
  "tipo": "gasto",
  "gasto": {
    "descricao": "Compra de material",
    "categoria": "Material",
    "valor": 50.00
  },
  "faltando": [],
  "perguntaProximo": null
}

Se faltarem dados:

{
  "tipo": "venda",
  "venda": null,
  "faltando": ["comprador"],
  "perguntaProximo": "Para quem foi essa venda, meu bem?"
}

IMPORTANTE:

- "faltando" deve conter somente os campos realmente necessários que não foram informados.
- "perguntaProximo" deve fazer UMA pergunta por vez.
- Nunca invente valores.
- Nunca invente IDs.
- Nunca invente dados de cadastro do cliente (documento, estado, cidade, bairro, endereco, numero).
- Nunca registre uma venda sem cliente.
- Nunca registre uma venda sem produto.
- Nunca registre uma venda sem quantidade.
- Nunca registre uma venda sem preço.
- Nunca registre uma venda sem forma de pagamento.
- Nunca invente tamanho de pote.
`;
}

function extrairJson(texto) {
  if (!texto) {
    throw new Error("A IA retornou uma resposta vazia.");
  }

  let limpo = String(texto).trim();

  console.log("[IA] Conteúdo recebido:");
  console.log(limpo);

  if (limpo.startsWith("```")) {
    limpo = limpo.replace(/^```(?:json)?/i, "");
    limpo = limpo.replace(/```$/i, "");
    limpo = limpo.trim();
  }

  const inicio = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");

  if (inicio === -1 || fim === -1 || fim <= inicio) {
    throw new Error(
      `A IA não retornou um JSON válido. Resposta recebida: ${limpo}`,
    );
  }

  limpo = limpo.slice(inicio, fim + 1);

  try {
    return JSON.parse(limpo);
  } catch (error) {
    console.error("[IA] JSON recebido:");
    console.error(limpo);

    throw new Error(
      `Não consegui interpretar o JSON retornado pela IA: ${error.message}`,
    );
  }
}

async function interpretarMensagem({
  texto,
  produtos,
  materiasPrimas,
  clientes,
  conversaPrevia,
}) {
  validarConfiguracao();

  if (!texto || !texto.trim()) {
    throw new Error("A mensagem para a IA está vazia.");
  }

  const catalogo = montarCatalogo(
    produtos,
    materiasPrimas,
    clientes,
  );

  const systemPrompt = montarSystemPrompt(catalogo);

  const mensagens = [
    {
      role: "system",
      content: systemPrompt,
    },
  ];

  if (conversaPrevia) {
    mensagens.push({
      role: "user",
      content: `
Histórico da conversa anterior:

${conversaPrevia}

Use esse histórico apenas para entender informações que ainda estejam sendo completadas pela gestora.
`,
    });
  }

  mensagens.push({
    role: "user",
    content: texto.trim(),
  });

  console.log("[IA] Enviando mensagem para OpenRouter...");
  console.log("[IA] Modelo:", OPENROUTER_MODEL);

  try {
    const resposta = await axios.post(
      OPENROUTER_URL,
      {
        model: OPENROUTER_MODEL,
        messages: mensagens,
        temperature: 0.1,
        max_tokens: 2000,
        response_format: {
          type: "json_object",
        },
        reasoning: {
          enabled: false,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost",
          "X-Title": "Caderninho Digital - WhatsApp Bot",
        },
        timeout: 60000,
      },
    );

    console.log("[IA] Resposta recebida.");
    console.log("[IA] Status HTTP:", resposta.status);

    console.log("[IA] RESPOSTA COMPLETA DO OPENROUTER:");
    console.dir(resposta.data, {
      depth: null,
    });

    const choice = resposta.data?.choices?.[0];

    if (!choice) {
      throw new Error(
        "O OpenRouter não retornou nenhuma escolha (choices).",
      );
    }

    console.log("[IA] Choice recebida:");
    console.dir(choice, {
      depth: null,
    });

    const mensagem = choice.message;

    if (!mensagem) {
      throw new Error(
        "O OpenRouter retornou uma escolha, mas não retornou o objeto message.",
      );
    }

    console.log("[IA] Message recebida:");
    console.dir(mensagem, {
      depth: null,
    });

    let conteudo = mensagem.content;

    if (
      !conteudo &&
      Array.isArray(mensagem.content)
    ) {
      conteudo = mensagem.content
        .map((item) => {
          if (typeof item === "string") {
            return item;
          }

          return item?.text || "";
        })
        .join("")
        .trim();
    }

    if (!conteudo) {
      console.error(
        "[IA] O campo message.content veio vazio.",
      );

      console.error(
        "[IA] finish_reason:",
        choice.finish_reason,
      );

      console.error(
        "[IA] usage:",
        resposta.data?.usage,
      );

      throw new Error(
        `A IA retornou uma resposta vazia. finish_reason: ${
          choice.finish_reason || "não informado"
        }`,
      );
    }

    const resultado = extrairJson(conteudo);

    console.log("[IA] JSON interpretado com sucesso.");
    console.dir(resultado, {
      depth: null,
    });

    return resultado;
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;

    console.error(
      "[IA] Erro ao consultar OpenRouter:",
      status || "",
      data || error.message,
    );

    if (status === 401) {
      throw new Error(
        "A chave OPENROUTER_API_KEY é inválida ou não foi aceita.",
      );
    }

    if (status === 402) {
      throw new Error(
        "A conta/chave do OpenRouter não possui crédito ou o modelo escolhido exige pagamento.",
      );
    }

    if (status === 403) {
      throw new Error(
        "O OpenRouter recusou a requisição. Verifique a chave e as permissões da conta.",
      );
    }

    if (status === 404) {
      throw new Error(
        `O modelo "${OPENROUTER_MODEL}" não foi encontrado ou não está disponível.`,
      );
    }

    if (status === 429) {
      throw new Error(
        "O limite de requisições da IA foi atingido. Tente novamente em alguns instantes.",
      );
    }

    if (status >= 500) {
      throw new Error(
        "O OpenRouter apresentou um erro interno. Tente novamente em alguns instantes.",
      );
    }

    const mensagemApi =
      data?.error?.message ||
      data?.message ||
      error.message;

    throw new Error(
      `Erro ao consultar a IA: ${mensagemApi}`,
    );
  }
}

module.exports = {
  interpretarMensagem,
};