const api = require("./apiClient");
const catalogCache = require("./catalogCache");

function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizarEstado(valor) {
  if (!valor) return "";

  const estado = normalizarTexto(valor);

  const estados = {
    acre: "AC",
    alagoas: "AL",
    amapá: "AP",
    amapa: "AP",
    amazonas: "AM",
    bahia: "BA",
    ceara: "CE",
    "ceará": "CE",
    "distrito federal": "DF",
    espirito: "ES",
    "espirito santo": "ES",
    "espírito santo": "ES",
    goias: "GO",
    "goiás": "GO",
    maranhao: "MA",
    "maranhão": "MA",
    "mato grosso": "MT",
    "mato grosso do sul": "MS",
    "minas gerais": "MG",
    para: "PA",
    pará: "PA",
    paraiba: "PB",
    "paraíba": "PB",
    parana: "PR",
    "paraná": "PR",
    pernambuco: "PE",
    piaui: "PI",
    "piauí": "PI",
    "rio de janeiro": "RJ",
    "rio grande do norte": "RN",
    "rio grande do sul": "RS",
    rondonia: "RO",
    "rondônia": "RO",
    roraima: "RR",
    "santa catarina": "SC",
    "sao paulo": "SP",
    "são paulo": "SP",
    sergipe: "SE",
    tocantins: "TO",
  };

  const sigla = estado
    .replace(/[()]/g, " ")
    .split(/\s+/)
    .find(
      (parte) =>
        /^[a-z]{2}$/.test(parte),
    );

  if (sigla) {
    return sigla.toUpperCase();
  }

  return (
    estados[estado] ||
    ""
  );
}

async function resolverClienteId(
  nomeFalado,
  dadosCadastro,
) {
  if (
    !nomeFalado ||
    !nomeFalado.trim()
  ) {
    return {
      clienteId: null,
      criadoAgora: false,
    };
  }

  const nome =
    nomeFalado.trim();

  const clientes =
    await catalogCache.getClientes();

  const nomeNormalizado =
    normalizarTexto(nome);

  const encontrado =
    clientes.find(
      (c) =>
        normalizarTexto(c.nome) ===
        nomeNormalizado,
    );

  if (encontrado) {
    return {
      clienteId: encontrado.id,
      criadoAgora: false,
    };
  }

  const parcial =
    clientes.find((c) =>
      normalizarTexto(c.nome).includes(
        nomeNormalizado,
      ),
    );

  if (parcial) {
    return {
      clienteId: parcial.id,
      criadoAgora: false,
    };
  }

  if (!dadosCadastro) {
    throw new Error(
      `Não encontrei "${nome}" no cadastro e ainda não tenho os dados necessários para criar o cliente.`,
    );
  }

  const camposObrigatorios = [
    "documento",
    "estado",
    "cidade",
    "bairro",
    "endereco",
    "numero",
  ];

  const faltando =
    camposObrigatorios.filter(
      (campo) =>
        !String(
          dadosCadastro[campo] || "",
        ).trim(),
    );

  if (faltando.length > 0) {
    throw new Error(
      `Não encontrei "${nome}" no cadastro e faltam dados para criar o cliente novo (${faltando.join(", ")}).`,
    );
  }

  const estado =
    normalizarEstado(
      dadosCadastro.estado,
    );

  if (!estado) {
    throw new Error(
      "Não consegui identificar uma sigla de estado válida para o cliente.",
    );
  }

  /*
   * IMPORTANTE:
   * Não criamos mais e-mail falso.
   * Não criamos mais telefone falso.
   *
   * O backend possui esses campos como opcionais.
   */

  const novo =
    await api.post(
      "/clientes",
      {
        nome,

        email: null,

        telefone: null,

        documento:
          String(
            dadosCadastro.documento,
          ).trim(),

        estado,

        cidade:
          String(
            dadosCadastro.cidade,
          ).trim(),

        bairro:
          String(
            dadosCadastro.bairro,
          ).trim(),

        endereco:
          String(
            dadosCadastro.endereco,
          ).trim(),

        numero:
          String(
            dadosCadastro.numero,
          ).trim(),

        ativo: true,
      },
    );

  await catalogCache.forcarAtualizacao();

  return {
    clienteId: novo.id,
    criadoAgora: true,
  };
}

module.exports = {
  resolverClienteId,
};
