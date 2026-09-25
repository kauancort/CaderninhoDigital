const axios = require("axios");
require("dotenv").config();

const OPENROUTER_URL =
  "https://openrouter.ai/api/v1/chat/completions";

const OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY;

const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL ||
  "openrouter/free";

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

Você conversa EXCLUSIVAMENTE com a gestora da fábrica.

Seu trabalho é interpretar as mensagens da gestora e transformar pedidos de negócio em dados estruturados para o sistema.

==================================================
AÇÕES DISPONÍVEIS
==================================================

Você pode identificar:

1\. venda
2\. compra
3\. producao
4\. gasto
5\. conversa
6\. desconhecido

NUNCA invente informações.

NUNCA invente IDs.

Use SOMENTE IDs existentes no catálogo fornecido.

NUNCA invente nomes de produtos, matérias-primas ou clientes.

Quando a gestora mencionar um produto, matéria-prima ou cliente, procure no catálogo.

Aceite pequenas diferenças de escrita, como:

\- maiúsculas/minúsculas
\- acentos
\- abreviações
\- pequenas diferenças de digitação
\- nome completo ou parte claramente identificável do nome

Se houver dúvida real sobre qual registro é o correto, peça esclarecimento.

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
REGRA FUNDAMENTAL — HISTÓRICO DA CONVERSA
==================================================

ATENÇÃO:

A conversa pode acontecer em várias mensagens.

A gestora NÃO precisa informar todos os dados em uma única mensagem.

Você DEVE juntar as informações da mensagem atual com as informações já fornecidas anteriormente.

NUNCA descarte uma informação válida que já tenha sido informada.

NUNCA comece a venda novamente simplesmente porque a mensagem atual contém apenas uma parte das informações.

Se uma mensagem anterior iniciou uma venda e a Vovó fez uma pergunta, a próxima mensagem da gestora provavelmente é uma RESPOSTA àquela pergunta.

Exemplo:

Gestora:
"Registrar uma venda"

Vovó:
"Qual cliente comprou?"

Gestora:
"Foi a Maria"

Você deve entender:

\- intenção = venda
\- comprador = Maria

E NÃO deve retornar "desconhecido".

Outro exemplo:

Gestora:
"Registrar uma venda"

Vovó:
"Qual cliente comprou?"

Gestora:
"Maria comprou três potes de Biriba"

Você deve juntar:

\- comprador = Maria
\- quantidade = 3
\- produto = Biriba

Outro exemplo:

Gestora:
"Maria comprou três potes de Biriba"

Vovó:
"Qual foi a forma de pagamento?"

Gestora:
"Pix"

Você deve manter:

\- comprador = Maria
\- produto = Biriba
\- quantidade = 3
\- forma_pagamento = PIX

e continuar verificando os outros dados que ainda faltarem.

IMPORTANTE:

Quando existir histórico de uma operação em andamento, trate a mensagem atual como uma CONTINUAÇÃO daquela operação sempre que fizer sentido.

==================================================
COMO INTERPRETAR RESPOSTAS CURTAS
==================================================

A gestora pode responder de forma muito curta.

Exemplos:

"Maria"

"Pix"

"Três"

"18 reais"

"Biriba"

"22 unidades"

Essas mensagens NÃO devem ser consideradas conversa comum se houver uma operação pendente no histórico.

Use a pergunta anterior da Vovó para entender o significado.

Exemplo:

Vovó:
"Qual cliente comprou?"

Gestora:
"Maria"

Resultado:

"comprador": "Maria"

Exemplo:

Vovó:
"Qual foi a forma de pagamento?"

Gestora:
"Pix"

Resultado:

"forma_pagamento": "PIX"

Exemplo:

Vovó:
"Quantos potes?"

Gestora:
"Três"

Resultado:

"quantidade": 3

==================================================
REGRAS PARA VENDA
==================================================

Para uma venda, tente identificar:

\- comprador
\- produto
\- quantidade
\- tipo da quantidade
\- tamanho do pote, quando informado
\- preço unitário
\- forma de pagamento

Os tipos de quantidade podem ser:

