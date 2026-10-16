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

function extrairLista(resposta, nome) {
  if (Array.isArray(resposta)) return resposta;
  // Compatível com respostas comuns de APIs Spring: {data: []}, {content: []}, {items: []}.
  const candidatos = [resposta?.data, resposta?.content, resposta?.items, resposta?.results, resposta?.[nome]];
  for (const candidato of candidatos) {
    if (Array.isArray(candidato)) return candidato;
    if (Array.isArray(candidato?.content)) return candidato.content;
    if (Array.isArray(candidato?.items)) return candidato.items;
  }
  throw new Error(`A API retornou um formato inesperado para ${nome}. O catálogo não será marcado como vazio.`);
}

async function atualizarCatalogo() {
  console.log("[catalogo] Atualizando dados da API...");

  const [prod, mp, cli] = await Promise.all([
    api.get("/produtos"),
    api.get("/materias-primas"),
    api.get("/clientes"),
  ]);

  // Só atualiza o cache depois que as três respostas forem válidas.
  const novosProdutos = extrairLista(prod, "produtos");
  const novasMateriasPrimas = extrairLista(mp, "materias-primas");
  const novosClientes = extrairLista(cli, "clientes");
  produtos = novosProdutos;
  materiasPrimas = novasMateriasPrimas;
  clientes = novosClientes;
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

function normalizarClienteCatalogo(c) {
  if (!c || typeof c !== "object") return c;
  return {
    ...c,
    id: c.id ?? c.clienteId ?? c.idCliente ?? c.codigo,
    nome: c.nome || c.nomeCompleto || c.razaoSocial || c.razao_social || "",
    documento: c.documento || c.cpfCnpj || c.cpf_cnpj || c.cpf || c.cnpj || "",
  };
}

async function getClientes() {
  await atualizar();
  return clientes.map(normalizarClienteCatalogo).filter((c) => c && c.nome);
}

async function getClientesCompletos() {
  await atualizar();
  return clientes.map(normalizarClienteCatalogo).filter((c) => c && c.nome);
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
