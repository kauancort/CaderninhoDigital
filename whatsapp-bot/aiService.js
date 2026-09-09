const axios = require("axios");
require("dotenv").config();

const OPENROUTER_URL =
  "https://openrouter.ai/api/v1/chat/completions";

const OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY;

const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL ||
  "meta-llama/llama-3.1-8b-instruct:free";

/* =========================================================
   CONFIGURAÇÃO
========================================================= */

function validarConfiguracao() {
  if (!OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY não está configurada no .env",
    );
  }

  if (!OPENROUTER_API_KEY.trim()) {
    throw new Error(
      "OPENROUTER_API_KEY está vazia no .env",
    );
  }
}

/* =========================================================
   CATÁLOGO
========================================================= */

function montarCatalogo(
  produtos,
  materiasPrimas,
) {
  return {
    produtos: produtos || [],
    materiasPrimas: materiasPrimas || [],
  };
}

/* =========================================================
   PROMPT
========================================================= */

function montarSystemPrompt(catalogo) {
  return `
Você é a assistente de WhatsApp da fábrica de doces "Doces Vó Cida".

Você conversa somente com a Gestora.

Sua função é interpretar a mensagem e retornar SOMENTE JSON válido.

NUNCA escreva explicações.
NUNCA escreva raciocínio.
NUNCA use Markdown.
NUNCA escreva texto antes do JSON.
NUNCA escreva texto depois do JSON.

==================================================
TIPOS
==================================================

Os tipos possíveis são:

"venda"
"compra"
"producao"
"gasto"
"conversa"
"desconhecido"

Nunca invente informações.

==================================================
PRODUTOS
==================================================

${JSON.stringify(catalogo.produtos)}

==================================================
MATÉRIAS-PRIMAS
==================================================

${JSON.stringify(catalogo.materiasPrimas)}

==================================================
ESTADO DA CONVERSA
==================================================

O estado enviado pelo sistema é a memória principal.

Se um campo já estiver preenchido:

NÃO apague.
NÃO transforme em null.
NÃO peça novamente.

A nova mensagem pode ser somente uma resposta curta.

Exemplo:

Estado:
comprador = "Maria"

Mensagem:
"Biriba"

Resultado:
comprador continua sendo "Maria"
e o produto passa a ser "Biriba".

==================================================
VENDA
==================================================

Uma venda possui:

comprador
novo_cliente
itens
forma_pagamento
tipo_cartao
parcelas

Cada item pode possuir:

produto_final_id
produto_nome
quantidade
tipo
tamanho_pote
preco_unitario

==================================================
CLIENTE
==================================================

Se a mensagem informar um cliente:

"venda para Maria"
"Maria comprou"
"cliente: Maria"

extraia:

comprador = "Maria"

Não invente cliente.

==================================================
CLIENTE NOVO
==================================================

Cliente novo precisa de:

documento
telefone
estado
cidade
bairro
endereco
numero

Telefone é obrigatório.

Não peça email.

Nunca invente nenhum desses dados.

Estado deve ser sigla:

São Paulo = SP
Rio de Janeiro = RJ
Minas Gerais = MG
Paraná = PR
Santa Catarina = SC

==================================================
QUANTIDADE
==================================================

"3 potes" = quantidade 3, tipo pote

"3 caixas" = quantidade 3, tipo caixa

Uma caixa possui 6 potes.

"3 unidades" = quantidade 3, tipo unidade

==================================================
TAMANHO
==================================================

22 unidades:

tamanho_pote = 22

44 unidades:

tamanho_pote = 44

Nunca invente tamanho.

==================================================
PREÇOS
==================================================

Fondant:

22 = 20.70
44 = 21.30

Biriba:

22 = 19.70
44 = 19.70

Paçoca:

22 = 18.70
44 = 18.70

Nunca pergunte o preço.

Nunca invente preço.

==================================================
PAGAMENTO
==================================================

DINHEIRO
PIX
CARTAO
BOLETO
CHEQUE
OUTRO

"pix" = PIX

"dinheiro" = DINHEIRO

"cartão" = CARTAO

"boleto" = BOLETO

"cheque" = CHEQUE

==================================================
CARTÃO
==================================================

Crédito:

forma_pagamento = CARTAO
tipo_cartao = CREDITO

Débito:

forma_pagamento = CARTAO
tipo_cartao = DEBITO

Se disser somente "cartão", não escolha crédito ou débito.

==================================================
PARCELAS
==================================================

Crédito precisa de parcelas.

"3 vezes" = parcelas 3

"5x" = parcelas 5

Nunca invente parcelas.

==================================================
ÁUDIO
==================================================

Interprete:

tres = 3
três = 3
vinte e duas = 22
quarenta e quatro = 44

==================================================
COMPRA
==================================================

Para compra:

materia_prima_id
produto_nome
quantidade
unidade
valor_total

==================================================
PRODUÇÃO
==================================================

Para produção:

produto_final_id
produto_nome
potes
observacoes

==================================================
GASTO
==================================================

Para gasto:

descricao
categoria
valor

==================================================
CONVERSA
==================================================

Use conversa somente para mensagens que não são operações.

Exemplos:

Oi
Bom dia
Obrigada

==================================================
REGRA MAIS IMPORTANTE
==================================================

O sistema pode enviar um ESTADO ATUAL.

Você deve PRESERVAR esse estado.

Se a mensagem trouxer apenas uma informação nova,
adicione essa informação ao estado existente.

Nunca devolva somente a informação nova.

Retorne a venda completa com os dados anteriores preservados.

==================================================
JSON
==================================================

Para venda:

{
  "tipo": "venda",
  "venda": {
    "comprador": null,
    "novo_cliente": null,
    "forma_pagamento": null,
    "tipo_cartao": null,
    "parcelas": null,
    "itens": []
  },
  "faltando": [],
  "perguntaProximo": null
}

Se faltar informação:

{
  "tipo": "venda",
  "venda": {
    "comprador": null,
    "novo_cliente": null,
    "forma_pagamento": null,
    "tipo_cartao": null,
    "parcelas": null,
    "itens": []
  },
  "faltando": ["produto"],
  "perguntaProximo": null
}

IMPORTANTE:

O JavaScript controla as perguntas.

Você deve principalmente identificar os dados.

Não invente dados.

RETORNE SOMENTE JSON.
`;
}

