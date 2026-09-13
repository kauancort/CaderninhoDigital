const axios = require("axios");

/* =========================================================
   CONFIGURAÇÃO
========================================================= */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini";

const OPENROUTER_URL =
  "https://openrouter.ai/api/v1/chat/completions";

const MAX_TOKENS = 1800;
const MAX_RETRY_TOKENS = 3000;


/* =========================================================
   VALIDAÇÃO
========================================================= */

function validarConfiguracao() {
  if (!OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY não está configurada no arquivo .env"
    );
  }
}


/* =========================================================
   NORMALIZAÇÃO
========================================================= */

function textoSeguro(valor) {
  if (valor === null || valor === undefined) {
    return "";
  }

  return String(valor).trim();
}


function numeroSeguro(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return null;
  }

  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : null;
}


/* =========================================================
   CONVERTER CATÁLOGOS PARA FORMATO PEQUENO
========================================================= */

function prepararProdutos(produtos = []) {
  return produtos.map((produto) => ({
    id: produto.id,
    nome: produto.nome,
  }));
}


function prepararMateriasPrimas(materiasPrimas = []) {
  return materiasPrimas.map((materia) => ({
    id: materia.id,
    nome: materia.nome,
  }));
}


/*
 * IMPORTANTE:
 *
 * NÃO enviamos os 264 clientes para a IA.
 *
 * O flow.js já tenta encontrar o cliente diretamente
 * usando o catálogo.
 *
 * Para a IA, enviamos somente os nomes que parecem
 * relacionados à mensagem atual.
 */

function prepararClientesRelevantes(clientes = [], texto = "") {
  if (!Array.isArray(clientes)) {
    return [];
  }

  const textoNormalizado = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const palavras = textoNormalizado
    .split(/\s+/)
    .filter((palavra) => palavra.length >= 3);

  if (palavras.length === 0) {
    return [];
  }

  const relevantes = clientes.filter((cliente) => {
    if (!cliente || !cliente.nome) {
      return false;
    }

    const nome = String(cliente.nome)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    return palavras.some((palavra) =>
      nome.includes(palavra)
    );
  });

  return relevantes
    .slice(0, 10)
    .map((cliente) => ({
      id: cliente.id,
      nome: cliente.nome,
    }));
}


/* =========================================================
   ESTADO DA VENDA
========================================================= */

function prepararEstadoAtual(estadoAtual) {
  if (!estadoAtual) {
    return null;
  }

  return {
    tipo: "venda",

    comprador:
      estadoAtual.comprador || null,

    novo_cliente:
      estadoAtual.novo_cliente || null,

    forma_pagamento:
      estadoAtual.forma_pagamento || null,

    tipo_cartao:
      estadoAtual.tipo_cartao || null,

    parcelas:
      numeroSeguro(estadoAtual.parcelas),

    itens: Array.isArray(estadoAtual.itens)
      ? estadoAtual.itens.map((item) => ({
          produtoId:
            item.produtoId ?? item.produto_id ?? null,

          produto:
            item.produto ?? item.nome ?? null,

          quantidade:
            numeroSeguro(item.quantidade),

          unidade:
            item.unidade || null,

          tamanho:
            numeroSeguro(item.tamanho),

          precoUnitario:
            numeroSeguro(
              item.precoUnitario ??
              item.preco_unitario
            ),

          valorTotal:
            numeroSeguro(
              item.valorTotal ??
              item.valor_total
            ),
        }))
      : [],
  };
}


/* =========================================================
   CONVERSA ANTERIOR
========================================================= */

function prepararConversa(conversaPrevia) {
  if (!conversaPrevia) {
    return "";
  }

  let conversa = "";

  if (Array.isArray(conversaPrevia)) {
    conversa = conversaPrevia
      .slice(-6)
      .map((item) => String(item))
      .join("\n");
  } else {
    conversa = String(conversaPrevia);
  }

  /*
   * Evita mandar uma conversa gigantesca para o modelo.
   */
  if (conversa.length > 4000) {
    conversa = conversa.slice(-4000);
  }

  return conversa;
}


/* =========================================================
   PROMPT DO SISTEMA
========================================================= */

