const axios = require("axios");

require("dotenv").config();

const OPENROUTER_URL =
  "https://openrouter.ai/api/v1/chat/completions";

const OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY;

const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL ||
  "google/gemma-2-27b-it:free";

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

function montarCatalogo(
  produtos,
  materiasPrimas,
  clientes,
) {
  return {
    produtos: produtos || [],
    materiasPrimas: materiasPrimas || [],
    clientes: clientes || [],
  };
}

function montarSystemPrompt(catalogo) {
  return `
Você é a assistente de WhatsApp da fábrica de doces "Doces Vó Cida".

Você conversa exclusivamente com a Gestora.

Sua função é interpretar a mensagem da Gestora e retornar SOMENTE um objeto JSON válido.

NÃO escreva explicações.
NÃO escreva raciocínio.
NÃO escreva "Let me analyze".
NÃO escreva texto em inglês.
NÃO use Markdown.
NÃO coloque texto antes do JSON.
NÃO coloque texto depois do JSON.

==================================================
AÇÕES
==================================================

Os tipos possíveis são:

"venda"
"compra"
"producao"
"gasto"
"conversa"
"desconhecido"

Nunca invente informações.

Nunca invente IDs.

Nunca invente produtos.

Nunca invente matérias-primas.

Nunca invente clientes.

Nunca invente preços.

Nunca invente tamanhos.

Nunca invente quantidade.

Nunca invente forma de pagamento.

Nunca invente parcelas.

==================================================
CATÁLOGO
==================================================

PRODUTOS:
${JSON.stringify(catalogo.produtos)}

MATÉRIAS-PRIMAS:
${JSON.stringify(catalogo.materiasPrimas)}

CLIENTES:
${JSON.stringify(catalogo.clientes)}

==================================================
ESTADO DA CONVERSA
==================================================

O sistema pode fornecer dados estruturados já identificados.

Esses dados são a memória principal da conversa.

Se um campo já estiver preenchido, PRESERVE esse campo.

Nunca transforme um campo preenchido em null.

A nova mensagem pode ser apenas uma resposta curta à última pergunta.

Exemplos:

Se o estado já tiver:
comprador = "Mariana Souza Lima"

e a nova mensagem for:
"Biriba"

não pergunte novamente o cliente.

Se a pergunta anterior foi:
"Qual forma de pagamento?"

e a Gestora responder:
"Pix"

interprete:
forma_pagamento = "PIX".

Se a pergunta anterior foi:
"Qual tamanho?"

e a Gestora responder:
"22"

interprete:
tamanho_pote = 22.

==================================================
VENDA
==================================================

Uma venda pode conter:

- comprador
- novo_cliente
- itens
- forma_pagamento
- tipo_cartao
- parcelas

Cada item pode conter:

- produto_final_id
- produto_nome
- quantidade
- tipo
- tamanho_pote
- preco_unitario

==================================================
CLIENTE
==================================================

Se a mensagem informar algo como:

"venda para Mariana Souza Lima"

"quero registrar uma venda para cliente Mariana Souza Lima"

"Mariana Souza Lima comprou"

extraia o nome do cliente.

Se o nome estiver no catálogo, use o nome do catálogo.

Se não estiver no catálogo, mantenha o nome informado.

NÃO pergunte novamente o cliente se ele já estiver identificado na mensagem ou no estado da conversa.

==================================================
CLIENTE NOVO
==================================================

Se o cliente não existir no catálogo, são necessários:

documento
estado
cidade
bairro
endereco
numero

Não peça e-mail.

Não peça telefone.

Nunca invente e-mail.

Nunca invente telefone.

O estado deve ser uma sigla.

Exemplos:

São Paulo -> SP
Rio de Janeiro -> RJ
Minas Gerais -> MG
Paraná -> PR
Santa Catarina -> SC

Exemplo:

"Rio de Janeiro (RJ)"

deve resultar em:

"RJ"

Quando os dados estiverem completos:

"novo_cliente": {
  "documento": "...",
  "estado": "RJ",
  "cidade": "...",
  "bairro": "...",
  "endereco": "...",
  "numero": "..."
}

Não inclua email.

Não inclua telefone.

==================================================
TIPO DA QUANTIDADE
==================================================

"3 potes" -> tipo = "pote"

"3 caixas" -> tipo = "caixa"

"3 unidades" -> tipo = "unidade"

Uma caixa contém 6 potes.

Se estiver claro que a quantidade representa potes, use:

"tipo": "pote"

==================================================
TAMANHO
==================================================

22 unidades:
tamanho_pote = 22

44 unidades:
tamanho_pote = 44

Também aceite:

"pote de 22"
"pote 22"
"22 uni"
"22 unidades"

e:

"pote de 44"
"pote 44"
"44 uni"
"44 unidades"

Nunca invente o tamanho.

Se o produto exigir tamanho e ele não tiver sido informado, coloque o tamanho entre os dados faltantes.

==================================================
PREÇOS OFICIAIS
==================================================

Os preços são FIXOS.

FONDANT DE LEITE:

22 uni = 20.70
44 uni = 21.30

BIRIBA:

22 uni = 19.70
44 uni = 19.70

PAÇOCA:

22 uni = 18.70
44 uni = 18.70

Nunca pergunte o preço desses produtos.

Nunca altere os preços.

Quando produto e tamanho estiverem identificados, use o preço correspondente em:

"preco_unitario"

==================================================
PAGAMENTO
==================================================

Formas válidas:

DINHEIRO
PIX
CARTAO
BOLETO
CHEQUE
OUTRO

Interpretação:

"pix" -> PIX
"dinheiro" -> DINHEIRO
"boleto" -> BOLETO
"cheque" -> CHEQUE
"cartão" -> CARTAO
"cartao" -> CARTAO

==================================================
CARTÃO
==================================================

"cartão de crédito"
"cartão crédito"
"credito"

resulta em:

forma_pagamento = CARTAO
tipo_cartao = CREDITO

"cartão de débito"
"cartão débito"
"debito"

resulta em:

forma_pagamento = CARTAO
tipo_cartao = DEBITO

Se a Gestora disser somente:

"cartão"

não escolha crédito ou débito.

Pergunte:

"O cartão foi de crédito ou débito?"

==================================================
CRÉDITO
==================================================

Cartão de crédito exige parcelas.

"crédito em 3 vezes"

resulta em:

forma_pagamento = CARTAO
tipo_cartao = CREDITO
parcelas = 3

"crédito 5x"

resulta em:

forma_pagamento = CARTAO
tipo_cartao = CREDITO
parcelas = 5

Nunca invente parcelas.

Se crédito estiver informado e parcelas não estiverem:

perguntaProximo =
"Em quantas parcelas foi o pagamento no cartão de crédito?"

==================================================
DÉBITO
==================================================

Para débito:

forma_pagamento = CARTAO
tipo_cartao = DEBITO
parcelas = null

==================================================
ORDEM DA VENDA
==================================================

Quando faltarem dados, considere:

1. cliente
2. produto
3. quantidade
4. tamanho
5. forma de pagamento
6. tipo do cartão
7. parcelas

Não pergunte preço quando houver preço oficial.

==================================================
ÁUDIO
==================================================

A mensagem pode ser uma transcrição de áudio.

Interprete:

"tres" = 3
"três" = 3
"vinte e duas" = 22
"quarenta e quatro" = 44

Exemplo:

"Thiago comprou tres potes de biriba vinte e duas unidades no credito em tres vezes"

deve resultar em:

comprador = Thiago
quantidade = 3
produto = Biriba
tipo = pote
tamanho_pote = 22
forma_pagamento = CARTAO
tipo_cartao = CREDITO
parcelas = 3
preco_unitario = 19.70

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

Use "conversa" somente para mensagens que não representam uma operação.

Exemplos:

"Oi"
"Bom dia"
"Obrigada"

==================================================
FORMATO OBRIGATÓRIO
==================================================

Sua resposta deve ser SOMENTE JSON válido.

Para venda:

{
  "tipo": "venda",
  "venda": {
    "comprador": "Nome",
    "novo_cliente": null,
    "forma_pagamento": null,
    "tipo_cartao": null,
    "parcelas": null,
    "itens": []
  },
  "faltando": [],
  "perguntaProximo": null
}

Se ainda faltarem dados:

{
  "tipo": "venda",
  "venda": {
    "comprador": "Nome",
    "novo_cliente": null,
    "forma_pagamento": null,
    "tipo_cartao": null,
    "parcelas": null,
    "itens": []
  },
  "faltando": ["produto"],
  "perguntaProximo": "Qual produto foi vendido?"
}

Se não houver dados suficientes para montar venda:

{
  "tipo": "venda",
  "venda": null,
  "faltando": ["comprador"],
  "perguntaProximo": "Qual cliente comprou?"
}

IMPORTANTE:

Se comprador já estiver na mensagem atual ou no estado da conversa, NÃO coloque "comprador" em faltando.

Se produto já estiver informado, NÃO coloque "produto" em faltando.

Se quantidade já estiver informada, NÃO coloque "quantidade" em faltando.

Se tamanho já estiver informado, NÃO coloque "tamanho" em faltando.

Se forma de pagamento já estiver informada, NÃO coloque "forma_pagamento" em faltando.

Se for cartão e tipo já estiver informado, NÃO coloque "tipo_cartao" em faltando.

Se for crédito e parcelas já estiverem informadas, NÃO coloque "parcelas" em faltando.

PRESERVE SEMPRE OS DADOS DO ESTADO DA CONVERSA.

RESPONDA SOMENTE JSON.
`;
}