/* =========================================================
   JSON
========================================================= */

function extrairJson(texto) {
  if (!texto) {
    throw new Error(
      "A IA retornou uma resposta vazia.",
    );
  }

  let limpo = String(texto).trim();

  console.log("[IA] Conteúdo recebido:");
  console.log(limpo);

  limpo = limpo
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(limpo);
  } catch (_) {}

  const inicio = limpo.indexOf("{");

  if (inicio === -1) {
    throw new Error(
      "A IA não retornou um objeto JSON.",
    );
  }

  let profundidade = 0;
  let dentroString = false;
  let escape = false;

  for (
    let i = inicio;
    i < limpo.length;
    i++
  ) {
    const caractere = limpo[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (caractere === "\\") {
      escape = true;
      continue;
    }

    if (caractere === '"') {
      dentroString = !dentroString;
      continue;
    }

    if (dentroString) continue;

    if (caractere === "{") {
      profundidade++;
    }

    if (caractere === "}") {
      profundidade--;

      if (profundidade === 0) {
        const candidato =
          limpo.slice(inicio, i + 1);

        return JSON.parse(candidato);
      }
    }
  }

  throw new Error(
    "A IA começou um JSON, mas não terminou.",
  );
}

/* =========================================================
   OPENROUTER
========================================================= */

async function chamarOpenRouter(mensagens) {
  const resposta = await axios.post(
    OPENROUTER_URL,
    {
      model: OPENROUTER_MODEL,
      messages: mensagens,
      temperature: 0,
      max_tokens: 1200,
      response_format: {
        type: "json_object",
      },
    },
    {
      headers: {
        Authorization:
          `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type":
          "application/json",
        "HTTP-Referer":
          "http://localhost",
        "X-Title":
          "Caderninho Digital - WhatsApp Bot",
      },
      timeout: 60000,
    },
  );

  const choice =
    resposta.data?.choices?.[0];

  if (!choice) {
    throw new Error(
      "OpenRouter não retornou choices.",
    );
  }

  const mensagem = choice.message;

  if (!mensagem) {
    throw new Error(
      "OpenRouter não retornou message.",
    );
  }

  let conteudo = mensagem.content;

  if (Array.isArray(conteudo)) {
    conteudo = conteudo
      .map((item) =>
        typeof item === "string"
          ? item
          : item?.text || "",
      )
      .join("")
      .trim();
  }

  console.log(
    "[IA] finish_reason:",
    choice.finish_reason,
  );

  return {
    conteudo,
    finishReason:
      choice.finish_reason,
  };
}

/* =========================================================
   INTERPRETAR
========================================================= */

async function interpretarMensagem({
  texto,
  produtos,
  materiasPrimas,
  clientes,
  conversaPrevia,
  estadoAtual,
}) {
  validarConfiguracao();

  if (!texto || !texto.trim()) {
    throw new Error(
      "Mensagem vazia enviada para IA.",
    );
  }

  const catalogo =
    montarCatalogo(
      produtos,
      materiasPrimas,
    );

  const systemPrompt =
    montarSystemPrompt(catalogo);

  const estadoTexto = estadoAtual
    ? JSON.stringify(
        estadoAtual,
        null,
        2,
      )
    : "Nenhum estado.";

  const mensagens = [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: `
ESTADO ATUAL:

${estadoTexto}

HISTÓRICO:

${conversaPrevia || "Nenhum histórico."}

NOVA MENSAGEM:

${texto.trim()}

Use o estado atual como memória.

Preserve os dados existentes.

Adicione somente os dados identificados na nova mensagem.

RETORNE SOMENTE JSON.
`,
    },
  ];

  console.log(
    "[IA] Enviando para OpenRouter...",
  );

  console.log(
    "[IA] Modelo:",
    OPENROUTER_MODEL,
  );

  let primeira;

  try {
    primeira =
      await chamarOpenRouter(
        mensagens,
      );
  } catch (error) {
    console.error(
      "[IA] ERRO OPENROUTER:",
      error.response?.data ||
        error.message,
    );

    throw error;
  }

  let conteudo =
    primeira.conteudo;

  /*
   * Retry somente quando vier vazio.
   */
  if (!conteudo) {
    console.warn(
      "[IA] Resposta vazia. Tentando novamente...",
    );

    const segunda =
      await chamarOpenRouter(
        mensagens,
      );

    conteudo =
      segunda.conteudo;

    if (!conteudo) {
      throw new Error(
        `IA retornou vazio duas vezes. finish_reason: ${
          segunda.finishReason ||
          primeira.finishReason ||
          "desconhecido"
        }`,
      );
    }
  }

  try {
    const resultado =
      extrairJson(conteudo);

    console.log(
      "[IA] JSON interpretado:",
    );

    console.dir(
      resultado,
      { depth: null },
    );

    return resultado;
  } catch (error) {
    console.error(
      "[IA] JSON inválido:",
      conteudo,
    );

    throw new Error(
      `A IA retornou JSON inválido: ${error.message}`,
    );
  }
}

module.exports = {
  interpretarMensagem,
};