function criarSystemPrompt({ produtos, materiasPrimas, clientesRelevantes, estadoAtual }) {
  return `
Você é o interpretador do WhatsApp do Caderninho Inteligente - Doces Vó Cida.

SUA FUNÇÃO
- Interpretar a linguagem natural da Gestora.
- Transformar a mensagem em JSON estruturado.
- A aplicação Node.js (flow.js) executa as ações e consulta a API.

REGRA ABSOLUTA DE VERDADE
- Nunca invente cliente, produto, matéria-prima, ID, estoque, preço, documento, telefone ou qualquer dado do sistema.
- Nunca responda uma consulta factual sobre o sistema como se soubesse algo que não está no contexto/API.
- Para perguntas sobre cadastro, estoque, histórico ou outros dados reais, deixe o flow.js fazer a consulta determinística.

RESPOSTA
- Retorne SOMENTE um JSON válido.
- Nunca use markdown, comentários ou texto fora do JSON.
- Se um campo não foi informado, use null.
- Preserve o estado atual e altere somente o que a nova mensagem realmente informa.

TIPOS
"venda", "compra", "producao", "gasto", "conversa", "desconhecido"

VENDA
Formato:
{
  "tipo":"venda",
  "venda":{
    "comprador":null,
    "novo_cliente":null,
    "forma_pagamento":null,
    "tipo_cartao":null,
    "parcelas":null,
    "itens":[]
  },
  "faltando":[],
  "perguntaProximo":null
}

ITEM DE VENDA
{
  "produtoId":null,
  "produto":null,
  "quantidade":null,
  "unidade":null,
  "tamanho":null,
  "precoUnitario":null,
  "valorTotal":null
}

CLIENTE
- O nome pode aparecer sem rótulo: "vende para Maria", "Maria comprou", "é para o João".
- Aceite maiúsculas/minúsculas, acentos, pequenas falhas de digitação e fala transcrita.
- Se a mensagem trouxer dados de cadastro sem rótulos, extraia o que estiver claramente presente.
- Os campos obrigatórios de um NOVO cliente são EXATAMENTE:
  nome, documento (CPF/CNPJ), telefone, endereco, numero, bairro, cidade, estado.
- Campos adicionais permitidos: cep, email, complemento, inscricaoEstadual.
- Não exija que a Gestora use etiquetas. Ela pode dizer uma frase natural.
- Não invente nenhum campo ausente.

EXEMPLOS DE LINGUAGEM NATURAL DE CLIENTE
"O telefone dela é 14999998888, CPF 12345678900, ela mora na Rua Brasil 100, Centro, Tupã, SP"
=> telefone, documento, endereco, numero, bairro, cidade e estado.

"Rua Brasil, 100, Centro, Tupã - SP"
=> endereco, numero, bairro, cidade e estado.

CORREÇÕES
Se já existir uma venda em andamento e a Gestora disser:
"troca para Ana, são 4 potes, tamanho 44 e foi no Pix"
retorne somente os campos que mudaram dentro da venda.

Pode corrigir vários campos na mesma mensagem:
- cliente/comprador
- produto
- quantidade
- unidade
- tamanho
- pagamento
- tipo do cartão
- parcelas
- dados do novo cliente

Não reinicie a venda por causa de uma correção.
Não apague campos que não foram corrigidos.

QUANTIDADE
- "3 potes" => quantidade 3, unidade "POTE"
- "2 caixas" => quantidade 2, unidade "CAIXA"
- "três potes" => quantidade 3, unidade "POTE"
- "quatro caixas" => quantidade 4, unidade "CAIXA"
- 1 caixa = 6 potes, mas NÃO converta a unidade no JSON.

TAMANHO
- "22", "22 uni", "pote de 22", "22 unidades por pote" => 22
- "44", "44 uni", "pote de 44", "44 unidades por pote" => 44
- Nunca invente tamanho.

PREÇOS DO SISTEMA
Fondant: 22 = 20.70; 44 = 21.30
Biriba: 22 = 19.70; 44 = 19.70
Paçoca: 22 = 18.70; 44 = 18.70
Use esses preços somente quando o produto e tamanho estiverem claros. O flow.js pode recalcular o preço.

PAGAMENTO
pix => PIX
dinheiro => DINHEIRO
cartão/cartao => CARTAO
boleto => BOLETO
cheque => CHEQUE
cartão crédito => tipo_cartao CREDITO
cartão débito => tipo_cartao DEBITO

COMPRA
Retorne:
{"tipo":"compra","compras":[],"faltando":[],"perguntaProximo":null}

PRODUÇÃO
Retorne:
{"tipo":"producao","producao":{"produto_final_id":null,"produto_nome":null,"potes":null,"observacoes":null},"faltando":[],"perguntaProximo":null}

GASTO
Retorne:
{"tipo":"gasto","gasto":{"descricao":null,"categoria":null,"valor":null},"faltando":[],"perguntaProximo":null}

CONVERSA
Use somente para conversa real, por exemplo "oi", "bom dia", "obrigada".
Se houver operação pendente, uma resposta curta como "Pix", "Maria", "três" ou "44" é continuação da operação, não conversa.

HISTÓRICO E ESTADO
A mensagem pode ser continuação de uma operação.
Estado atual:
${JSON.stringify(estadoAtual || null)}

CATÁLOGO DE PRODUTOS:
${JSON.stringify(produtos || [])}

CATÁLOGO DE MATÉRIAS-PRIMAS:
${JSON.stringify(materiasPrimas || [])}

CLIENTES RELEVANTES:
${JSON.stringify(clientesRelevantes || [])}

IMPORTANTE SOBRE CLIENTES DUPLICADOS
Se houver mais de um cliente que possa corresponder ao nome, NÃO escolha um.
Retorne o nome informado e deixe a decisão para o flow.js pedir a escolha da Gestora.
Essa regra vale para QUALQUER nome, não apenas um nome específico.

NÃO FAÇA
- Não diga que alguém está cadastrado só porque parece provável.
- Não invente telefone/CPF/endereço.
- Não invente estoque.
- Não invente IDs.
- Não registre nada diretamente.
`;
}

