const api = require("./apiClient");
const catalogCache = require("./catalogCache");

/**
 * Recebe o nome falado/digitado pelo usuário (ex.: "dona maria") e devolve
 * o ID do cliente correspondente. Se não achar por nome, cria um cliente novo.
 *
 * IMPORTANTE: o backend exige e-mail e telefone (@NotBlank em ClienteRequestDTO).
 * Como o áudio/texto normalmente não traz esses dados, usamos valores
 * temporários e deixamos um aviso na resposta pra gestora completar depois
 * pela tela de Clientes.
 */
async function resolverClienteId(nomeFalado) {
  if (!nomeFalado || !nomeFalado.trim()) {
    return { clienteId: null, criadoAgora: false };
  }

  const nome = nomeFalado.trim();
  const clientes = await catalogCache.getClientes();

  const encontrado = clientes.find(
    (c) => c.nome.toLowerCase() === nome.toLowerCase(),
  );
  if (encontrado) return { clienteId: encontrado.id, criadoAgora: false };

  const parcial = clientes.find((c) =>
    c.nome.toLowerCase().includes(nome.toLowerCase()),
  );
  if (parcial) return { clienteId: parcial.id, criadoAgora: false };

  // Não achou — cria cliente novo. Email/telefone são obrigatórios no
  // backend, então usamos placeholders únicos (baseados no nome + horário)
  // pra não violar constraint de e-mail único, se houver.
  const slug = nome.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
  const novo = await api.post("/clientes", {
    nome,
    email: `${slug || "cliente"}.${Date.now()}@pendente.com`,
    telefone: "(00) 00000-0000",
    ativo: true,
  });
  await catalogCache.forcarAtualizacao();
  return { clienteId: novo.id, criadoAgora: true };
}

module.exports = { resolverClienteId };