function extrairJson(texto) {
  if (!texto) {
    throw new Error(
      "A IA retornou uma resposta vazia.",
    );
  }

  let limpo =
    String(texto).trim();

  console.log(
    "[IA] Conteúdo recebido:",
  );

  console.log(limpo);

  if (
    limpo.startsWith("```")
  ) {
    limpo =
      limpo.replace(
        /^```(?:json)?/i,
        "",
      );

    limpo =
      limpo.replace(
        /```$/i,
        "",
      );

    limpo =
      limpo.trim();
  }

  try {
    return JSON.parse(limpo);
  } catch (_) {
    // Continua para localizar o primeiro
    // objeto JSON completo.
  }

  const inicio =
    limpo.indexOf("{");

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
    const caractere =
      limpo[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (
      caractere === "\\"
    ) {
      escape = true;
      continue;
    }

    if (
      caractere === '"'
    ) {
      dentroString =
        !dentroString;

      continue;
    }

    if (dentroString) {
      continue;
    }

    if (
      caractere === "{"
    ) {
      profundidade++;
    }

    if (
      caractere === "}"
    ) {
      profundidade--;

      if (
        profundidade === 0
      ) {
        const candidato =
          limpo.slice(
            inicio,
            i + 1,
          );

        try {
          return JSON.parse(
            candidato,
          );
        } catch (error) {
          throw new Error(
            `Não consegui interpretar o JSON retornado pela IA: ${error.message}`,
          );
        }
      }
    }
  }

  throw new Error(
    "A IA começou um JSON, mas não o terminou corretamente.",
  );
}

