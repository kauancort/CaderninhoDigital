const api = require("./apiClient");
const catalogCache = require("./catalogCache");
const { resolverClienteId } = require("./clienteResolver");

const POTES_POR_CAIXA = 6;

const conversas = new Map(); // chatId -> string acumulada

function getConversa(chatId) {
  return conversas.get(chatId) || "";
}

function acrescentarConversa(chatId, linha) {
  const atual = conversas.get(chatId) || "";
  conversas.set(chatId, atual ? `${atual}\n${linha}` : linha);
}

function limparConversa(chatId) {
  conversas.delete(chatId);
}

async function processarMensagem(chatId, { texto, audioBase64, mime }) {
  const produtos = await catalogCache.getProdutos();
  const materiasPrimas = await catalogCache.getMateriasPrimas();

  const payload = {
    produtos,
    materiasPrimas,
    conversaPrevia: getConversa(chatId) || null,
  };

  if (audioBase64) {
    payload.audioBase64 = audioBase64;
    payload.mime = mime || "audio/ogg";
  } else {
    payload.textoTranscrito = texto;
  }

  const resultado = await api.post("/assistente/interpretar-voz", payload);

  acrescentarConversa(chatId, `Usuário: ${resultado.transcricao}`);

  if (resultado.tipo === "desconhecido") {
    return "Não entendi se isso é uma venda, compra, produção ou gasto. Pode explicar de outro jeito? 💛";
  }

  if (resultado.faltando && resultado.faltando.length > 0 && resultado.perguntaProximo) {
    acrescentarConversa(chatId, `Vovó: ${resultado.perguntaProximo}`);
    return resultado.perguntaProximo;
  }

  try {
    const resposta = await concluirLancamento(resultado);
    limparConversa(chatId);
    return resposta;
  } catch (err) {
    limparConversa(chatId);
    const msg = err.response?.data?.message || err.message || "erro desconhecido";
    return `Deu um probleminha ao salvar, meu bem: ${msg}\n\nPode tentar de novo, com calma?`;
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
  if (!venda || !venda.itens || venda.itens.length === 0) {
    throw new Error("venda sem itens identificados");
  }

  const itensValidos = venda.itens.filter(
    (i) => i.produto_final_id && i.quantidade > 0 && i.preco_unitario != null,
  );
  if (itensValidos.length === 0) {
    throw new Error(
      "não consegui identificar o produto, quantidade ou preço da venda — tente citar o nome do produto exatamente como está cadastrado",
    );
  }

  const { clienteId, criadoAgora } = await resolverClienteId(venda.comprador);

  const itens = itensValidos.map((i) => ({
    produtoId: i.produto_final_id,
    quantidade: i.tipo === "caixa" ? i.quantidade * POTES_POR_CAIXA : i.quantidade,
    valorUnitario: i.preco_unitario,
  }));

  const formaPagamento = (venda.forma_pagamento || "pix").toUpperCase();

  const criada = await api.post("/vendas", {
    clienteId,
    dataVenda: hojeISO(),
    formaPagamento,
    statusPagamento: "PAGO",
    observacao: "Lançado pelo WhatsApp",
    itens,
  });

  const nomesProdutos = itensValidos
    .map((i) => `${i.quantidade}× ${i.produto_nome}`)
    .join(", ");

  let resposta = `✅ Venda registrada!\n${nomesProdutos}\nTotal: R$ ${Number(criada.valorTotal).toFixed(2)}`;
  if (criadoAgora) {
    resposta += `\n\n⚠️ Criei o cliente "${venda.comprador}" com dados provisórios — complete o telefone e e-mail dele na tela de Clientes.`;
  }
  return resposta;
}

async function criarCompras(compras) {
  if (!compras || compras.length === 0) throw new Error("compra sem itens identificados");

  const validas = compras.filter(
    (c) => c.materia_prima_id && c.quantidade > 0 && c.valor_total != null,
  );
  if (validas.length === 0) {
    throw new Error(
      "não consegui identificar o ingrediente, quantidade ou valor da compra — tente citar o nome exatamente como está no estoque",
    );
  }

  const respostas = [];
  for (const c of validas) {
    const criada = await api.post("/compras-materias-primas", {
      dataCompra: hojeISO(),
      formaPagamento: "PIX",
      statusPagamento: "PAGO",
      observacao: "Lançado pelo WhatsApp",
      itens: [
        {
          materiaPrimaId: c.materia_prima_id,
          quantidade: c.quantidade,
          valorUnitario: c.valor_total / c.quantidade,
        },
      ],
    });
    respostas.push(
      `${c.quantidade} ${c.unidade || ""} de ${c.produto_nome} — R$ ${Number(criada.valorTotal).toFixed(2)}`,
    );
  }

  return `✅ Compra registrada!\n${respostas.join("\n")}`;
}

async function criarProducao(producao) {
  if (!producao || !producao.produto_final_id || !producao.potes) {
    throw new Error(
      "não consegui identificar o produto ou a quantidade produzida — tente citar o nome do produto exatamente como está cadastrado",
    );
  }

  await api.post("/producoes", {
    produtoId: producao.produto_final_id,
    dataProducao: hojeISO(),
    quantidadeProduzida: producao.potes,
    observacao: producao.observacoes || "Lançado pelo WhatsApp",
    insumos: [],
  });

  return `✅ Produção registrada!\n${producao.potes} potes de ${producao.produto_nome}`;
}

async function criarGasto(gasto) {
  if (!gasto || !gasto.valor || !gasto.descricao) {
    throw new Error("não consegui identificar a descrição ou o valor do gasto");
  }

  // LancamentoRequestDTO: tipo, titulo, descricao, valorTotal, dataLancamento
  // são os campos reais confirmados no backend.
  await api.post("/lancamentos", {
    tipo: "GASTO_GERAL",
    titulo: gasto.descricao,
    descricao: gasto.categoria || gasto.descricao,
    valorTotal: gasto.valor,
    dataLancamento: hojeISO(),
    statusPagamento: "PAGO",
    formaPagamento: "PIX",
  });

  return `✅ Gasto registrado!\n${gasto.descricao} — R$ ${Number(gasto.valor).toFixed(2)}`;
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = { processarMensagem };