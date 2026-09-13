const api = require("./apiClient");
const catalogCache = require("./catalogCache");
const { resolverClienteId, encontrarClientesPorNome } = require("./clienteResolver");
const { interpretarMensagem } = require("./aiService");

const POTES_POR_CAIXA = 6;

// ============================================================
// MEMÓRIA DAS CONVERSAS
// ============================================================

const conversas = new Map();
const estadosVenda = new Map();
const confirmacoes = new Map();
const ambiguidadesCliente = new Map();
const ultimoClientePorChat = new Map();

function getConversa(chatId) {
  return conversas.get(chatId) || [];
}

function acrescentarConversa(chatId, linha) {
  const historico = conversas.get(chatId) || [];

  historico.push(String(linha));

  // Mantém somente as últimas 20 mensagens
  if (historico.length > 20) {
    historico.splice(0, historico.length - 20);
  }

  conversas.set(chatId, historico);
}

function limparConversa(chatId) {
  conversas.delete(chatId);
}

// ============================================================
// ESTADO DA VENDA
// ============================================================

function getEstadoVenda(chatId) {
  return estadosVenda.get(chatId) || null;
}

function salvarEstadoVenda(chatId, venda) {
  estadosVenda.set(chatId, venda);
}

function limparEstadoVenda(chatId) {
  estadosVenda.delete(chatId);
}

// ============================================================
// CONFIRMAÇÃO
// ============================================================

function getConfirmacao(chatId) {
  return confirmacoes.get(chatId) || null;
}

function salvarConfirmacao(chatId, resultado) {
  confirmacoes.set(chatId, resultado);
}

function limparConfirmacao(chatId) {
  confirmacoes.delete(chatId);
}

// ============================================================
// NORMALIZAÇÃO DE TEXTO
// ============================================================

