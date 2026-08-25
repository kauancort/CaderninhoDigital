const api = require("./apiClient");

let produtos = [];
let materiasPrimas = [];
let clientes = [];

let ultimaAtualizacao = 0;

const TTL_MS = 2 * 60 * 1000;

let atualizacaoEmAndamento = null;

async function atualizar(force = false) {
  if (
    !force &&
    Date.now() - ultimaAtualizacao < TTL_MS
  ) {
    return;
  }

  // Se outra mensagem já está atualizando o catálogo,
  // espera essa atualização terminar.
  if (atualizacaoEmAndamento) {
    console.log(
      "[catalogo] Atualização já está em andamento. Aguardando...",
    );

    return await atualizacaoEmAndamento;
  }

  atualizacaoEmAndamento = atualizarCatalogo();

  try {
    await atualizacaoEmAndamento;
  } finally {
    atualizacaoEmAndamento = null;
  }
}

async function atualizarCatalogo() {
  console.log("[catalogo] Iniciando atualização...");

  try {
    // Primeiro produtos
    console.log("[catalogo] Buscando produtos...");
    const prod = await api.get("/produtos");

    // Depois matérias-primas
    console.log("[catalogo] Buscando matérias-primas...");
    const mp = await api.get("/materias-primas");

    // Depois clientes
    console.log("[catalogo] Buscando clientes...");
    const cli = await api.get("/clientes");

    produtos = prod.map((p) => ({
      id: p.id,
      nome: p.nome,
    }));

    materiasPrimas = mp.map((m) => ({
      id: m.id,
      nome: m.nome,
    }));

    clientes = cli.map((c) => ({
      id: c.id,
      nome: c.nome,
    }));

    ultimaAtualizacao = Date.now();

    console.log(
      `[catalogo] Atualizado: ${produtos.length} produtos, ` +
        `${materiasPrimas.length} matérias-primas, ` +
        `${clientes.length} clientes`,
    );
  } catch (err) {
    console.error(
      "[catalogo] Erro ao atualizar catálogo:",
      err.message,
    );

    throw err;
  }
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
  return clientes;
}

async function forcarAtualizacao() {
  await atualizar(true);
}

module.exports = {
  getProdutos,
  getMateriasPrimas,
  getClientes,
  forcarAtualizacao,
};