/* =========================================================
   EXTRAIR JSON DA RESPOSTA
========================================================= */

function limparRespostaIA(conteudo) {
  if (!conteudo) {
    return "";
  }

  let texto = String(conteudo).trim();

  /*
   * Remove markdown caso algum modelo coloque.
   */
  texto = texto
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  /*
   * Localiza o primeiro { e o último }.
   */
  const primeiro = texto.indexOf("{");
  const ultimo = texto.lastIndexOf("}");

  if (primeiro >= 0 && ultimo > primeiro) {
    texto = texto.slice(primeiro, ultimo + 1);
  }

  return texto.trim();
}


/* =========================================================
   PARSE JSON
========================================================= */

function interpretarJSON(conteudo) {
  const texto = limparRespostaIA(conteudo);

  if (!texto) {
    throw new Error(
      "A IA retornou uma resposta vazia."
    );
  }

  try {
    return JSON.parse(texto);
  } catch (erro) {
    console.error("[IA] JSON inválido:");
    console.error(texto);

    throw new Error(
      "A IA retornou JSON inválido."
    );
  }
}


/* =========================================================
   NORMALIZAR RESULTADO
========================================================= */

function normalizarResultado(resultado) {
  if (!resultado || typeof resultado !== "object") {
    throw new Error(
      "A IA retornou um resultado inválido."
    );
  }

  if (!resultado.tipo) {
    resultado.tipo = "desconhecido";
  }

  /*
   * ========================================================
   * VENDA
   * ========================================================
   */

  if (resultado.tipo === "venda") {
    /*
     * Aceita também uma resposta antiga da IA que venha assim:
     *
     * {
     *   tipo: "venda",
     *   comprador: "...",
     *   itens: [...]
     * }
     *
     * e converte para o formato esperado pelo flow.js.
     */

    if (!resultado.venda) {
      resultado.venda = {
        comprador:
          resultado.comprador || null,

        novo_cliente:
          resultado.novo_cliente || null,

        forma_pagamento:
          resultado.forma_pagamento || null,

        tipo_cartao:
          resultado.tipo_cartao || null,

        parcelas:
          resultado.parcelas ?? null,

        itens:
          Array.isArray(resultado.itens)
            ? resultado.itens
            : [],
      };
    }

    const venda = resultado.venda;

    venda.comprador =
      venda.comprador || null;

    venda.novo_cliente =
      venda.novo_cliente || null;

    venda.forma_pagamento =
      venda.forma_pagamento || null;

    venda.tipo_cartao =
      venda.tipo_cartao || null;

    venda.parcelas =
      numeroSeguro(venda.parcelas);

    if (!Array.isArray(venda.itens)) {
      venda.itens = [];
    }

    venda.itens = venda.itens.map((item) => ({
      produtoId:
        item.produtoId ??
        item.produto_id ??
        null,

      produto:
        item.produto ??
        item.nome ??
        null,

      quantidade:
        numeroSeguro(item.quantidade),

      unidade:
        item.unidade || null,

      tamanho:
        numeroSeguro(
          item.tamanho ??
          item.tamanhoPote
        ),

      precoUnitario:
        numeroSeguro(
          item.precoUnitario ??
          item.preco_unitario
        ),

      valorTotal:
        numeroSeguro(
          item.valorTotal ??
          item.valor_total
        ),
    }));

    /*
     * Remove campos antigos da raiz.
     */
    delete resultado.comprador;
    delete resultado.novo_cliente;
    delete resultado.forma_pagamento;
    delete resultado.tipo_cartao;
    delete resultado.parcelas;
    delete resultado.itens;
  }

  return resultado;
}


