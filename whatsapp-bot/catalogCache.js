const api = require("./apiClient");

let produtos = [];
let materiasPrimas = [];
let clientes = [];
let ultimaAtualizacao = 0;

const TTL_MS = 2 * 60 * 1000; // recarrega no máximo a cada 2 minutos

async function atualizar(force = false) {
  if (!force && Date.now() - ultimaAtualizacao < TTL_MS) return;

  const [prod, mp, cli] = await Promise.all([
    api.get("/produtos"),
    api.get("/materias-primas"),
    api.get("/clientes"),
  ]);

  produtos = prod.map((p) => ({ id: p.id, nome: p.nome }));
  materiasPrimas = mp.map((m) => ({ id: m.id, nome: m.nome }));
  clientes = cli.map((c) => ({ id: c.id, nome: c.nome }));
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
  return clientes;
}

async function forcarAtualizacao() {
  await atualizar(true);
}

module.exports = { getProdutos, getMateriasPrimas, getClientes, forcarAtualizacao };
