const api = require("./apiClient");
const catalogCache = require("./catalogCache");

/**
 * Recebe o nome falado/digitado pelo usuário (ex.: "dona maria") e devolve
 * o ID do cliente correspondente.
 *
 * Se não encontrar no catálogo:
 * - Se `dadosCadastro` foi fornecido (vindo de resultado.venda.novo_cliente,
 *   já validado pela IA como completo), cria o cliente com esses dados reais
 *   + e-mail/telefone gerados automaticamente (o backend exige esses campos,
 *   mas não são relevantes pro fluxo de vendas por WhatsApp).
 * - Se não foi fornecido, lança um erro claro. Isso não deveria acontecer
 *   em condições normais, porque o flow.js só chama criarVenda depois que
 *   a IA confirma que não há nada faltando — mas fica como rede de segurança.
 */
async function resolverClienteId(nomeFalado, dadosCadastro) {
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

  // Cliente não encontrado no catálogo.
  const camposObrigatorios = [
    "documento",
    "estado",
    "cidade",
    "bairro",
    "endereco",
    "numero",
  ];

  const faltando = camposObrigatorios.filter(
    (campo) => !dadosCadastro || !String(dadosCadastro[campo] || "").trim(),
  );

  if (faltando.length > 0) {
    throw new Error(
      `Não encontrei "${nome}" no cadastro e faltam dados para criar o cliente novo (${faltando.join(", ")}). ` +
      `Me manda o CPF ou CNPJ, estado, cidade, bairro, endereço e número numa mensagem só. 💛`,
    );
  }

  const slug = nome
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");

  const novo = await api.post("/clientes", {
    nome,
    email: `${slug || "cliente"}.${Date.now()}@pendente.com`,
    telefone: "(00) 00000-0000",
    documento: dadosCadastro.documento.trim(),
    estado: dadosCadastro.estado.trim(),
    cidade: dadosCadastro.cidade.trim(),
    bairro: dadosCadastro.bairro.trim(),
    endereco: dadosCadastro.endereco.trim(),
    numero: dadosCadastro.numero.trim(),
    ativo: true,
  });

  await catalogCache.forcarAtualizacao();

  return { clienteId: novo.id, criadoAgora: true };
}

module.exports = { resolverClienteId };