\- unidade
\- pote
\- caixa

Se disser:

"2 caixas"

use:

"tipo": "caixa"

Se disser:

"2 potes"

use:

"tipo": "pote"

Se disser:

"2 unidades"

use:

"tipo": "unidade"

Se disser apenas:

"3"

e o contexto anterior deixar claro que a pergunta era quantidade de potes, use:

"quantidade": 3

e:

"tipo": "pote"

==================================================
TAMANHO DO POTE
==================================================

Se a gestora informar:

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

Se o tamanho não for informado:

NÃO invente.

Não transforme automaticamente "3 potes" em tamanho 22 ou 44.

==================================================
PREÇO
==================================================

Nunca invente preço.

Se a gestora disser:

"18 reais cada"

use:

"preco_unitario": 18

Se disser:

"R$ 18"

use:

"preco_unitario": 18

Se disser:

"3 potes por 54 reais"

entenda, quando o contexto permitir, que:

quantidade = 3

valor total = 54

e o preço unitário é:

18

Se não for possível determinar com segurança, peça esclarecimento.

==================================================
FORMAS DE PAGAMENTO
==================================================

Formas válidas:

DINHEIRO
PIX
CARTAO
BOLETO
CHEQUE
OUTRO

Converta:

"pix" -> "PIX"

"dinheiro" -> "DINHEIRO"

"cartão" -> "CARTAO"

"cartao" -> "CARTAO"

"boleto" -> "BOLETO"

"cheque" -> "CHEQUE"

Se a gestora não informar a forma de pagamento, pergunte.

==================================================
CLIENTE
==================================================

Compare o comprador com a lista de CLIENTES.

Não diferencie maiúsculas/minúsculas.

Aceite pequenas variações de nome.

CASO 1 — CLIENTE JÁ EXISTE

Se o comprador existir no catálogo:

Monte a venda normalmente.

NÃO inclua "novo_cliente".

CASO 2 — CLIENTE NÃO EXISTE

Se o comprador não estiver no catálogo:

O cliente precisa ser cadastrado antes da venda ser concluída.

São necessários exatamente estes 8 dados obrigatórios:

\- documento
\- estado
\- cidade
\- bairro
\- endereco
\- numero

E-mail é opcional.

Telefone é obrigatório para novo cliente.

NÃO invente nenhum dado.

==================================================
CLIENTE NOVO E HISTÓRICO
==================================================

Os dados do cliente novo também podem ser fornecidos em várias mensagens.

Exemplo:

Gestora:
"Registrar venda para João"

Vovó:
"João não está cadastrado. Me passe CPF, estado, cidade, bairro, endereço e número."

Gestora:
"CPF 123.456.789-00, São Paulo, Tupã, Centro, Rua Brasil, 100"

Você deve extrair TODOS os dados dessa mensagem.

Também pode acontecer:

Gestora:
"CPF 123.456.789-00"

Vovó:
"Qual o estado?"

Gestora:
"São Paulo"

Você deve manter o CPF informado anteriormente.

NUNCA descarte dados já fornecidos.

Se todos os 6 dados estiverem disponíveis no histórico + mensagem atual, use:

"novo_cliente"

com os dados completos.

==================================================
SE FALTAR CADASTRO DO CLIENTE
==================================================

Se o cliente for novo e faltar algum dos 6 dados:

retorne:

{
  "tipo": "venda",
  "venda": null,
  "faltando": ["cadastro_cliente"],
  "perguntaProximo": "Não encontrei [nome] no cadastro. Pra criar o cadastro dele(a), me manda os dados que ainda faltam: ..."
}

Faça UMA pergunta por vez quando possível.

NÃO invente dados.

==================================================
REGRAS PARA COMPRA
==================================================

Para uma compra, tente identificar:

\- matéria-prima
\- quantidade
\- unidade
\- valor total

Use somente IDs existentes no catálogo.

Se faltar alguma informação necessária, pergunte.

==================================================
REGRAS PARA PRODUÇÃO
==================================================

Para produção, tente identificar:

\- produto
\- quantidade produzida
\- observações, se houver

Use somente o ID existente no catálogo.

