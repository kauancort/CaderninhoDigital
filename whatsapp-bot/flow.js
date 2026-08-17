const api = require("./apiClient");
const catalogCache = require("./catalogCache");
const { resolverClienteId } = require("./clienteResolver");
const { interpretarMensagem } = require("./aiService");

const POTES_POR_CAIXA = 6;

const conversas = new Map();

function getConversa(chatId) {
  return conversas.get(chatId) || "";
}

function acrescentarConversa(chatId, linha) {
  const atual = conversas.get(chatId) || "";

  conversas.set(
    chatId,
    atual ? `${atual}\n${linha}` : linha,
  );
}

function limparConversa(chatId) {
  conversas.delete(chatId);
}

async function processarMensagem(
  chatId,
  { texto, audioBase64, mime },
) {
  try {
    if (audioBase64) {
      return (
        "🎧 Recebi seu áudio, meu bem! " +
        "A função de áudio ainda está sendo configurada. " +
        "Por enquanto, pode me mandar essa informação por texto. 💛"
      );
    }

    if (!texto || !texto.trim()) {
      return "Não consegui identificar sua mensagem. Pode tentar novamente? 💛";
    }

    const produtos = await catalogCache.getProdutos();
    const materiasPrimas =
      await catalogCache.getMateriasPrimas();
    const clientes = await catalogCache.getClientes();

    console.log(
      `[FLOW] Processando mensagem de ${chatId}: ${texto}`,
    );

    const resultado = await interpretarMensagem({
      texto: texto.trim(),
      produtos,
      materiasPrimas,
      clientes,
      conversaPrevia: getConversa(chatId) || null,
    });

    console.log(
      "[FLOW] Resultado da IA:",
      JSON.stringify(resultado, null, 2),
    );

    const transcricao = texto.trim();

    acrescentarConversa(
      chatId,
      `Gestora: ${transcricao}`,
    );

    if (!resultado || !resultado.tipo) {
      throw new Error(
        "A IA retornou uma resposta sem informar o tipo da ação.",
      );
    }

    if (resultado.tipo === "conversa") {
      const resposta =
        resultado.resposta ||
        "Claro, meu bem! Como posso ajudar? 💛";

      acrescentarConversa(
        chatId,
        `Vovó: ${resposta}`,
      );

      return resposta;
    }

    if (resultado.tipo === "desconhecido") {
      const resposta =
        resultado.resposta ||
        "Não entendi o que você gostaria de fazer. Pode explicar de outro jeito? 💛";

      acrescentarConversa(
        chatId,
        `Vovó: ${resposta}`,
      );

      return resposta;
    }

    if (
      Array.isArray(resultado.faltando) &&
      resultado.faltando.length > 0 &&
      resultado.perguntaProximo
    ) {
      acrescentarConversa(
        chatId,
        `Vovó: ${resultado.perguntaProximo}`,
      );

      return resultado.perguntaProximo;
    }

    try {
      const resposta =
        await concluirLancamento(resultado);

      limparConversa(chatId);

      return resposta;
    } catch (err) {
      /*
       * ALTERADO: não limpamos mais a conversa quando dá erro.
       * Isso preserva o contexto (itens, cliente, forma de pagamento já
       * identificados) para que a gestora possa só completar o que falta,
       * em vez de o bot "esquecer" tudo e tratar a próxima mensagem como
       * uma conversa nova.
       */
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "erro desconhecido";

      console.error(
        "[FLOW] Erro ao concluir lançamento:",
        err.response?.data || err,
      );

      const respostaErro =
        `Deu um probleminha ao salvar, meu bem: ${msg}\n\n` +
        "Pode me mandar essa informação? 💛";

      acrescentarConversa(
        chatId,
        `Vovó: ${respostaErro}`,
      );

      return respostaErro;
    }
  } catch (error) {
    console.error(
      "[FLOW] Erro ao processar mensagem:",
      error,
    );

    return (
      "Tive um probleminha para entender sua mensagem, meu bem. " +
      "Pode tentar novamente? 💛"
    );
  }
}

async function concluirLancamento(resultado) {
  switch (resultado.tipo) {
    case "venda":
      return criarVenda(resultado.venda);

    case "compra":
      return criarCompras(resultado.compras);

    case "producao":
      return criarProducao(resultado.producao);

    case "gasto":
      return criarGasto(resultado.gasto);

    default:
      return "Não consegui identificar o tipo de lançamento.";
  }
}