/* =========================================================
   CHAMAR OPENROUTER
========================================================= */

async function chamarOpenRouter({
  texto,
  produtos,
  materiasPrimas,
  clientes,
  conversaPrevia,
  estadoAtual,
  maxTokens,
}) {
  validarConfiguracao();

  const produtosPreparados =
    prepararProdutos(produtos);

  const materiasPrimasPreparadas =
    prepararMateriasPrimas(materiasPrimas);

  const clientesRelevantes =
    prepararClientesRelevantes(
      clientes,
      texto
    );

  const estadoPreparado =
    prepararEstadoAtual(estadoAtual);

  const conversa =
    prepararConversa(conversaPrevia);

  const systemPrompt =
    criarSystemPrompt({
      produtos: produtosPreparados,
      materiasPrimas: materiasPrimasPreparadas,
      clientesRelevantes,
      estadoAtual: estadoPreparado,
    });

  const userPrompt = `
Mensagem atual da Gestora:

${texto}

${conversa
  ? `
Conversa recente:
${conversa}
`
  : ""
}

Analise a mensagem considerando o estado atual da venda.

Retorne SOMENTE o JSON final.
`;

  console.log("[IA] Enviando para OpenRouter...");
  console.log("[IA] Modelo:", OPENROUTER_MODEL);

  const resposta =
    await axios.post(
      OPENROUTER_URL,
      {
        model: OPENROUTER_MODEL,

        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],

        temperature: 0.1,

        max_tokens: maxTokens,
      },
      {
        headers: {
          Authorization:
            `Bearer ${OPENROUTER_API_KEY}`,

          "Content-Type":
            "application/json",

          "HTTP-Referer":
            "https://caderninho-inteligente.local",

          "X-Title":
            "Caderninho Inteligente",
        },

        timeout: 60000,
      }
    );

  const escolha =
    resposta.data?.choices?.[0];

  const finishReason =
    escolha?.finish_reason || null;

  const conteudo =
    escolha?.message?.content || "";

  console.log(
    "[IA] finish_reason:",
    finishReason
  );

  if (conteudo) {
    console.log(
      "[IA] Conteúdo recebido:"
    );

    console.log(conteudo);
  }

  return {
    conteudo,
    finishReason,
  };
}


/* =========================================================
   INTERPRETAR MENSAGEM
========================================================= */