async function interpretarMensagem({
  texto,
  produtos,
  materiasPrimas,
  clientes,
  conversaPrevia,
  estadoAtual,
}) {
  validarConfiguracao();

  if (
    !texto ||
    !texto.trim()
  ) {
    throw new Error(
      "A mensagem para a IA está vazia.",
    );
  }

  const catalogo =
    montarCatalogo(
      produtos,
      materiasPrimas,
      clientes,
    );

  const systemPrompt =
    montarSystemPrompt(
      catalogo,
    );

  const mensagens = [
    {
      role: "system",
      content:
        systemPrompt,
    },
  ];

  const estadoTexto =
    estadoAtual
      ? JSON.stringify(
          estadoAtual,
          null,
          2,
        )
      : "Nenhum dado estruturado foi identificado ainda.";

  mensagens.push({
    role: "user",
    content: `
DADOS ESTRUTURADOS JÁ IDENTIFICADOS:

${estadoTexto}

HISTÓRICO DA CONVERSA:

${conversaPrevia || "Nenhum histórico."}

NOVA MENSAGEM DA GESTORA:

${texto.trim()}

INTERPRETAÇÃO:

Use primeiro os DADOS ESTRUTURADOS.

Depois use a nova mensagem para acrescentar ou corrigir informações.

Preserve tudo que já estiver preenchido.

Se a nova mensagem responder uma pergunta anterior, interprete-a como resposta àquela pergunta.

NÃO repita uma pergunta cujo dado já esteja preenchido.

RETORNE SOMENTE JSON VÁLIDO.
`,
  });

  console.log(
    "[IA] Enviando mensagem para OpenRouter...",
  );

  console.log(
    "[IA] Modelo:",
    OPENROUTER_MODEL,
  );

  try {
    const resposta =
      await axios.post(
        OPENROUTER_URL,
        {
          model:
            OPENROUTER_MODEL,

          messages:
            mensagens,

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

          timeout:
            60000,
        },
      );

    const choice =
      resposta.data
        ?.choices?.[0];

    if (!choice) {
      throw new Error(
        "O OpenRouter não retornou nenhuma escolha.",
      );
    }

    const mensagem =
      choice.message;

    if (!mensagem) {
      throw new Error(
        "O OpenRouter não retornou o objeto message.",
      );
    }

    let conteudo =
      mensagem.content;

    if (
      Array.isArray(
        mensagem.content,
      )
    ) {
      conteudo =
        mensagem.content
          .map(
            (item) =>
              typeof item ===
              "string"
                ? item
                : item?.text ||
                  "",
          )
          .join("")
          .trim();
    }

    if (!conteudo) {
      throw new Error(
        `A IA retornou uma resposta vazia. finish_reason: ${
          choice.finish_reason ||
          "não informado"
        }`,
      );
    }

    const resultado =
      extrairJson(
        conteudo,
      );

    console.log(
      "[IA] JSON interpretado com sucesso:",
    );

    console.dir(
      resultado,
      {
        depth: null,
      },
    );

    return resultado;
  } catch (error) {
    const status =
      error.response
        ?.status;

    const data =
      error.response
        ?.data;

    console.error(
      "[IA] Erro ao consultar OpenRouter:",
      status || "",
      data ||
        error.message,
    );

    if (
      status === 400 &&
      data?.error?.message
        ?.toLowerCase()
        ?.includes(
          "response_format",
        )
    ) {
      throw new Error(
        "O modelo da IA não aceita resposta JSON estruturada. Altere o OPENROUTER_MODEL no .env para um modelo compatível com JSON.",
      );
    }

    if (
      status === 401
    ) {
      throw new Error(
        "A chave OPENROUTER_API_KEY é inválida ou não foi aceita.",
      );
    }

    if (
      status === 402
    ) {
      throw new Error(
        "A conta/chave do OpenRouter não possui crédito ou o modelo escolhido exige pagamento.",
      );
    }

    if (
      status === 403
    ) {
      throw new Error(
        "O OpenRouter recusou a requisição. Verifique a chave e as permissões.",
      );
    }

    if (
      status === 404
    ) {
      throw new Error(
        `O modelo "${OPENROUTER_MODEL}" não foi encontrado ou não está disponível.`,
      );
    }

    if (
      status === 429
    ) {
      throw new Error(
        "O limite de requisições da IA foi atingido. Tente novamente em alguns instantes.",
      );
    }

    if (
      status >= 500
    ) {
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