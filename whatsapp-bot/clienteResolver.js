const api = require("./apiClient");
const catalogCache = require("./catalogCache");

function normalizarTexto(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function somenteDigitos(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function normalizarTelefone(valor) {
  let d = somenteDigitos(valor);
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  return d.length >= 10 && d.length <= 11 ? d : null;
}

function normalizarDocumento(valor) {
  const d = somenteDigitos(valor);
  return d.length === 11 || d.length === 14 ? d : null;
}

function encontrarClientesPorNome(nome, clientes) {
  if (!nome || !Array.isArray(clientes)) return [];
  const alvo = normalizarTexto(nome);

  const exatos = clientes.filter(
    (c) => c?.nome && normalizarTexto(c.nome) === alvo,
  );
  if (exatos.length) return exatos;

  return clientes.filter((c) => {
    if (!c?.nome) return false;
    const n = normalizarTexto(c.nome);
    return n.length >= 4 && (n.includes(alvo) || alvo.includes(n));
  });
}

function validarNovoCliente(nome, dados) {
  if (!nome || !String(nome).trim()) return "Informe o nome completo ou razão social do cliente.";
  const obrigatorios = [
    ["documento", "CPF ou CNPJ"],
    ["telefone", "telefone"],
    ["endereco", "rua ou logradouro"],
    ["numero", "número"],
    ["bairro", "bairro"],
    ["cidade", "cidade"],
    ["estado", "estado"],
  ];

  for (const [campo, rotulo] of obrigatorios) {
    if (!dados?.[campo] || !String(dados[campo]).trim()) {
      return `Informe o ${rotulo} do novo cliente.`;
    }
  }

  if (!normalizarTelefone(dados.telefone)) return "Informe um telefone válido com DDD.";
  if (!normalizarDocumento(dados.documento)) return "Informe um CPF ou CNPJ válido.";
  return null;
}

async function resolverClienteId(nomeFalado, novoCliente = null) {
  const nome = String(nomeFalado || "").trim();
  if (!nome) return { clienteId: null, criadoAgora: false };

  const clientes = await catalogCache.getClientesCompletos();
  const candidatos = encontrarClientesPorNome(nome, clientes);

  if (candidatos.length === 1) {
    return { clienteId: candidatos[0].id, criadoAgora: false };
  }

  if (candidatos.length > 1) {
    const erro = new Error("CLIENTE_AMBIGUO");
    erro.codigo = "CLIENTE_AMBIGUO";
    erro.candidatos = candidatos;
    throw erro;
  }

  const erroValidacao = validarNovoCliente(nome, novoCliente);
  if (erroValidacao) throw new Error(erroValidacao);

  const telefone = normalizarTelefone(novoCliente.telefone);
  const documento = normalizarDocumento(novoCliente.documento);

  const existentePorDocumento = clientes.find(
    (c) => somenteDigitos(c.documento) === documento,
  );
  if (existentePorDocumento) {
    const erro = new Error("Já existe um cliente cadastrado com esse CPF/CNPJ.");
    erro.codigo = "DOCUMENTO_DUPLICADO";
    erro.cliente = existentePorDocumento;
    throw erro;
  }

  const novo = await api.post("/clientes", {
    nome,
    email: novoCliente.email || null,
    telefone,
    documento,
    endereco: novoCliente.endereco,
    numero: String(novoCliente.numero),
    complemento: novoCliente.complemento || null,
    cep: novoCliente.cep || null,
    bairro: novoCliente.bairro,
    cidade: novoCliente.cidade,
    estado: String(novoCliente.estado).trim().toUpperCase(),
    inscricaoEstadual: novoCliente.inscricaoEstadual || null,
    ativo: novoCliente.ativo !== false,
  });

  await catalogCache.forcarAtualizacao();
  return { clienteId: novo.id, criadoAgora: true };
}

module.exports = {
  resolverClienteId,
  encontrarClientesPorNome,
  normalizarTelefone,
  normalizarDocumento,
};