async function interpretarMensagem({
  texto,
  produtos = [],
  materiasPrimas = [],
  clientes = [],
  conversaPrevia = null,
  estadoAtual = null,
}) {
  validarConfiguracao();

  const textoAtual =
    textoSeguro(texto);

  if (!textoAtual) {
    throw new Error(
      "Não foi possível interpretar uma mensagem vazia."
    );
  }

  /*
   * ========================================================
   * PRIMEIRA TENTATIVA
   * ========================================================
   */

  let resposta;

  try {
    resposta =
      await chamarOpenRouter({
        texto: textoAtual,
        produtos,
        materiasPrimas,
        clientes,
        conversaPrevia,
        estadoAtual,
        maxTokens: MAX_TOKENS,
      });
  } catch (erro) {
    console.error(
      "[IA] Erro ao chamar OpenRouter:"
    );

    console.error(
      erro.response?.data ||
      erro.message ||
      erro
    );

    throw new Error(
      "Não foi possível consultar a IA."
    );
  }

  /*
   * ========================================================
   * SE A RESPOSTA ESTIVER VAZIA
   * ========================================================
   */

  if (!resposta.conteudo) {
    console.log(
      "[IA] Resposta vazia. Tentando novamente..."
    );

    try {
      resposta =
        await chamarOpenRouter({
          texto: textoAtual,
          produtos,
          materiasPrimas,
          clientes,
          conversaPrevia,
          estadoAtual,
          maxTokens: MAX_RETRY_TOKENS,
        });
    } catch (erro) {
      console.error(
        "[IA] Segunda tentativa falhou:"
      );

      console.error(
        erro.response?.data ||
        erro.message ||
        erro
      );

      throw new Error(
        "A IA não conseguiu retornar uma resposta."
      );
    }
  }

  /*
   * ========================================================
   * SE TERMINOU POR LIMITE
   * ========================================================
   */

  if (
    resposta.finishReason === "length" &&
    resposta.conteudo
  ) {
    console.log(
      "[IA] Resposta atingiu o limite de tokens."
    );

    /*
     * Tenta novamente com mais espaço.
     */
    try {
      const segundaResposta =
        await chamarOpenRouter({
          texto: textoAtual,
          produtos,
          materiasPrimas,
          clientes,
          conversaPrevia,
          estadoAtual,
          maxTokens: MAX_RETRY_TOKENS,
        });

      /*
       * Usa a segunda resposta se ela tiver vindo
       * completa.
       */
      if (
        segundaResposta.conteudo &&
        segundaResposta.finishReason !== "length"
      ) {
        resposta = segundaResposta;
      } else if (
        segundaResposta.conteudo
      ) {
        /*
         * Mesmo que o modelo diga length,
         * pode ter fechado o JSON.
         */
        try {
          const teste =
            interpretarJSON(
              segundaResposta.conteudo
            );

          return normalizarResultado(teste);
        } catch (_) {
          throw new Error(
            "A IA atingiu o limite de resposta antes de concluir o JSON."
          );
        }
      }
    } catch (erro) {
      if (
        erro.message ===
        "A IA atingiu o limite de resposta antes de concluir o JSON."
      ) {
        throw erro;
      }

      console.error(
        "[IA] Erro na tentativa de recuperação:"
      );

      console.error(
        erro.message || erro
      );
    }
  }

  /*
   * ========================================================
   * RESPOSTA VAZIA APÓS TENTATIVAS
   * ========================================================
   */

  if (!resposta.conteudo) {
    throw new Error(
      `IA retornou vazio. finish_reason: ${resposta.finishReason}`
    );
  }

  /*
   * ========================================================
   * INTERPRETAR JSON
   * ========================================================
   */

  let resultado;

  try {
    resultado =
      interpretarJSON(
        resposta.conteudo
      );
  } catch (erro) {
    /*
     * Se o JSON veio truncado, faz UMA última
     * tentativa pedindo resposta ainda menor.
     */

    console.log(
      "[IA] JSON inválido. Tentando novamente com resposta compacta..."
    );

    try {
      const respostaCompacta =
        await chamarOpenRouter({
          texto:
            `${textoAtual}

IMPORTANTE:
Retorne somente um JSON extremamente curto.
Não inclua explicações.
Não inclua campos desnecessários.`,
          produtos,
          materiasPrimas,
          clientes,
          conversaPrevia: null,
          estadoAtual,
          maxTokens: MAX_RETRY_TOKENS,
        });

      if (!respostaCompacta.conteudo) {
        throw erro;
      }

      resultado =
        interpretarJSON(
          respostaCompacta.conteudo
        );
    } catch (segundaErro) {
      console.error(
        "[IA] Falha definitiva ao interpretar JSON."
      );

      console.error(
        segundaErro.message ||
        segundaErro
      );

      throw new Error(
        "A IA retornou JSON inválido ou incompleto."
      );
    }
  }

  /*
   * ========================================================
   * NORMALIZAR
   * ========================================================
   */

  resultado =
    normalizarResultado(resultado);

  console.log(
    "[IA] Resultado normalizado:"
  );

  console.log(
    JSON.stringify(
      resultado,
      null,
      2
    )
  );

  return resultado;
}


/* =========================================================
   EXPORTAÇÃO
========================================================= */

module.exports = {
  interpretarMensagem,
};