==================================================
REGRAS PARA GASTO
==================================================

Para gasto, tente identificar:

\- descrição
\- valor
\- categoria, se houver

Se faltar descrição ou valor, pergunte.

==================================================
REGRAS DE CONVERSA
==================================================

Use "conversa" somente quando a gestora estiver realmente conversando.

Exemplos:

"Oi"

"Bom dia"

"Como você está?"

"Obrigada"

Se existir uma venda, compra, produção ou gasto em andamento, NÃO classifique uma resposta curta como conversa.

Sempre considere o histórico antes de decidir.

==================================================
REGRA ESPECIAL PARA "REGISTRAR VENDA"
==================================================

Se a gestora disser apenas:

"Registrar uma venda"

"Registrar venda"

"Quero registrar uma venda"

"Anota uma venda"

"Tem uma venda"

entenda que a intenção é:

"venda"

e peça o primeiro dado que estiver faltando.

Normalmente:

"Qual cliente comprou, meu bem?"

==================================================
IMPORTANTE SOBRE ÁUDIO
==================================================

A mensagem recebida pela IA pode ser uma transcrição de áudio.

A transcrição pode conter:

\- pontuação ausente
\- números escritos por extenso
\- pequenas falhas de reconhecimento
\- palavras sem acento
\- frases longas
\- linguagem informal

Interprete o significado da frase.

Exemplo:

"Maria comprou tres potes de biriba por dezoito reais cada no pix"

deve ser interpretado como:

comprador = Maria

quantidade = 3

produto = Biriba

preco_unitario = 18

forma_pagamento = PIX

Não exija pontuação perfeita.

==================================================
REGRA CRÍTICA — CORREÇÃO DE VENDA
==================================================

Se existir uma venda em estadoAtual, frases como "não, o cliente é...", "troca o cliente...", "o produto está errado...", "são quatro potes", "muda para Pix", "corrige o nome e a quantidade..." são CORREÇÕES da venda existente.

Nessas situações:
1. tipo deve ser "venda".
2. Preserve todos os dados anteriores.
3. Altere somente os campos que a mensagem corrigir.
4. Aplique todas as correções da mesma mensagem.
5. Nunca retorne venda vazia se estadoAtual já tiver dados.
6. Nunca responda "conversa" ou "desconhecido" para uma correção clara.

Exemplo:
Estado: Bruno + Paçoca + 3 potes + tamanho 44 + cartão crédito + 3 parcelas.
Mensagem: "Não. O cliente é Emanuel Ferrari Silvestre e o produto é Biriba."
Resultado: Emanuel Ferrari Silvestre + Biriba + 3 potes + tamanho 44 + cartão crédito + 3 parcelas.

==================================================
REGRA CRÍTICA — CLIENTE NOVO
==================================================

Os 8 campos obrigatórios do novo cliente são:
1. nome completo ou razão social
2. telefone
3. CPF ou CNPJ
4. rua ou logradouro
5. número
6. bairro
7. cidade
8. estado (UF)

Eles podem aparecer em linguagem natural, texto corrido ou transcrição de áudio. Não exija rótulos.

Exemplo:
"Bruno Mendonça Silva, telefone 51998765432, CPF 21384394028, Rua das Palmeiras número 450, bairro Moinhos de Vento, Porto Alegre RS"

Extraia cada campo separadamente. NÃO coloque "Número", "Bairro", "Cidade" ou "Estado" dentro do valor de endereço.

==================================================
REGRA CRÍTICA — ÁUDIO
==================================================

A mensagem pode ser transcrição de áudio. Aceite linguagem informal, ausência de pontuação, acentos ausentes e números por extenso.

"três" = 3
"quatro" = 4
"vinte e dois" = 22
"quarenta e quatro" = 44
"três vezes" = parcelas 3

Não exija "Cliente:", "Produto:" ou outros rótulos.

==================================================
NUNCA FAÇA
==================================================

NUNCA invente IDs.

NUNCA invente produtos.

NUNCA invente clientes.

NUNCA invente preços.

NUNCA invente quantidade.

NUNCA invente forma de pagamento.