async function criarVenda(venda) {
  if (
    !venda ||
    !venda.itens ||
    venda.itens.length === 0
  ) {
    throw new Error(
      "Venda sem itens identificados.",
    );
  }

  if (
    !venda.comprador ||
    !venda.comprador.trim()
  ) {
    throw new Error(
      "O cliente da venda não foi informado.",
    );
  }

  const itensValidos = venda.itens.filter(
    (i) =>
      i.produto_final_id &&
      Number(i.quantidade) > 0 &&
      i.preco_unitario != null &&
      Number(i.preco_unitario) >= 0,
  );

  if (itensValidos.length === 0) {
    throw new Error(
      "Não consegui identificar o produto, quantidade ou preço da venda. " +
        "Tente citar o nome do produto, a quantidade e o valor.",
    );
  }

  if (
    !venda.forma_pagamento
  ) {
    throw new Error(
      "A forma de pagamento não foi informada.",
    );
  }

  // ALTERADO: passa os dados de cadastro (se a IA os coletou) para o resolver.
  const {
    clienteId,
    criadoAgora,
  } = await resolverClienteId(
    venda.comprador,
    venda.novo_cliente,
  );

  if (!clienteId) {
    throw new Error(
      "Não consegui identificar o cliente da venda.",
    );
  }

  const itens = itensValidos.map((i) => ({
    produtoId: Number(i.produto_final_id),

    quantidade:
      i.tipo === "caixa"
        ? Number(i.quantidade) *
          POTES_POR_CAIXA
        : Number(i.quantidade),

    valorUnitario: Number(
      i.preco_unitario,
    ),
  }));

  const formaPagamento = String(
    venda.forma_pagamento,
  ).toUpperCase();

  const formasValidas = [
    "DINHEIRO",
    "PIX",
    "CARTAO",
    "BOLETO",
    "CHEQUE",
    "OUTRO",
  ];

  if (!formasValidas.includes(formaPagamento)) {
    throw new Error(
      `Forma de pagamento inválida: ${formaPagamento}`,
    );
  }

  const criada = await api.post(
    "/vendas",
    {
      clienteId,
      dataVenda: hojeISO(),
      formaPagamento,
      statusPagamento: "PAGO",
      observacao:
        "Lançado pelo WhatsApp",
      itens,
    },
  );

  const nomesProdutos =
    itensValidos
      .map(
        (i) =>
          `${i.quantidade}× ${i.produto_nome}`,
      )
      .join(", ");

  let resposta =
    `✅ Venda registrada!\n` +
    `${nomesProdutos}\n` +
    `Total: R$ ${Number(
      criada.valorTotal,
    ).toFixed(2).replace(".", ",")}`;

  if (criadoAgora) {
    resposta +=
      `\n\n✅ Também cadastrei "${venda.comprador}" como cliente novo. ` +
      "Se quiser, complete o e-mail e telefone dele na tela de Clientes.";
  }

  return resposta;
}

async function criarCompras(compras) {
  if (
    !compras ||
    compras.length === 0
  ) {
    throw new Error(
      "Compra sem itens identificados.",
    );
  }

  const validas = compras.filter(
    (c) =>
      c.materia_prima_id &&
      Number(c.quantidade) > 0 &&
      c.valor_total != null &&
      Number(c.valor_total) >= 0,
  );

  if (validas.length === 0) {
    throw new Error(
      "Não consegui identificar o ingrediente, quantidade ou valor da compra.",
    );
  }

  const respostas = [];

  for (const c of validas) {
    const quantidade =
      Number(c.quantidade);

    const valorTotal =
      Number(c.valor_total);

    const criada = await api.post(
      "/compras-materias-primas",
      {
        dataCompra: hojeISO(),
        formaPagamento: "PIX",
        statusPagamento: "PAGO",
        observacao:
          "Lançado pelo WhatsApp",
        itens: [
          {
            materiaPrimaId:
              Number(
                c.materia_prima_id,
              ),
            quantidade,
            valorUnitario:
              valorTotal / quantidade,
          },
        ],
      },
    );

    respostas.push(
      `${quantidade} ${
        c.unidade || ""
      } de ${c.produto_nome} — R$ ${Number(
        criada.valorTotal,
      ).toFixed(2)}`,
    );
  }

  return (
    `✅ Compra registrada!\n` +
    respostas.join("\n")
  );
}

async function criarProducao(producao) {
  if (
    !producao ||
    !producao.produto_final_id ||
    !producao.potes ||
    Number(producao.potes) <= 0
  ) {
    throw new Error(
      "Não consegui identificar o produto ou a quantidade produzida.",
    );
  }

  await api.post(
    "/producoes",
    {
      produtoId: Number(
        producao.produto_final_id,
      ),
      dataProducao: hojeISO(),
      quantidadeProduzida:
        Number(producao.potes),
      observacao:
        producao.observacoes ||
        "Lançado pelo WhatsApp",
      insumos: [],
    },
  );

  return (
    `✅ Produção registrada!\n` +
    `${producao.potes} potes de ${producao.produto_nome}`
  );
}

async function criarGasto(gasto) {
  if (
    !gasto ||
    gasto.valor == null ||
    !gasto.descricao
  ) {
    throw new Error(
      "Não consegui identificar a descrição ou o valor do gasto.",
    );
  }

  await api.post(
    "/lancamentos",
    {
      tipo: "GASTO_GERAL",
      titulo: gasto.descricao,
      descricao:
        gasto.categoria ||
        gasto.descricao,
      valorTotal: Number(gasto.valor),
      dataLancamento: hojeISO(),
      statusPagamento: "PAGO",
      formaPagamento: "PIX",
    },
  );

  return (
    `✅ Gasto registrado!\n` +
    `${gasto.descricao} — R$ ${Number(
      gasto.valor,
    ).toFixed(2)}`
  );
}

function hojeISO() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

module.exports = {
  processarMensagem,
};