function normalizarTexto(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function textoNormalizado(texto) {
  return normalizarTexto(texto)
    .replace(/[.!?,;:]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================
// CANCELAMENTO
// ============================================================

function ehCancelamento(texto) {
  const normalizado = textoNormalizado(texto);

  const cancelamentos = [
    "cancelar",
    "cancela",
    "cancelado",
    "cancelar venda",
    "cancela venda",
    "cancelar a venda",
    "cancela a venda",
    "nao quero",
    "não quero",
    "desistir",
    "desisto",
    "parar",
    "pare",
    "sair",
  ];

  return cancelamentos.includes(normalizado);
}

// ============================================================
// CONFIRMAÇÃO POSITIVA
// ============================================================

function ehConfirmacaoPositiva(texto) {
  const normalizado = textoNormalizado(texto);

  const positivos = [
    "sim",
    "s",
    "ss",
    "sim pode salvar",
    "pode salvar",
    "salvar",
    "confirma",
    "confirmo",
    "confirmado",
    "confirmar",
    "pode confirmar",
    "pode registrar",
    "registrar",
    "pode lançar",
    "pode lancar",
    "lanca",
    "lança",
    "ok",
    "okay",
    "certo",
    "isso",
    "isso mesmo",
    "perfeito",
  ];

  return positivos.includes(normalizado);
}

// ============================================================
// CONFIRMAÇÃO NEGATIVA
// ============================================================

function ehConfirmacaoNegativa(texto) {
  const normalizado = textoNormalizado(texto);

  const negativos = [
    "nao",
    "não",
    "n",
    "errado",
    "esta errado",
    "está errado",
    "tem erro",
    "corrigir",
    "quero corrigir",
    "preciso corrigir",
    "alterar",
    "quero alterar",
    "mudar",
    "quero mudar",
  ];

  if (negativos.includes(normalizado)) return true;
  return /^(nao|não)\b/.test(normalizado) && normalizado.length <= 120;
}

// ============================================================
// TELEFONE
// ============================================================

function extrairTelefone(texto) {
  const textoString = String(texto || "");

  const match = textoString.match(
    /(?:\+?55[\s-]*)?(?:\(?\d{2}\)?[\s-]*)?(?:9[\s-]*)?\d{4}[\s-]*\d{4}/,
  );

  if (!match) {
    return null;
  }

  const digitos = match[0].replace(/\D/g, "");

  let telefone = digitos;

  // Remove 55 quando presente
  if (telefone.startsWith("55") && telefone.length >= 12) {
    telefone = telefone.substring(2);
  }

  if (telefone.length < 10 || telefone.length > 11) {
    return null;
  }

  return telefone;
}

// ============================================================
// EXTRAÇÃO DE DADOS DE CLIENTE
// ============================================================

function extrairDadosCliente(texto) {
  const resultado = {};
  const original = String(texto || "");

  const normalizado = normalizarTexto(original);

  // CPF
  const cpf = original.match(
    /\b\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}\b/,
  );

  // CNPJ
  const cnpj = original.match(
    /\b\d{2}[.\s]?\d{3}[.\s]?\d{3}[\/\s]?\d{4}[-\s]?\d{2}\b/,
  );

  if (cpf) {
    resultado.documento = cpf[0].replace(/\D/g, "");
  } else if (cnpj) {
    resultado.documento = cnpj[0].replace(/\D/g, "");
  }

  // Nome completo ou razão social
  const nome = original.match(
    /(?:nome(?:\s+completo)?|razao\s+social|razão\s+social)\s*[:=-]\s*([^,\n;]+)/i,
  );

  if (nome) {
    resultado.nome = nome[1].trim();
  }

  // Telefone
  const telefone = extrairTelefone(original);

  if (telefone) {
    resultado.telefone = telefone;
  }

  // Número do endereço
  const numeroEndereco = original.match(
    /(?:n[ºo°]?|numero|número|n)\s*[:.]?\s*(\d+[A-Za-z]?)/i,
  );

  if (numeroEndereco) {
    resultado.numero = numeroEndereco[1];
  }

  // CEP
  const cep = original.match(/\b\d{5}-?\d{3}\b/);

  if (cep) {
    resultado.cep = cep[0].replace(/\D/g, "");
  }

  // Estado por UF
  const estados = [
    "AC",
    "AL",
    "AP",
    "AM",
    "BA",
    "CE",
    "DF",
    "ES",
    "GO",
    "MA",
    "MT",
    "MS",
    "MG",
    "PA",
    "PB",
    "PR",
    "PE",
    "PI",
    "RJ",
    "RN",
    "RS",
    "RO",
    "RR",
    "SC",
    "SP",
    "SE",
    "TO",
  ];

  const uf = original.match(
    /\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/i,
  );

  if (uf) {
    resultado.estado = uf[1].toUpperCase();
  }

  // Estado por nome
  const estadosNomes = {
    acre: "AC",
    alagoas: "AL",
    amapá: "AP",
    amapa: "AP",
    amazonas: "AM",
    bahia: "BA",
    ceará: "CE",
    ceara: "CE",
    "distrito federal": "DF",
    "espírito santo": "ES",
    "espirito santo": "ES",
    goiás: "GO",
    goias: "GO",
    maranhão: "MA",
    maranhao: "MA",
    "mato grosso": "MT",
    "mato grosso do sul": "MS",
    "minas gerais": "MG",
    pará: "PA",
    para: "PA",
    paraíba: "PB",
    paraiba: "PB",
    paraná: "PR",
    parana: "PR",
    pernambuco: "PE",
    piauí: "PI",
    piaui: "PI",
    "rio de janeiro": "RJ",
    "rio grande do norte": "RN",
    "rio grande do sul": "RS",
    rondônia: "RO",
    rondonia: "RO",
    roraima: "RR",
    "santa catarina": "SC",
    "são paulo": "SP",
    "sao paulo": "SP",
    sergipe: "SE",
    tocantins: "TO",
  };

  for (const [nome, sigla] of Object.entries(estadosNomes)) {
    if (normalizado.includes(nome)) {
      resultado.estado = sigla;
      break;
    }
  }

  // Campos escritos explicitamente
  const cidade = original.match(
    /(?:cidade)\s*[:=-]\s*([^,\n;]+)/i,
  );

  if (cidade) {
    resultado.cidade = cidade[1].trim();
  }

  const bairro = original.match(
    /(?:bairro)\s*[:=-]\s*([^,\n;]+)/i,
  );

  if (bairro) {
    resultado.bairro = bairro[1].trim();
  }

  const endereco = original.match(
    /(?:endereço|endereco|rua|avenida|av\.)\s*[:=-]?\s*([^,\n;]+?)(?=\s+(?:n[ºo°]?|numero|número|n)\s*[:.]?\s*\d+|,|;|$)/i,
  );

  if (endereco) {
    resultado.endereco = endereco[1].trim();
  }

  const email = original.match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  );

  if (email) {
    resultado.email = email[0];
  }

  // Também aceita cadastro em linguagem natural, sem exigir rótulos.
  const enderecoNatural = original.match(
    /\b(?:na|no|em)?\s*(rua|avenida|av\.?|travessa|trav\.?|alameda|praca|praça|rodovia|estrada)\s+([^,;\n]+?)\s*(?:,|\s+)n?[ºo°]?\s*(\d+[A-Za-z]?)\s*,\s*([^,;\n]+)\s*,\s*([^,;\n]+)(?:\s*[-/]\s*([A-Za-z]{2}))?/i
  );
  if (enderecoNatural) {
    if (!resultado.endereco) resultado.endereco = `${enderecoNatural[1]} ${enderecoNatural[2]}`.trim();
    if (!resultado.numero) resultado.numero = enderecoNatural[3];
    if (!resultado.bairro) resultado.bairro = enderecoNatural[4].trim();
    if (!resultado.cidade) resultado.cidade = enderecoNatural[5].trim();
    if (!resultado.estado && enderecoNatural[6]) resultado.estado = enderecoNatural[6].toUpperCase();
  }

  return resultado;
}

// ============================================================
// IDENTIFICA CLIENTE JÁ CADASTRADO
// ============================================================

function extrairClienteDaMensagem(texto, clientes) {
  const normalizado = normalizarTexto(texto);
  if (!Array.isArray(clientes) || !clientes.length) return null;

  const candidatos = clientes.filter((cliente) => {
    if (!cliente?.nome) return false;
    const nome = normalizarTexto(cliente.nome);
    return (
      normalizado === nome ||
      normalizado.includes(`cliente ${nome}`) ||
      normalizado.includes(`para ${nome}`) ||
      normalizado.includes(`de ${nome}`) ||
      (nome.length >= 4 && normalizado.includes(nome))
    );
  });

  const unicos = [...new Map(candidatos.map((c) => [String(c.id), c])).values()];
  return unicos.length === 1 ? unicos[0].nome : null;
}

// ============================================================
// MERGE DE OBJETOS
// ============================================================

function mesclarObjetos(base, novo) {
  const resultado = {
    ...(base || {}),
  };

  for (const [chave, valor] of Object.entries(novo || {})) {
    if (
      valor !== undefined &&
      valor !== null &&
      String(valor).trim() !== ""
    ) {
      resultado[chave] = valor;
    }
  }

  return resultado;
}

// ============================================================
// MERGE DE VENDA
// ============================================================

function mesclarVenda(vendaAntiga, vendaNova) {
  const resultado = {
    tipo: "venda",
    comprador: null,
    novo_cliente: null,
    forma_pagamento: null,
    tipo_cartao: null,
    parcelas: null,
    itens: [],
  };

  if (vendaAntiga) {
    Object.assign(resultado, vendaAntiga);
  }

  if (vendaNova) {
    for (const [chave, valor] of Object.entries(vendaNova)) {
      if (
        chave === "itens" &&
        Array.isArray(valor)
      ) {
        if (valor.length > 0) {
          resultado.itens = valor;
        }

        continue;
      }

      if (
        chave === "novo_cliente" &&
        valor &&
        typeof valor === "object"
      ) {
        resultado.novo_cliente = mesclarObjetos(
          resultado.novo_cliente,
          valor,
        );

        continue;
      }

      if (
        valor !== undefined &&
        valor !== null &&
        String(valor).trim() !== ""
      ) {
        resultado[chave] = valor;
      }
    }
  }

  return resultado;
}

// ============================================================
// NORMALIZA NOVO CLIENTE
// ============================================================

function normalizarEstadoNovoCliente(venda) {
  if (!venda) {
    return;
  }

  if (!venda.novo_cliente) {
    return;
  }

  const cliente = venda.novo_cliente;

  if (cliente.estado) {
    cliente.estado = String(cliente.estado)
      .trim()
      .toUpperCase();
  }

  if (cliente.telefone) {
    const telefone = String(cliente.telefone).replace(/\D/g, "");

    if (telefone.startsWith("55") && telefone.length >= 12) {
      cliente.telefone = telefone.substring(2);
    } else {
      cliente.telefone = telefone;
    }
  }

  if (cliente.documento) {
    cliente.documento = String(
      cliente.documento,
    ).replace(/\D/g, "");
  }

  if (cliente.numero !== undefined) {
    cliente.numero = String(cliente.numero);
  }
}

// ============================================================
// PREPARA ITENS DA VENDA
// ============================================================

function prepararItensVenda(venda) {
  if (!venda) {
    return;
  }

  if (!Array.isArray(venda.itens)) {
    venda.itens = [];
    return;
  }

  venda.itens = venda.itens.map((item) => {
    const novoItem = {
      ...item,
    };

    // Aceita nomes diferentes usados pela IA
    if (
      !novoItem.produto_final_id &&
      novoItem.produtoId
    ) {
      novoItem.produto_final_id =
        novoItem.produtoId;
    }

    if (
      !novoItem.produto_final_id &&
      novoItem.produto_id
    ) {
      novoItem.produto_final_id =
        novoItem.produto_id;
    }

    if (
      novoItem.quantidade === undefined &&
      novoItem.quantidade_potes !== undefined
    ) {
      novoItem.quantidade =
        novoItem.quantidade_potes;
    }

    if (
      novoItem.quantidade === undefined &&
      novoItem.quantidade_caixas !== undefined
    ) {
      novoItem.quantidade =
        novoItem.quantidade_caixas;
      novoItem.tipo = "caixa";
    }

    if (
      novoItem.preco_unitario === undefined &&
      novoItem.valorUnitario !== undefined
    ) {
      novoItem.preco_unitario =
        novoItem.valorUnitario;
    }

    if (
      novoItem.preco_unitario === undefined &&
      novoItem.preco !== undefined
    ) {
      novoItem.preco_unitario =
        novoItem.preco;
    }

    if (
      novoItem.quantidade !== undefined
    ) {
      novoItem.quantidade = Number(
        novoItem.quantidade,
      );
    }

    if (
      novoItem.preco_unitario !== undefined &&
      novoItem.preco_unitario !== null
    ) {
      novoItem.preco_unitario = Number(
        novoItem.preco_unitario,
      );
    }

    // Normaliza tamanho do pote
    if (novoItem.tamanho) {
      const tamanhoTexto = String(
        novoItem.tamanho,
      ).toLowerCase();

      if (
        tamanhoTexto.includes("22")
      ) {
        novoItem.tamanho = 22;
      }

      if (
        tamanhoTexto.includes("44")
      ) {
        novoItem.tamanho = 44;
      }
    }

    return novoItem;
  });
}

// ============================================================
// CAMPOS FALTANTES DA VENDA
// ============================================================

function identificarFaltantesVenda(venda) {
  const faltantes = [];

  if (!venda) {
    return [
      "cliente",
      "produto",
      "quantidade",
      "tamanho",
      "pagamento",
    ];
  }

  if (
    !venda.comprador &&
    !venda.novo_cliente
  ) {
    faltantes.push("cliente");
  }

  if (venda.novo_cliente) {
    const cliente = venda.novo_cliente;

    const dadosClienteFaltantes = [];

    if (!cliente.nome) {
      dadosClienteFaltantes.push("nome");
    }

    if (!cliente.documento) {
      dadosClienteFaltantes.push("cpf_cnpj");
    }

    if (!cliente.telefone) {
      dadosClienteFaltantes.push("telefone");
    }

    if (!cliente.estado) {
      dadosClienteFaltantes.push("estado");
    }

    if (!cliente.cidade) {
      dadosClienteFaltantes.push("cidade");
    }

    if (!cliente.bairro) {
      dadosClienteFaltantes.push("bairro");
    }

    if (!cliente.endereco) {
      dadosClienteFaltantes.push("endereco");
    }

    if (!cliente.numero) {
      dadosClienteFaltantes.push("numero");
    }

    for (const campo of dadosClienteFaltantes) {
      faltantes.push(campo);
    }
  }

  if (
    !Array.isArray(venda.itens) ||
    venda.itens.length === 0
  ) {
    faltantes.push("produto");
    faltantes.push("quantidade");
    faltantes.push("tamanho");
  } else {
    const item = venda.itens[0];

    if (!item.produto_final_id) {
      faltantes.push("produto");
    }

    if (
      !item.quantidade ||
      Number(item.quantidade) <= 0
    ) {
      faltantes.push("quantidade");
    }

    if (
      !item.tamanho &&
      !item.tamanho_pote &&
      !item.tipo_pote
    ) {
      faltantes.push("tamanho");
    }
  }

  if (!venda.forma_pagamento) {
    faltantes.push("pagamento");
  }

  const pagamento = normalizarTexto(
    venda.forma_pagamento,
  );

  if (
    pagamento.includes("cartao") ||
    pagamento.includes("cartão")
  ) {
    if (!venda.tipo_cartao) {
      faltantes.push("tipo_cartao");
    }

    if (
      venda.parcelas === undefined ||
      venda.parcelas === null ||
      venda.parcelas === ""
    ) {
      faltantes.push("parcelas");
    }
  }

  return [...new Set(faltantes)];
}

// ============================================================
// CHECKLIST INICIAL
// ============================================================

function montarChecklistInicialVenda() {
  return (
    "Vamos registrar a venda.\n\n" +
    "Me envie estas informações:\n\n" +
    "Cliente:\n" +
    "Produto:\n" +
    "Quantidade (potes ou caixas):\n" +
    "Tamanho do pote (22 ou 44):\n" +
    "Forma de pagamento (Pix, dinheiro, cartão):\n" +
    "Se for cartão, informe crédito ou débito e o número de parcelas."
  );
}

// ============================================================
// CHECKLIST PARA CADASTRO DE NOVO CLIENTE
// ============================================================

function montarChecklistNovoCliente(nome = "") {
  return (
    "Não encontrei esse cliente cadastrado no sistema. " +
    "Para cadastrar o cliente, preciso de todos estes dados:\n\n" +
    `Nome completo ou razão social: ${nome || ""}\n` +
    "Telefone:\n" +
    "CPF ou CNPJ:\n" +
    "Rua ou logradouro:\n" +
    "Número:\n" +
    "Bairro:\n" +
    "Cidade:\n" +
    "Estado (UF):"
  );
}

// ============================================================
// CHECKLIST DOS CAMPOS FALTANTES
// ============================================================

function montarChecklistFaltantes(
  faltantes,
  introducao = "Ainda faltam algumas informações:",
) {
  const nomes = {
    cliente: "Cliente",
    produto: "Produto",
    quantidade: "Quantidade (potes ou caixas)",
    tamanho: "Tamanho do pote (22 ou 44)",
    pagamento: "Forma de pagamento",
    tipo_cartao: "Tipo do cartão (crédito ou débito)",
    parcelas: "Quantidade de parcelas",
    nome: "Nome completo ou razão social",
    cpf_cnpj: "CPF ou CNPJ do cliente",
    telefone: "Telefone do cliente",
    estado: "Estado do cliente",
    cidade: "Cidade do cliente",
    bairro: "Bairro do cliente",
    endereco: "Endereço do cliente",
    numero: "Número do endereço",
  };

  const linhas = faltantes
    .map((campo) => `• ${nomes[campo] || campo}`)
    .join("\n");

  return `${introducao}\n\n${linhas}`;
}

// ============================================================
// PERGUNTA PARA UM ÚNICO CAMPO
// ============================================================

function perguntaParaFaltante(faltantes) {
  if (!faltantes || faltantes.length === 0) {
    return null;
  }

  const campo = faltantes[0];

  const perguntas = {
    cliente:
      "Qual é o cliente dessa venda?",

    produto:
      "Qual produto foi vendido?",

    quantidade:
      "Qual foi a quantidade? Pode informar em potes ou caixas.",

    tamanho:
      "Qual o tamanho do pote: 22 ou 44?",

    pagamento:
      "Qual foi a forma de pagamento? Pix, dinheiro ou cartão?",

    tipo_cartao:
      "O cartão foi crédito ou débito?",

    parcelas:
      "Em quantas parcelas foi a venda?",

    cpf_cnpj:
      "Informe o CPF ou CNPJ do novo cliente.",

    telefone:
      "Informe o telefone do novo cliente com DDD.",

    estado:
      "Qual é o estado do novo cliente?",

    cidade:
      "Qual é a cidade do novo cliente?",

    bairro:
      "Qual é o bairro do novo cliente?",

    endereco:
      "Qual é o endereço do novo cliente?",

    numero:
      "Qual é o número do endereço do novo cliente?",
  };

  return (
    perguntas[campo] ||
    `Informe: ${campo}.`
  );
}

// ============================================================
// VALIDAÇÃO FINAL DA VENDA
// ============================================================

function validarVendaParaConfirmacao(venda) {
  if (!venda) {
    return "Os dados da venda não foram encontrados.";
  }

  if (
    !venda.comprador &&
    !venda.novo_cliente
  ) {
    return "Informe o cliente da venda.";
  }

  if (
    venda.novo_cliente &&
    !venda.comprador
  ) {
    const cliente = venda.novo_cliente;

    const camposObrigatorios = [
      ["nome", "nome completo ou razão social"],
      ["documento", "CPF ou CNPJ"],
      ["telefone", "telefone"],
      ["estado", "estado"],
      ["cidade", "cidade"],
      ["bairro", "bairro"],
      ["endereco", "endereço"],
      ["numero", "número do endereço"],
    ];

    for (const [campo, nome] of camposObrigatorios) {
      if (!cliente[campo]) {
        return `Informe o ${nome} do novo cliente.`;
      }
    }
  }

  if (
    !Array.isArray(venda.itens) ||
    venda.itens.length === 0
  ) {
    return "Informe pelo menos um produto na venda.";
  }

  for (const item of venda.itens) {
    if (!item.produto_final_id) {
      return "Não consegui identificar o produto vendido.";
    }

    if (
      !item.quantidade ||
      Number(item.quantidade) <= 0
    ) {
      return "Informe uma quantidade válida.";
    }

    const tamanho =
      item.tamanho ||
      item.tamanho_pote ||
      item.tipo_pote;

    if (
      Number(tamanho) !== 22 &&
      Number(tamanho) !== 44
    ) {
      return "O tamanho do pote precisa ser 22 ou 44.";
    }

    // Preço pode vir da IA ou ser calculado abaixo
    if (
      item.preco_unitario === undefined ||
      item.preco_unitario === null ||
      Number.isNaN(Number(item.preco_unitario))
    ) {
      item.preco_unitario =
        calcularPrecoItem(item);
    }

    if (
      item.preco_unitario === undefined ||
      item.preco_unitario === null
    ) {
      return "Não consegui identificar o preço do produto.";
    }
  }

  if (!venda.forma_pagamento) {
    return "Informe a forma de pagamento.";
  }

  const pagamento = normalizarTexto(
    venda.forma_pagamento,
  );

  if (
    pagamento.includes("cartao")
  ) {
    if (!venda.tipo_cartao) {
      return "Informe se o cartão é crédito ou débito.";
    }

    if (
      venda.parcelas === undefined ||
      venda.parcelas === null ||
      venda.parcelas === ""
    ) {
      return "Informe a quantidade de parcelas.";
    }
  }

  return null;
}

// ============================================================
// PREÇOS DOS PRODUTOS
// ============================================================

function calcularPrecoItem(item) {
  const nome = normalizarTexto(
    item.produto_nome ||
      item.nome ||
      item.produto ||
      "",
  );

  const tamanho = Number(
    item.tamanho ||
      item.tamanho_pote ||
      item.tipo_pote,
  );

  if (nome.includes("fondant")) {
    if (tamanho === 22) return 20.70;
    if (tamanho === 44) return 21.30;
  }

  if (nome.includes("biriba")) {
    return 19.70;
  }

  if (nome.includes("pacoca") || nome.includes("paçoca")) {
    return 18.70;
  }

  return null;
}

// ============================================================
// CONFIRMAÇÃO DA VENDA
// ============================================================

function montarConfirmacaoVenda(venda) {
  let texto = "Confira os dados da venda:\n\n";

  texto += `Cliente: ${
    venda.comprador ||
    venda.novo_cliente?.nome ||
    "Novo cliente"
  }\n`;

  if (venda.novo_cliente) {
    texto += "Cliente novo: sim\n";

    if (venda.novo_cliente.documento) {
      texto += `CPF/CNPJ: ${venda.novo_cliente.documento}\n`;
    }
  }

  if (Array.isArray(venda.itens)) {
    texto += "\nProdutos:\n";

    for (const item of venda.itens) {
      const quantidade =
        item.quantidade || 0;

      const tipo =
        item.tipo === "caixa"
          ? `caixa(s) = ${quantidade * POTES_POR_CAIXA} potes`
          : `${quantidade} pote(s)`;

      const tamanho =
        item.tamanho ||
        item.tamanho_pote ||
        item.tipo_pote ||
        "?";

      const preco =
        Number(item.preco_unitario || 0);

      texto += `• ${
        item.produto_nome ||
        item.nome ||
        item.produto ||
        "Produto"
      }\n`;

      texto += `  Quantidade: ${tipo}\n`;
      texto += `  Tamanho: ${tamanho}\n`;
      texto += `  Valor unitário: R$ ${preco
        .toFixed(2)
        .replace(".", ",")}\n`;
    }
  }

  texto += `\nPagamento: ${
    venda.forma_pagamento || "-"
  }`;

  if (venda.tipo_cartao) {
    texto += ` (${venda.tipo_cartao})`;
  }

  if (venda.parcelas) {
    texto += ` em ${venda.parcelas}x`;
  }

  texto +=
    "\n\nDeseja confirmar e registrar essa venda? Responda SIM ou NÃO.";

  return texto;
}

// ============================================================
// CONCLUSÃO DOS LANÇAMENTOS
// ============================================================

async function concluirLancamento(resultado) {
  if (!resultado) {
    throw new Error("Resultado do lançamento não informado.");
  }

  switch (resultado.tipo) {
    case "venda":
      return await criarVenda(resultado.venda);

    case "compra":
      return await criarCompra(
        resultado.compra ||
          resultado.compras,
      );

    case "producao":
      return await criarProducao(
        resultado.producao,
      );

    case "gasto":
    case "despesa":
      return await criarGasto(
        resultado.gasto ||
          resultado.despesa,
      );

    default:
      throw new Error(
        `Tipo de lançamento não suportado: ${resultado.tipo}`,
      );
  }
}

// ============================================================
// CRIAR VENDA
// ============================================================

async function criarVenda(venda) {
  if (!venda) {
    throw new Error("Dados da venda não informados.");
  }

  prepararItensVenda(venda);

  const erro = validarVendaParaConfirmacao(venda);

  if (erro) {
    throw new Error(erro);
  }

  let clienteId = null;
  let criadoAgora = false;

  if (venda._clienteResolvidoId) {
    clienteId = venda._clienteResolvidoId;
  } else if (venda.novo_cliente) {
    if (!venda.novo_cliente.nome) {
      venda.novo_cliente.nome = venda.comprador || null;
    }

    if (!venda.novo_cliente.nome) {
      throw new Error(
        "O nome completo ou razão social do novo cliente não foi informado.",
      );
    }

    const resultadoCliente =
      await resolverClienteId(
        venda.novo_cliente.nome,
        venda.novo_cliente,
      );

    clienteId =
      resultadoCliente.clienteId;

    criadoAgora =
      resultadoCliente.criadoAgora;
  } else if (venda.comprador) {
    const resultadoCliente =
      await resolverClienteId(
        venda.comprador,
        null,
      );

    clienteId =
      resultadoCliente.clienteId;

    criadoAgora =
      resultadoCliente.criadoAgora;
  }

  const itens = venda.itens.map((item) => {
    let quantidade =
      Number(item.quantidade);

    if (item.tipo === "caixa") {
      quantidade =
        quantidade * POTES_POR_CAIXA;
    }

    const valorUnitario =
      Number(item.preco_unitario);

    return {
      produtoId:
        item.produto_final_id,
      quantidade,
      valorUnitario,
    };
  });

  const formaPagamento =
    String(
      venda.forma_pagamento || "pix",
    ).toUpperCase();

  delete venda._clienteResolvidoId;
  delete venda._clienteAmbiguo;

  const dadosVenda = {
    clienteId,
    dataVenda: hojeISO(),
    formaPagamento,
    statusPagamento: "PAGO",
    observacao:
      "Lançado pelo WhatsApp",
    itens,
  };

  // Informações extras somente se existirem
  if (venda.tipo_cartao) {
    dadosVenda.tipoCartao =
      String(venda.tipo_cartao).toUpperCase();
  }

  if (
    venda.parcelas !== undefined &&
    venda.parcelas !== null
  ) {
    dadosVenda.parcelas =
      Number(venda.parcelas);
  }

  console.log(
    "[FLOW] Enviando venda para API:",
    JSON.stringify(
      dadosVenda,
      null,
      2,
    ),
  );

  const criada =
    await api.post(
      "/vendas",
      dadosVenda,
    );

  console.log(
    "[FLOW] Venda criada:",
    JSON.stringify(
      criada,
      null,
      2,
    ),
  );

  let resposta =
    "Venda registrada com sucesso!";

  if (criadoAgora) {
    resposta +=
      "\n\nO novo cliente também foi cadastrado.";
  }

  if (criada?.id) {
    resposta += `\nNúmero da venda: ${criada.id}`;
  }

  return resposta;
}

// ============================================================
// CRIAR COMPRA
// ============================================================

async function criarCompra(compra) {
  if (!compra) {
    throw new Error(
      "Dados da compra não informados.",
    );
  }

  /*
   * Mantemos compatibilidade com diferentes formatos
   * que a IA pode retornar.
   */

  const fornecedorId =
    compra.fornecedorId ||
    compra.fornecedor_id ||
    null;

  const itensOriginais =
    compra.itens ||
    compra.materias_primas ||
    [];

  if (
    !Array.isArray(itensOriginais) ||
    itensOriginais.length === 0
  ) {
    throw new Error(
      "Informe pelo menos uma matéria-prima na compra.",
    );
  }

  const itens = itensOriginais.map(
    (item) => ({
      materiaPrimaId:
        item.materiaPrimaId ||
        item.materia_prima_id ||
        item.id,
      quantidade: Number(
        item.quantidade || 0,
      ),
      valorUnitario: Number(
        item.valorUnitario ||
          item.valor_unitario ||
          item.preco_unitario ||
          0,
      ),
    }),
  );

  const dados = {
    fornecedorId,
    dataCompra:
      compra.dataCompra ||
      compra.data_compra ||
      hojeISO(),
    observacao:
      compra.observacao ||
      "Lançado pelo WhatsApp",
    itens,
  };

  console.log(
    "[FLOW] Enviando compra para API:",
    JSON.stringify(
      dados,
      null,
      2,
    ),
  );

  await api.post(
    "/compras-materias-primas",
    dados,
  );

  return "Compra registrada com sucesso!";
}

// ============================================================
// CRIAR PRODUÇÃO
// ============================================================

async function criarProducao(producao) {
  if (!producao) {
    throw new Error(
      "Dados da produção não informados.",
    );
  }

  const dados = {
    produtoId:
      producao.produtoId ||
      producao.produto_id ||
      producao.produto_final_id,

    quantidade: Number(
      producao.quantidade || 0,
    ),

    dataProducao:
      producao.dataProducao ||
      producao.data_producao ||
      hojeISO(),

    observacao:
      producao.observacao ||
      "Lançado pelo WhatsApp",
  };

  if (!dados.produtoId) {
    throw new Error(
      "Informe o produto da produção.",
    );
  }

  if (
    !dados.quantidade ||
    dados.quantidade <= 0
  ) {
    throw new Error(
      "Informe uma quantidade válida para a produção.",
    );
  }

  console.log(
    "[FLOW] Enviando produção para API:",
    JSON.stringify(
      dados,
      null,
      2,
    ),
  );

  await api.post(
    "/producoes",
    dados,
  );

  return "Produção registrada com sucesso!";
}

// ============================================================
// CRIAR GASTO
// ============================================================

async function criarGasto(gasto) {
  if (!gasto) {
    throw new Error(
      "Dados do gasto não informados.",
    );
  }

  const dados = {
    descricao:
      gasto.descricao ||
      gasto.nome ||
      gasto.categoria ||
      "Gasto",

    valor: Number(
      gasto.valor ||
        gasto.valor_total ||
        0,
    ),

    data:
      gasto.data ||
      gasto.dataLancamento ||
      hojeISO(),

    observacao:
      gasto.observacao ||
      "Lançado pelo WhatsApp",
  };

  if (
    !dados.valor ||
    dados.valor <= 0
  ) {
    throw new Error(
      "Informe um valor válido para o gasto.",
    );
  }

  console.log(
    "[FLOW] Enviando gasto para API:",
    JSON.stringify(
      dados,
      null,
      2,
    ),
  );

  await api.post(
    "/lancamentos",
    dados,
  );

  return "Gasto registrado com sucesso!";
}

// ============================================================
// DATA
// ============================================================

function hojeISO() {
  const agora = new Date();

  const ano =
    agora.getFullYear();

  const mes =
    String(
      agora.getMonth() + 1,
    ).padStart(2, "0");

  const dia =
    String(
      agora.getDate(),
    ).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

// ============================================================
// CLIENTE: CONSULTA E CONTROLE DE DADOS
// ============================================================

function encontrarClientesCandidatos(nome, clientes) {
  return encontrarClientesPorNome(nome, clientes);
}

function encontrarClientePorNome(nome, clientes) {
  const candidatos = encontrarClientesCandidatos(nome, clientes);
  return candidatos.length === 1 ? candidatos[0] : null;
}

function montarEscolhaCliente(candidatos, nomeInformado) {
  const linhas = candidatos.map((c, i) => {
    const detalhes = [c.nome];
    if (c.cidade) detalhes.push(c.cidade);
    if (c.estado) detalhes.push(c.estado);
    if (c.documento) detalhes.push(`CPF/CNPJ ${c.documento}`);
    return `${i + 1}. ${detalhes.join(" — ")}`;
  });
  return `Encontrei mais de um cliente com o nome "${nomeInformado}".\n\n${linhas.join("\n")}\n\nQual deles é o correto? Responda com o número da opção ou o nome completo.`;
}

function resolverEscolhaCliente(texto, candidatos) {
  if (!candidatos?.length) return null;
  const n = textoNormalizado(texto);
  const m = n.match(/^(?:opcao|opção|numero|número|item)?\s*(\d+)$/i);
  if (m) return candidatos[Number(m[1]) - 1] || null;
  return candidatos.find((c) => normalizarTexto(c.nome) === normalizarTexto(texto)) || null;
}

function formatarClienteCompleto(cliente) {
  const campos = [
    ["Nome", cliente.nome], ["Telefone", cliente.telefone], ["CPF/CNPJ", cliente.documento],
    ["E-mail", cliente.email], ["Endereço", cliente.endereco], ["Número", cliente.numero],
    ["Complemento", cliente.complemento], ["Bairro", cliente.bairro], ["Cidade", cliente.cidade],
    ["Estado", cliente.estado], ["CEP", cliente.cep], ["Inscrição Estadual", cliente.inscricaoEstadual],
  ];
  return campos.filter(([,v]) => v !== null && v !== undefined && String(v).trim() !== "")
    .map(([l,v]) => `${l}: ${v}`).join("\n");
}

function identificarCampoClienteConsulta(texto) {
  const n=normalizarTexto(texto);
  if (/\btelefone|celular|whatsapp|numero|número\b/.test(n)) return "telefone";
  if (/\bcpf|cnpj|documento\b/.test(n)) return "documento";
  if (/\bemail|e-mail\b/.test(n)) return "email";
  if (/\bendereco|endereço|rua|logradouro\b/.test(n)) return "endereco";
  if (/\bbairro\b/.test(n)) return "bairro";
  if (/\bcidade|municipio|município\b/.test(n)) return "cidade";
  if (/\bestado|uf\b/.test(n)) return "estado";
  if (/\bcep\b/.test(n)) return "cep";
  if (/\bcomplemento\b/.test(n)) return "complemento";
  if (/\binscricao|inscrição\b/.test(n)) return "inscricaoEstadual";
  return null;
}

function ehConsultaInformacaoCliente(texto) {
  const n=normalizarTexto(texto);
  return /\b(qual|quais|dados|tem|possui|me passa|me informe|telefone|celular|cpf|cnpj|documento|endereco|endereço|bairro|cidade|estado|cep|email|numero|número)\b/.test(n) && /\b(cliente|dele|dela|desse|dessa|esse|essa|cadastrado|cadastrada)\b/.test(n);
}

function ehConsultaCadastroCliente(texto) {
  const n = normalizarTexto(texto);

  return (
    (
      n.includes("cadastrada") ||
      n.includes("cadastrado") ||
      n.includes("cadastro")
    ) &&
    (
      n.includes("cliente") ||
      n.includes("essa cliente") ||
      n.includes("esse cliente")
    )
  );
}

function limparDadosClienteNaoConfirmados(dadosIA, dadosDiretos) {
  const resultado = {};

  if (!dadosIA || typeof dadosIA !== "object") {
    return resultado;
  }

  const camposConfiaveis = [
    "documento",
    "telefone",
    "numero",
    "cep",
    "estado",
    "cidade",
    "bairro",
    "endereco",
    "email",
  ];

  for (const campo of camposConfiaveis) {
    if (
      dadosDiretos?.[campo] !== undefined &&
      dadosDiretos?.[campo] !== null &&
      String(dadosDiretos[campo]).trim() !== ""
    ) {
      resultado[campo] = dadosDiretos[campo];
    }
  }

  return resultado;
}

function prepararNovoClienteDaVenda(venda, clientes) {
  if (!venda?.comprador) return;
  if (venda._clienteResolvidoId) {
    const clienteResolvido = (clientes || []).find((c) => String(c.id) === String(venda._clienteResolvidoId));
    if (clienteResolvido) {
      venda.comprador = clienteResolvido.nome;
      venda.novo_cliente = null;
      venda._clienteAmbiguo = null;
      return;
    }
  }
  const candidatos = encontrarClientesCandidatos(venda.comprador, clientes);
  if (candidatos.length === 1) {
    venda.comprador = candidatos[0].nome;
    venda.novo_cliente = null;
    venda._clienteAmbiguo = null;
    return;
  }
  if (candidatos.length > 1) {
    venda._clienteAmbiguo = candidatos.map(c => ({ id:c.id, nome:c.nome, cidade:c.cidade, estado:c.estado, documento:c.documento }));
    return;
  }
  venda._clienteAmbiguo = null;
  if (!venda.novo_cliente) venda.novo_cliente = {};
  venda.novo_cliente.nome = venda.comprador;
}

function obterNomeClienteParaConsulta(texto, clientes, chatId) {
  const cliente = extrairClienteDaMensagem(texto, clientes);
  if (cliente) return cliente;
  const n = normalizarTexto(texto).replace(/\b(essa|esse|o|a|cliente|esta|está|cadastrada|cadastrado|no|na|sistema|qual|quais|dados|tem|possui|me|passa|informe|telefone|celular|cpf|cnpj|documento|endereco|endereço|bairro|cidade|estado|cep|email|numero|número|dele|dela|desse|dessa)\b/g," ").replace(/\s+/g," ").trim();
  if (!n) return ultimoClientePorChat.get(chatId) || null;
  const encontrado = clientes.find(c => { const nome=normalizarTexto(c?.nome); return nome && (n.includes(nome)||nome.includes(n)); });
  return encontrado?.nome || ultimoClientePorChat.get(chatId) || null;
}

function extrairFormaPagamento(texto) { const n=normalizarTexto(texto); if(/\bpix\b/.test(n))return "PIX"; if(/\bdinheiro\b|\bespecie\b/.test(n))return "DINHEIRO"; if(/\bcartao\b/.test(n))return "CARTAO"; if(/\bboleto\b/.test(n))return "BOLETO"; if(/\bcheque\b/.test(n))return "CHEQUE"; return null; }
function extrairTipoCartao(texto) { const n=normalizarTexto(texto); if(/\bcredito\b/.test(n))return "CREDITO"; if(/\bdebito\b/.test(n))return "DEBITO"; return null; }
function extrairParcelas(texto) { const n=normalizarTexto(texto); const m=n.match(/(?:em|de|parcelas?)[\s:]*(\d+)\s*x?\b/); return m?Number(m[1]):null; }
const NUMEROS_EXTENSO={um:1,uma:1,dois:2,duas:2,tres:3,"três":3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10};
function extrairQuantidadeUnidade(texto) { const n=normalizarTexto(texto); const m=n.match(/\b(\d+|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez)\s*(potes?|caixas?|unidades?|uni)\b/i); if(!m)return null; return {quantidade:/^\d+$/.test(m[1])?Number(m[1]):NUMEROS_EXTENSO[m[1].toLowerCase()],unidade:m[2].toLowerCase().startsWith("caixa")?"caixa":"pote"}; }
function extrairTamanho(texto) { const n=normalizarTexto(texto); if(/\b44\s*(?:uni|unidades?|por pote|pote)\b|\bpote\s*(?:de|com)\s*44\b/.test(n))return 44; if(/\b22\s*(?:uni|unidades?|por pote|pote)\b|\bpote\s*(?:de|com)\s*22\b/.test(n))return 22; return null; }
function encontrarProdutoNaMensagem(texto,produtos){const n=normalizarTexto(texto); const c=(produtos||[]).filter(p=>p?.nome&&n.includes(normalizarTexto(p.nome))); return c.length===1?c[0]:null;}
function aplicarCorrecoesDiretas(venda,texto,produtos,clientes){ if(!venda)return {clienteAmbiguo:null}; const pagamento=extrairFormaPagamento(texto); if(pagamento)venda.forma_pagamento=pagamento; const tc=extrairTipoCartao(texto); if(tc)venda.tipo_cartao=tc; const parc=extrairParcelas(texto); if(parc)venda.parcelas=parc; const t=extrairTamanho(texto); const q=extrairQuantidadeUnidade(texto); if(!Array.isArray(venda.itens))venda.itens=[]; if(venda.itens.length){if(t)venda.itens[0].tamanho=t;if(q){venda.itens[0].quantidade=q.quantidade;venda.itens[0].tipo=q.unidade;}} const p=encontrarProdutoNaMensagem(texto,produtos); if(p){if(!venda.itens.length)venda.itens.push({});venda.itens[0].produto_final_id=p.id;venda.itens[0].produto_nome=p.nome;} const c=encontrarClientesCandidatos(texto,clientes); if(c.length===1){venda.comprador=c[0].nome;venda.novo_cliente=null;} if(c.length>1)return {clienteAmbiguo:c}; return {clienteAmbiguo:null}; }
function montarResumoEstoque(produtos){const campos=["estoqueAtual","estoque_atual","estoque","quantidadeEstoque","quantidade_estoque"];const l=[];for(const p of produtos||[]){const c=campos.find(k=>p?.[k]!==undefined&&p?.[k]!==null);if(c)l.push(`${p.nome}: ${p[c]}`);}return l.length?l.join("\n"):null;}

// ============================================================
// PROCESSAMENTO PRINCIPAL
// ============================================================

async function processarMensagemInternamente(
  chatId,
  {
    texto,
    audioBase64,
    mime,
  },
) {
  try {
    if (audioBase64) {
      return "O áudio precisa ser transcrito antes de ser processado.";
    }

    if (
      !texto ||
      !String(texto).trim()
    ) {
      return "Não consegui identificar sua mensagem. Pode tentar novamente?";
    }

    const textoAtual =
      String(texto).trim();

    // ========================================================
    // CANCELAMENTO
    // ========================================================

    if (ehCancelamento(textoAtual)) {
      const tinhaVenda =
        Boolean(
          getEstadoVenda(chatId) ||
          getConfirmacao(chatId),
        );

      limparConfirmacao(chatId);
      limparEstadoVenda(chatId);
      limparConversa(chatId);

      if (tinhaVenda) {
        return "Certo. A venda foi cancelada e os dados pendentes foram descartados.";
      }

      return "Certo. Não há nenhuma venda pendente.";
    }

    // ========================================================
    // INÍCIO DE VENDA
    // ========================================================

    const textoNormal =
      textoNormalizado(textoAtual);

    const inicioVenda =
      textoNormal === "venda" ||
      textoNormal === "registrar venda" ||
      textoNormal ===
        "registrar uma venda" ||
      textoNormal ===
        "quero registrar venda" ||
      textoNormal ===
        "quero registrar uma venda" ||
      textoNormal === "nova venda" ||
      textoNormal ===
        "fazer uma venda";

    if (
      inicioVenda &&
      !getEstadoVenda(chatId)
    ) {
      const vendaInicial = {
        tipo: "venda",
        comprador: null,
        novo_cliente: null,
        forma_pagamento: null,
        tipo_cartao: null,
        parcelas: null,
        itens: [],
      };

      salvarEstadoVenda(
        chatId,
        vendaInicial,
      );

      const checklist =
        montarChecklistInicialVenda();

      acrescentarConversa(
        chatId,
        `Gestora: ${textoAtual}`,
      );

      acrescentarConversa(
        chatId,
        `Vovó: ${checklist}`,
      );

      console.log(
        "[FLOW] Nova venda iniciada sem chamar a IA.",
      );

      return checklist;
    }

    // ========================================================
    // ESTADO ATUAL
    // ========================================================

    let vendaEmAndamento =
      getEstadoVenda(chatId);

    const confirmacaoAtual =
      getConfirmacao(chatId);

    const ambiguidadePendente = ambiguidadesCliente.get(chatId);
    if (ambiguidadePendente) {
      const candidatosPendentes = ambiguidadePendente.candidatos || ambiguidadePendente;
      const escolhido = resolverEscolhaCliente(textoAtual, candidatosPendentes);
      if (!escolhido) {
        return montarEscolhaCliente(candidatosPendentes, ambiguidadePendente.nomeInformado || candidatosPendentes[0]?.nome || "");
      }

      if (ambiguidadePendente.tipo === "consulta") {
        const clientesCompletosEscolha = await catalogCache.getClientesCompletos();
        const clienteCompleto = clientesCompletosEscolha.find((c) => String(c.id) === String(escolhido.id)) || escolhido;
        ultimoClientePorChat.set(chatId, clienteCompleto.nome);
        ambiguidadesCliente.delete(chatId);
        const campo = ambiguidadePendente.campo;
        const labels = { telefone:"Telefone", documento:"CPF/CNPJ", email:"E-mail", endereco:"Endereço", bairro:"Bairro", cidade:"Cidade", estado:"Estado", cep:"CEP", complemento:"Complemento", inscricaoEstadual:"Inscrição Estadual" };
        if (campo && clienteCompleto[campo]) return `${labels[campo] || campo}: ${clienteCompleto[campo]}`;
        return `Dados de ${clienteCompleto.nome}:\n${formatarClienteCompleto(clienteCompleto)}`;
      }

      const vendaEscolha = getEstadoVenda(chatId) || confirmacaoAtual?.venda;
      if (vendaEscolha) {
        vendaEscolha.comprador = escolhido.nome;
        vendaEscolha.novo_cliente = null;
        vendaEscolha._clienteAmbiguo = null;
        vendaEscolha._clienteResolvidoId = escolhido.id;
        salvarEstadoVenda(chatId, vendaEscolha);
      }
      ultimoClientePorChat.set(chatId, escolhido.nome);
      ambiguidadesCliente.delete(chatId);
    }

    // ========================================================
    // EXTRAÇÃO DIRETA DE TELEFONE
    // ========================================================

    const telefone =
      extrairTelefone(textoAtual);

    if (
      telefone &&
      (
        vendaEmAndamento ||
        confirmacaoAtual
      )
    ) {
      const venda =
        vendaEmAndamento ||
        confirmacaoAtual.venda;

      if (venda) {
        if (!venda.novo_cliente) {
          venda.novo_cliente = {};
        }

        venda.novo_cliente.telefone =
          telefone;

        normalizarEstadoNovoCliente(
          venda,
        );

        salvarEstadoVenda(
          chatId,
          venda,
        );
      }
    }

    // ========================================================
    // CONFIRMAÇÃO POSITIVA
    // ========================================================

    const vendaPendente =
      getConfirmacao(chatId);

    if (
      vendaPendente &&
      ehConfirmacaoPositiva(
        textoAtual,
      )
    ) {
      console.log(
        "[FLOW] Venda confirmada pela Gestora.",
      );

      try {
        const resposta =
          await concluirLancamento(
            vendaPendente,
          );

        limparConfirmacao(chatId);
        limparEstadoVenda(chatId);
        limparConversa(chatId);

        return resposta;
      } catch (err) {
        console.error(
          "[FLOW] Erro ao concluir venda:",
          err.response?.data ||
            err,
        );

        const msg =
          err.response?.data
            ?.message ||
          err.response?.data
            ?.error ||
          err.message ||
          "erro desconhecido";

        return (
          `Deu um probleminha ao salvar: ${msg}\n\n` +
          "Os dados da venda continuam pendentes."
        );
      }
    }

    // ========================================================
    // CONFIRMAÇÃO NEGATIVA
    // ========================================================

    if (
      vendaPendente &&
      ehConfirmacaoNegativa(textoAtual) &&
      !/(,|\bpara\b|\bquantidade\b|\bpote\b|\bcaixa\b|\bproduto\b|\bpagamento\b|\bcliente\b|\btroca\b|\bmuda\b|\balter)/i.test(textoAtual)
    ) {
      salvarEstadoVenda(
        chatId,
        vendaPendente.venda,
      );

      limparConfirmacao(chatId);

      acrescentarConversa(
        chatId,
        `Gestora: ${textoAtual}`,
      );

      acrescentarConversa(
        chatId,
        "Vovó: Certo. O que você deseja corrigir na venda?",
      );

      return "Certo. Pode me dizer a correção do jeito que quiser, inclusive várias de uma vez. Ex.: troque o cliente para Ana, quantidade 4, pote 44 e pagamento Pix.";
    }

    // ========================================================
    // CORREÇÃO DIRETA APÓS UMA CONFIRMAÇÃO
    // ========================================================
    if (vendaPendente && !ehConfirmacaoPositiva(textoAtual)) {
      salvarEstadoVenda(chatId, vendaPendente.venda);
      limparConfirmacao(chatId);
    }

    // ========================================================
    // BUSCAR CATÁLOGO
    // ========================================================

    const produtos =
      await catalogCache.getProdutos();

    const materiasPrimas =
      await catalogCache.getMateriasPrimas();

    const clientes =
      await catalogCache.getClientes();
    const clientesCompletos =
      await catalogCache.getClientesCompletos();

    console.log(
      `[FLOW] Processando mensagem de ${chatId}: ${textoAtual}`,
    );

    // ========================================================
    // CONSULTAS DETERMINÍSTICAS À API
    // ========================================================
    if (/\bquantos\s+clientes\b|\btotal\s+de\s+clientes\b/.test(textoNormalizado(textoAtual))) {
      return `Há ${clientesCompletos.length} clientes cadastrados no sistema.`;
    }

    if (/\bestoque\b/.test(textoNormalizado(textoAtual)) && /\b(produto|produtos|tenho|tem|atualmente|quanto|quantos|disponivel|disponível)\b/.test(textoNormalizado(textoAtual))) {
      const resumo = montarResumoEstoque(produtos);
      return resumo ? `Estoque atual:\n${resumo}` : "Consultei a API, mas /produtos não trouxe o saldo de estoque. Não vou inventar esse valor.";
    }

    const nomePossivelConsulta = obterNomeClienteParaConsulta(textoAtual, clientes, chatId);
    const ehConsultaCampoCliente = Boolean(identificarCampoClienteConsulta(textoAtual) && nomePossivelConsulta);

    if (ehConsultaCadastroCliente(textoAtual) || ehConsultaInformacaoCliente(textoAtual) || ehConsultaCampoCliente) {
      const nomeConsulta = nomePossivelConsulta;
      if (!nomeConsulta) return "Qual é o nome completo ou razão social do cliente que você deseja consultar?";
      const candidatosConsulta = encontrarClientesCandidatos(nomeConsulta, clientesCompletos);
      if (candidatosConsulta.length > 1) {
        ambiguidadesCliente.set(chatId, {
          tipo: "consulta",
          nomeInformado: nomeConsulta,
          campo: identificarCampoClienteConsulta(textoAtual),
          candidatos: candidatosConsulta.map(c=>({id:c.id,nome:c.nome,cidade:c.cidade,estado:c.estado,documento:c.documento})),
        });
        return montarEscolhaCliente(candidatosConsulta,nomeConsulta);
      }
      const clienteEncontrado=candidatosConsulta[0];
      if(!clienteEncontrado)return `Não. ${nomeConsulta} não está cadastrado no sistema.`;
      ultimoClientePorChat.set(chatId,clienteEncontrado.nome);
      const campo=identificarCampoClienteConsulta(textoAtual);
      const labels={telefone:"Telefone",documento:"CPF/CNPJ",email:"E-mail",endereco:"Endereço",bairro:"Bairro",cidade:"Cidade",estado:"Estado",cep:"CEP",complemento:"Complemento",inscricaoEstadual:"Inscrição Estadual"};
      if(campo && clienteEncontrado[campo])return `${labels[campo]||campo}: ${clienteEncontrado[campo]}`;
      if(ehConsultaCadastroCliente(textoAtual))return `Sim. ${clienteEncontrado.nome} está cadastrado no sistema.`;
      return `Dados de ${clienteEncontrado.nome}:\n${formatarClienteCompleto(clienteEncontrado)}`;
    }

    // ========================================================
    // EXTRAÇÕES DIRETAS
    // ========================================================

    const clienteDireto =
      extrairClienteDaMensagem(
        textoAtual,
        clientes,
      );

    const dadosDiretos =
      extrairDadosCliente(
        textoAtual,
      );

    vendaEmAndamento =
      getEstadoVenda(chatId);

    if (vendaEmAndamento) {
      const candidatosClienteMensagem = encontrarClientesCandidatos(textoAtual, clientes);
      if (candidatosClienteMensagem.length > 1 && !extrairFormaPagamento(textoAtual) && !extrairQuantidadeUnidade(textoAtual) && !extrairTamanho(textoAtual)) {
        ambiguidadesCliente.set(chatId, { tipo: "venda", nomeInformado: textoAtual, candidatos: candidatosClienteMensagem });
        return montarEscolhaCliente(candidatosClienteMensagem, textoAtual);
      }
      const correcaoDireta = aplicarCorrecoesDiretas(vendaEmAndamento, textoAtual, produtos, clientes);
      if (correcaoDireta.clienteAmbiguo?.length) {
        ambiguidadesCliente.set(chatId, { tipo: "venda", nomeInformado: vendaEmAndamento.comprador || "", candidatos: correcaoDireta.clienteAmbiguo });
        salvarEstadoVenda(chatId, vendaEmAndamento);
        return montarEscolhaCliente(correcaoDireta.clienteAmbiguo, vendaEmAndamento.comprador || "");
      }
      salvarEstadoVenda(chatId, vendaEmAndamento);
    }

    if (vendaEmAndamento) {
      if (
        clienteDireto &&
        clienteDireto !==
          "sem telefone"
      ) {
        vendaEmAndamento.comprador =
          clienteDireto;
      }

      if (
        Object.keys(
          dadosDiretos,
        ).length > 0
      ) {
        if (
          !vendaEmAndamento.novo_cliente
        ) {
          vendaEmAndamento.novo_cliente =
            {};
        }

        vendaEmAndamento.novo_cliente =
          mesclarObjetos(
            vendaEmAndamento.novo_cliente,
            dadosDiretos,
          );
      }

      normalizarEstadoNovoCliente(
        vendaEmAndamento,
      );

      // Se já sabemos que o cliente é novo, os próximos dados
      // são tratados pelo FLOW, sem mandar a mensagem para a IA.
      if (vendaEmAndamento.novo_cliente) {
        const faltantesCliente = [
          "nome",
          "cpf_cnpj",
          "telefone",
          "estado",
          "cidade",
          "bairro",
          "endereco",
          "numero",
        ];

        const cliente = vendaEmAndamento.novo_cliente;

        const aindaFaltam = faltantesCliente.filter((campo) => {
          const chave =
            campo === "cpf_cnpj"
              ? "documento"
              : campo;
          return (
            !cliente[chave] ||
            String(cliente[chave]).trim() === ""
          );
        });

        salvarEstadoVenda(
          chatId,
          vendaEmAndamento,
        );

        if (aindaFaltam.length > 0) {
          const resposta = montarChecklistNovoCliente(
            cliente.nome ||
              vendaEmAndamento.comprador ||
              "",
          );

          acrescentarConversa(
            chatId,
            `Gestora: ${textoAtual}`,
          );

          acrescentarConversa(
            chatId,
            `Vovó: ${resposta}`,
          );

          return resposta;
        }

        // Todos os dados do novo cliente chegaram.
        // A venda continua pendente e vai para confirmação,
        // sem depender de uma nova interpretação da IA.
        prepararItensVenda(vendaEmAndamento);

        const erroClienteVenda =
          validarVendaParaConfirmacao(
            vendaEmAndamento,
          );

        if (!erroClienteVenda) {
          const confirmacao =
            montarConfirmacaoVenda(
              vendaEmAndamento,
            );

          salvarConfirmacao(
            chatId,
            {
              tipo: "venda",
              venda: vendaEmAndamento,
              faltando: [],
              perguntaProximo: null,
            },
          );

          acrescentarConversa(
            chatId,
            `Gestora: ${textoAtual}`,
          );

          acrescentarConversa(
            chatId,
            `Vovó: ${confirmacao}`,
          );

          return confirmacao;
        }
      }

      salvarEstadoVenda(
        chatId,
        vendaEmAndamento,
      );
    }

    // ========================================================
    // IA
    // ========================================================

    const resultado =
      await interpretarMensagem({
        texto: textoAtual,
        produtos,
        materiasPrimas,
        clientes,
        conversaPrevia:
          getConversa(chatId) ||
          null,
        estadoAtual:
          vendaEmAndamento ||
          null,
      });

    console.log(
      "[FLOW] Resultado da IA:",
      JSON.stringify(
        resultado,
        null,
        2,
      ),
    );

    acrescentarConversa(
      chatId,
      `Gestora: ${textoAtual}`,
    );

    if (
      !resultado ||
      !resultado.tipo
    ) {
      throw new Error(
        "A IA retornou uma resposta sem informar o tipo da ação.",
      );
    }

    // ========================================================
    // CONVERSA
    // ========================================================

    if (
      resultado.tipo ===
      "conversa"
    ) {
      const resposta =
        resultado.resposta ||
        "Como posso ajudar?";

      acrescentarConversa(
        chatId,
        `Vovó: ${resposta}`,
      );

      return resposta;
    }

    // ========================================================
    // DESCONHECIDO
    // ========================================================

    if (
      resultado.tipo ===
      "desconhecido"
    ) {
      const resposta =
        resultado.resposta ||
        "Não entendi o que você gostaria de fazer. Pode explicar de outro jeito?";

      acrescentarConversa(
        chatId,
        `Vovó: ${resposta}`,
      );

      return resposta;
    }

    // ========================================================
    // VENDA
    // ========================================================

    if (
      resultado.tipo ===
      "venda"
    ) {
      let novaVenda =
        resultado.venda;

      if (
        !novaVenda &&
        vendaEmAndamento
      ) {
        novaVenda =
          vendaEmAndamento;
      }

      if (!novaVenda) {
        novaVenda = {
          tipo: "venda",
          comprador: null,
          novo_cliente: null,
          forma_pagamento: null,
          tipo_cartao: null,
          parcelas: null,
          itens: [],
        };
      }

      novaVenda =
        mesclarVenda(
          vendaEmAndamento,
          novaVenda,
        );

      // O cadastro do cliente é controlado pelo FLOW.
      // Nunca aceitamos valores inventados pela IA para um novo cliente.
      if (novaVenda.novo_cliente && !vendaEmAndamento?.novo_cliente) {
        const dadosIACliente = novaVenda.novo_cliente;
        const dadosConfiaveis = limparDadosClienteNaoConfirmados(
          dadosIACliente,
          dadosDiretos,
        );

        novaVenda.novo_cliente = {
          ...dadosConfiaveis,
        };
      }

      if (
        clienteDireto &&
        clienteDireto !==
          "sem telefone"
      ) {
        novaVenda.comprador =
          clienteDireto;
        ultimoClientePorChat.set(chatId, clienteDireto);
      }

      if (
        Object.keys(
          dadosDiretos,
        ).length > 0
      ) {
        if (
          !novaVenda.novo_cliente
        ) {
          novaVenda.novo_cliente =
            {};
        }

        novaVenda.novo_cliente =
          mesclarObjetos(
            novaVenda.novo_cliente,
            dadosDiretos,
          );
      }

      if (telefone) {
        if (
          !novaVenda.novo_cliente
        ) {
          novaVenda.novo_cliente =
            {};
        }

        novaVenda.novo_cliente.telefone =
          telefone;
      }

      // Verifica no catálogo REAL se o cliente existe.
      // Se não existir, transforma a venda em cadastro pendente.
      prepararNovoClienteDaVenda(
        novaVenda,
        clientes,
      );

      if (novaVenda._clienteAmbiguo?.length) {
        ambiguidadesCliente.set(chatId, {
          tipo: "venda",
          nomeInformado: novaVenda.comprador || "",
          candidatos: novaVenda._clienteAmbiguo,
        });
        salvarEstadoVenda(chatId, novaVenda);
        return montarEscolhaCliente(novaVenda._clienteAmbiguo, novaVenda.comprador || "");
      }

      normalizarEstadoNovoCliente(
        novaVenda,
      );

      prepararItensVenda(
        novaVenda,
      );

      delete novaVenda._clienteAmbiguo;
      delete novaVenda._chatId;
      salvarEstadoVenda(
        chatId,
        novaVenda,
      );

      const faltantes =
        identificarFaltantesVenda(
          novaVenda,
        );

      console.log(
        "[FLOW] Estado da venda:",
        JSON.stringify(
          novaVenda,
          null,
          2,
        ),
      );

      console.log(
        "[FLOW] Faltantes:",
        faltantes,
      );

      // ======================================================
      // AINDA FALTAM DADOS
      // ======================================================

      if (
        faltantes.length > 0
      ) {
        let resposta;

        const faltantesCliente = faltantes.filter((campo) =>
          [
            "nome",
            "cpf_cnpj",
            "telefone",
            "estado",
            "cidade",
            "bairro",
            "endereco",
            "numero",
          ].includes(campo),
        );

        if (faltantesCliente.length > 0) {
          resposta = montarChecklistNovoCliente(
            novaVenda.novo_cliente?.nome ||
              novaVenda.comprador ||
              "",
          );
        } else if (
          faltantes.length > 1
        ) {
          resposta =
            montarChecklistFaltantes(
              faltantes,
              "Para continuar, me manda essas informações:",
            );
        } else {
          resposta =
            perguntaParaFaltante(
              faltantes,
            );
        }

        if (resposta) {
          acrescentarConversa(
            chatId,
            `Vovó: ${resposta}`,
          );

          return resposta;
        }
      }

      // ======================================================
      // VALIDAR
      // ======================================================

      const erro =
        validarVendaParaConfirmacao(
          novaVenda,
        );

      if (erro) {
        acrescentarConversa(
          chatId,
          `Vovó: ${erro}`,
        );

        return erro;
      }

      // ======================================================
      // CONFIRMAÇÃO
      // ======================================================

      const confirmacao =
        montarConfirmacaoVenda(
          novaVenda,
        );

      const resultadoConfirmacao =
        {
          tipo: "venda",
          venda: novaVenda,
          faltando: [],
          perguntaProximo: null,
        };

      salvarConfirmacao(
        chatId,
        resultadoConfirmacao,
      );

      acrescentarConversa(
        chatId,
        `Vovó: ${confirmacao}`,
      );

      return confirmacao;
    }

    // ========================================================
    // OUTROS LANÇAMENTOS
    // ========================================================

    try {
      const resposta =
        await concluirLancamento(
          resultado,
        );

      limparConversa(chatId);

      return resposta;
    } catch (err) {
      console.error(
        "[FLOW] Erro ao concluir lançamento:",
        err.response?.data ||
          err,
      );

      const msg =
        err.response?.data
          ?.message ||
        err.response?.data
          ?.error ||
        err.message ||
        "erro desconhecido";

      return `Deu um probleminha ao salvar: ${msg}`;
    }
  } catch (error) {
    console.error(
      "========================================",
    );

    console.error(
      "[FLOW] ERRO REAL:",
    );

    console.error(
      error.response?.data ||
        error,
    );

    console.error(
      error.stack,
    );

    console.error(
      "========================================",
    );

    return "Tive um probleminha para entender sua mensagem. Pode tentar novamente?";
  }
}

// ============================================================
// FUNÇÃO PÚBLICA USADA PELO BOT.JS
// ============================================================

async function processarMensagem(
  chatId,
  dados,
) {
  return await processarMensagemInternamente(
    chatId,
    dados,
  );
}

// ============================================================
// EXPORTAÇÃO
// ============================================================

module.exports = {
  processarMensagem,
};