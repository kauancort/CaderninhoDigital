const api = require("./apiClient");

let produtos = [];
let materiasPrimas = [];
let clientes = [];
let ultimaAtualizacao = 0;
const TTL_MS = 2 * 60 * 1000;
let atualizacaoEmAndamento = null;

async function atualizar(force = false) {
  if (!force && Date.now() - ultimaAtualizacao < TTL_MS) return;
  if (atualizacaoEmAndamento) return atualizacaoEmAndamento;

  atualizacaoEmAndamento = atualizarCatalogo();
  try {
    await atualizacaoEmAndamento;
  } finally {
    atualizacaoEmAndamento = null;
  }
}

async function atualizarCatalogo() {
  console.log("[catalogo] Atualizando dados da API...");

  const [prod, mp, cli] = await Promise.all([
    api.get("/produtos"),
    api.get("/materias-primas"),
    api.get("/clientes"),
  ]);

  produtos = Array.isArray(prod) ? prod : [];
  materiasPrimas = Array.isArray(mp) ? mp : [];
  clientes = Array.isArray(cli) ? cli : [];
  ultimaAtualizacao = Date.now();

  console.log(
    `[catalogo] Atualizado: ${produtos.length} produtos, ${materiasPrimas.length} matérias-primas, ${clientes.length} clientes`,
  );
}

async function getProdutos() {
  await atualizar();
  return produtos;
}

async function getMateriasPrimas() {
  await atualizar();
  return materiasPrimas;
}

async function getClientes() {
  await atualizar();
  return clientes.map((c) => ({ id: c.id, nome: c.nome }));
}

async function getClientesCompletos() {
  await atualizar();
  return clientes;
}

async function getClientePorId(id) {
  await atualizar();
  return clientes.find((c) => String(c.id) === String(id)) || null;
}

async function forcarAtualizacao() {
  ultimaAtualizacao = 0;
  await atualizar(true);
}

module.exports = {
  getProdutos,
  getMateriasPrimas,
  getClientes,
  getClientesCompletos,
  getClientePorId,
  forcarAtualizacao,
};