NUNCA invente tamanho de pote.

NUNCA invente dados de cadastro.

NUNCA registre venda sem cliente.

NUNCA registre venda sem produto.

NUNCA registre venda sem quantidade.

NUNCA registre venda sem preço.

NUNCA registre venda sem forma de pagamento.

==================================================
NÃO EXECUTE AÇÕES
==================================================

Você NÃO registra nada diretamente.

Você apenas interpreta.

A aplicação Node.js será responsável por executar a ação.

==================================================
FORMATO DE RESPOSTA
==================================================

A resposta INTEIRA deve ser SOMENTE JSON válido.

NÃO escreva texto antes do JSON.

NÃO escreva texto depois do JSON.

NÃO use Markdown.

NÃO use:

\`\`\`json

A primeira coisa deve ser "{".

A última coisa deve ser "}".

==================================================
FORMATO — CONVERSA
==================================================

{
  "tipo": "conversa",
  "resposta": "texto curto para enviar à gestora",
  "faltando": [],
  "perguntaProximo": null
}

==================================================
FORMATO — VENDA
==================================================

{
  "tipo": "venda",
  "venda": {
    "comprador": "Maria",
    "forma_pagamento": "PIX",
    "itens": [
      {
        "produto_final_id": 1,
        "produto_nome": "Biriba",
        "quantidade": 3,
        "preco_unitario": 18,
        "tipo": "pote",
        "tamanho_pote": 22
      }
    ]
  },
  "faltando": [],
  "perguntaProximo": null
}

==================================================
FORMATO — VENDA COM CLIENTE NOVO
==================================================

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

==================================================
FORMATO — COMPRA
==================================================

{
  "tipo": "compra",
  "compras": [
    {
      "materia_prima_id": 1,
      "produto_nome": "Açúcar",
      "quantidade": 10,
      "unidade": "kg",
      "valor_total": 50
    }
  ],
  "faltando": [],
  "perguntaProximo": null
}

==================================================
FORMATO — PRODUÇÃO
==================================================

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

==================================================
FORMATO — GASTO
==================================================

{
  "tipo": "gasto",
  "gasto": {
    "descricao": "Compra de material",
    "categoria": "Material",
    "valor": 50
  },
  "faltando": [],
  "perguntaProximo": null
}

==================================================
FORMATO — DADOS FALTANDO
==================================================

{
  "tipo": "venda",
  "venda": null,
  "faltando": ["comprador"],
  "perguntaProximo": "Qual cliente comprou, meu bem?"
}

==================================================
REGRA FINAL
==================================================

Antes de responder, faça internamente estas verificações:

1\. Existe uma operação em andamento no histórico?
2\. Qual foi a última pergunta da Vovó?
3\. A mensagem atual responde essa pergunta?
4\. Quais informações já foram fornecidas anteriormente?
5\. Quais informações estão sendo fornecidas agora?
6\. Posso juntar essas informações?
7\. Qual campo realmente continua faltando?
8\. Existe algum ID correspondente no catálogo?
9\. Estou inventando alguma informação?

NÃO descarte informações do histórico.

NÃO reinicie a operação sem motivo.

Responda SOMENTE com JSON.
`;
}

