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

function valorNome(cliente) {
  return cliente?.nome || cliente?.nomeCompleto || cliente?.razaoSocial || cliente?.razao_social || "";
}

function valorDocumento(cliente) {
  return cliente?.documento || cliente?.cpfCnpj || cliente?.cpf_cnpj || cliente?.cpf || cliente?.cnpj || "";
}

function encontrarClientesPorNome(nome, clientes) {
  if (!nome || !Array.isArray(clientes)) return [];
  const alvo = normalizarTexto(nome).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (alvo.length < 3) return [];
  const lista = clientes.filter((c) => valorNome(c));
  const exatos = lista.filter((c) => normalizarTexto(valorNome(c)).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim() === alvo);
  if (exatos.length) return exatos;

  // Correspondência por nome completo contido na frase, nunca por palavras muito curtas.
  const contidos = lista.filter((c) => {
    const n = normalizarTexto(valorNome(c)).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    return n.length >= 5 && (alvo.includes(n) || n.includes(alvo));
  });
  if (contidos.length) return contidos;

  // Correspondência aproximada por tokens só é aceita se houver um único candidato.
  const tokensAlvo = new Set(alvo.split(" ").filter((t) => t.length >= 3));
  if (tokensAlvo.size < 2) return [];
  const ranqueados = lista.map((c) => {
    const tokens = new Set(normalizarTexto(valorNome(c)).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length >= 3));
    const comuns = [...tokensAlvo].filter((t) => tokens.has(t)).length;
    return { cliente: c, comuns, total: tokens.size };
  }).filter((x) => x.comuns >= 2 && x.comuns / Math.max(1, x.total) >= 0.5).sort((a, b) => b.comuns - a.comuns);
  if (!ranqueados.length) return [];
  if (ranqueados.length > 1 && ranqueados[0].comuns === ranqueados[1].comuns) return ranqueados.map((x) => x.cliente);
  return [ranqueados[0].cliente];
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

  const telefone = normalizarTelefone(dados.telefone);
  const documento = normalizarDocumento(dados.documento);

  if (!telefone) return "Informe um telefone válido com DDD.";
  if (!documento) return "Informe um CPF ou CNPJ válido.";

  // Evita aceitar como telefone os primeiros dígitos do CPF/CNPJ.
  if (
    telefone === documento ||
    (documento.length >= 11 && telefone.length >= 10 && documento.startsWith(telefone))
  ) {
    return "O telefone informado parece ser parte do CPF/CNPJ. Informe o telefone correto do cliente com DDD.";
  }

  return null;
}

async function resolverClienteId(nomeFalado, novoCliente = null) {
  const nome = String(nomeFalado || "").trim();
  if (!nome) return { clienteId: null, criadoAgora: false };

  let clientes = await catalogCache.getClientesCompletos();
  let candidatos = encontrarClientesPorNome(nome, clientes);

  // Uma busca vazia pode ser causada por cache expirado ou cadastro recém-criado.
  if (candidatos.length === 0) {
    await catalogCache.forcarAtualizacao();
    clientes = await catalogCache.getClientesCompletos();
    candidatos = encontrarClientesPorNome(nome, clientes);
  }

  if (candidatos.length === 1) {
    const clienteId = candidatos[0].id ?? candidatos[0].clienteId ?? candidatos[0].idCliente;
    if (clienteId === undefined || clienteId === null) {
      throw new Error(`Encontrei o cliente "${valorNome(candidatos[0])}", mas a API não retornou seu identificador. Não vou criar outro cadastro.`);
    }
    return { clienteId, criadoAgora: false };
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
    (c) => somenteDigitos(valorDocumento(c)) === documento,
  );
  if (existentePorDocumento) {
    const erro = new Error("Já existe um cliente cadastrado com esse CPF/CNPJ.");
    erro.codigo = "DOCUMENTO_DUPLICADO";
    erro.cliente = existentePorDocumento;
    throw erro;
  }

  const novoResposta = await api.post("/clientes", {
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
  const novo = novoResposta?.data || novoResposta?.cliente || novoResposta;
  const clienteId = novo?.id ?? novo?.clienteId ?? novo?.idCliente;
  if (clienteId === undefined || clienteId === null) {
    throw new Error("O cliente pode ter sido enviado para cadastro, mas a API não retornou o identificador. Confira o sistema antes de tentar novamente para evitar duplicidade.");
  }
  return { clienteId, criadoAgora: true };
}

module.exports = {
  resolverClienteId,
  encontrarClientesPorNome,
  normalizarTexto,
  normalizarTelefone,
  normalizarDocumento,
};