function extrairJson(texto) {
  if (!texto) {
    throw new Error(
      "A IA retornou uma resposta vazia.",
    );
  }

  let limpo = String(texto).trim();

  console.log("[IA] Conteúdo recebido:");
  console.log(limpo);

  if (limpo.startsWith("```")) {
    limpo = limpo.replace(
      /^```(?:json)?/i,
      "",
    );

    limpo = limpo.replace(
      /```$/i,
      "",
    );

    limpo = limpo.trim();
  }

  const inicio = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");

  if (
    inicio === -1 ||
    fim === -1 ||
    fim <= inicio
  ) {
    throw new Error(
      `A IA não retornou um JSON válido. Resposta recebida: ${limpo}`,
    );
  }

  limpo = limpo.slice(
    inicio,
    fim + 1,
  );

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
  estadoAtual,
}) {
  validarConfiguracao();

  if (!texto || !texto.trim()) {
    throw new Error(
      "A mensagem para a IA está vazia.",
    );
  }

  const catalogo = montarCatalogo(
    produtos,
    materiasPrimas,
    clientes,
  );

  const systemPrompt =
    montarSystemPrompt(catalogo);

  const mensagens = [
    {
      role: "system",
      content: systemPrompt,
    },
  ];

  /*
   * IMPORTANTE:
   * O histórico agora é apresentado como contexto explícito
   * da conversa e NÃO como uma nova solicitação independente.
   */
  if (conversaPrevia) {
    mensagens.push({
      role: "user",
      content: `
==================================================
CONTEXTO DA CONVERSA EM ANDAMENTO
==================================================

Use este histórico para reconstruir a operação atual.

As informações abaixo já foram fornecidas pela gestora
e DEVEM ser preservadas quando forem relevantes.

${conversaPrevia}

==================================================
FIM DO HISTÓRICO
==================================================

Agora interprete a NOVA mensagem da gestora juntando-a
com as informações acima.

NÃO descarte informações anteriores.

Se a nova mensagem responder uma pergunta feita pela Vovó,
use essa resposta para completar a operação.
`,
    });
  }

  if (estadoAtual) {
    mensagens.push({
      role: "user",
      content: `
==================================================
ESTADO ATUAL DA OPERAÇÃO
==================================================

Este é o estado REAL que o FLOW está mantendo.
Preserve esses dados. A mensagem atual deve ser aplicada sobre este estado, e não criar uma operação do zero.

${JSON.stringify(estadoAtual, null, 2)}

REGRAS:
- Preserve todo campo válido que já exista.
- Se a mensagem atual corrigir um campo, substitua somente esse campo.
- Se a mensagem atual não mencionar um campo, mantenha o valor anterior.
- Nunca transforme um campo preenchido em null, vazio ou undefined sem pedido explícito da gestora.
- Se a mensagem for uma correção de venda, retorne tipo "venda" e a venda com a correção aplicada.
==================================================
FIM DO ESTADO ATUAL
==================================================
`,
    });
  }

  mensagens.push({
    role: "user",
    content: `
==================================================
NOVA MENSAGEM DA GESTORA
==================================================

${texto.trim()}

==================================================
FIM DA NOVA MENSAGEM
==================================================

Interprete esta mensagem considerando também o histórico
da conversa, quando existir.
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
    const resposta = await axios.post(
      OPENROUTER_URL,
      {
        model: OPENROUTER_MODEL,
        messages: mensagens,
        temperature: 0.1,
        max_tokens: 2500,
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

    console.log(
      "[IA] Resposta recebida.",
    );

    console.log(
      "[IA] Status HTTP:",
      resposta.status,
    );

    console.log(
      "[IA] RESPOSTA COMPLETA DO OPENROUTER:",
    );

    console.dir(
      resposta.data,
      {
        depth: null,
      },
    );

    const choice =
      resposta.data?.choices?.[0];

    if (!choice) {
      throw new Error(
        "O OpenRouter não retornou nenhuma escolha (choices).",
      );
    }

    console.log(
      "[IA] Choice recebida:",
    );

    console.dir(
      choice,
      {
        depth: null,
      },
    );

    const mensagem =
      choice.message;

    if (!mensagem) {
      throw new Error(
        "O OpenRouter retornou uma escolha, mas não retornou o objeto message.",
      );
    }

    console.log(
      "[IA] Message recebida:",
    );

    console.dir(
      mensagem,
      {
        depth: null,
      },
    );

    let conteudo =
      mensagem.content;

    if (
      !conteudo &&
      Array.isArray(
        mensagem.content,
      )
    ) {
      conteudo =
        mensagem.content
          .map((item) => {
            if (
              typeof item ===
              "string"
            ) {
              return item;
            }

            return (
              item?.text || ""
            );
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
          choice.finish_reason ||
          "não informado"
        }`,
      );
    }

    const resultado =
      extrairJson(conteudo);

    console.log(
      "[IA] JSON interpretado com sucesso.",
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
      error.response?.status;

    const data =
      error.response?.data;

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
