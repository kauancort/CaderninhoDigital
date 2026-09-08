const api = require("./apiClient");
const catalogCache = require("./catalogCache");

const {
  resolverClienteId,
} = require("./clienteResolver");

const {
  interpretarMensagem,
} = require("./aiService");

const POTES_POR_CAIXA = 6;

const conversas = new Map();
const confirmacoesPendentes = new Map();
const filas = new Map();

/*
 * Guarda o estado estruturado da conversa.
 *
 * Exemplo:
 *
 * {
 *   tipo: "venda",
 *   comprador: "Mariana Souza Lima",
 *   novo_cliente: {
 *      documento: "...",
 *      estado: "RS",
 *      cidade: "...",
 *      bairro: "...",
 *      endereco: "...",
 *      numero: "...",
 *      telefone: "51991234567"
 *   },
 *   forma_pagamento: "PIX",
 *   itens: [...]
 * }
 */

const estadosVenda = new Map();

/* =========================================================
   FILA
========================================================= */

function executarNaFila(
  chatId,
  tarefa,
) {
  const anterior =
    filas.get(chatId) ||
    Promise.resolve();

  const atual =
    anterior
      .catch(() => {})
      .then(tarefa);

  filas.set(
    chatId,
    atual.finally(() => {
      if (
        filas.get(chatId) ===
        atual
      ) {
        filas.delete(chatId);
      }
    }),
  );

  return atual;
}

/* =========================================================
   CONVERSA
========================================================= */

function getConversa(chatId) {
  return (
    conversas.get(chatId) ||
    ""
  );
}

function acrescentarConversa(
  chatId,
  linha,
) {
  const atual =
    conversas.get(chatId) ||
    "";

  conversas.set(
    chatId,
    atual
      ? `${atual}\n${linha}`
      : linha,
  );
}

function limparConversa(
  chatId,
) {
  conversas.delete(chatId);
}

function salvarEstadoVenda(
  chatId,
  venda,
) {
  estadosVenda.set(
    chatId,
    venda,
  );
}

function getEstadoVenda(
  chatId,
) {
  return estadosVenda.get(
    chatId,
  );
}

function limparEstadoVenda(
  chatId,
) {
  estadosVenda.delete(chatId);
}

/* =========================================================
   CONFIRMAÇÃO
========================================================= */

function salvarConfirmacao(
  chatId,
  resultado,
) {
  confirmacoesPendentes.set(
    chatId,
    resultado,
  );
}

function getConfirmacao(
  chatId,
) {
  return confirmacoesPendentes.get(
    chatId,
  );
}

function limparConfirmacao(
  chatId,
) {
  confirmacoesPendentes.delete(
    chatId,
  );
}

/* =========================================================
   TEXTO
========================================================= */

function textoNormalizado(
  texto,
) {
  return String(texto || "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .trim()
    .toLowerCase();
}

function somenteDigitos(
  texto,
) {
  return String(texto || "")
    .replace(/\D/g, "");
}

/* =========================================================
   CANCELAMENTO
========================================================= */

function ehCancelamento(
  texto,
) {
  const t =
    textoNormalizado(texto);

  return [
    "cancelar",
    "cancela",
    "cancelado",
    "desistir",
    "desisto",
    "pare",
    "parar",
    "nao quero",
  ].includes(t);
}

/* =========================================================
   CONFIRMAÇÃO
========================================================= */

function ehConfirmacaoPositiva(
  texto,
) {
  const t =
    textoNormalizado(texto);

  return [
    "sim",
    "isso",
    "isso mesmo",
    "correto",
    "correta",
    "pode registrar",
    "pode salvar",
    "confirma",
    "confirmo",
    "esta certo",
    "esta tudo certo",
    "pode",
  ].includes(t);
}

function ehConfirmacaoNegativa(
  texto,
) {
  const t =
    textoNormalizado(texto);

  return [
    "nao",
    "nao.",
    "esta errado",
    "errado",
    "precisa corrigir",
    "quero corrigir",
  ].includes(t);
}

/* =========================================================
   TELEFONE
========================================================= */

function extrairTelefone(
  texto,
) {
  if (!texto) {
    return null;
  }

  const original =
    String(texto).trim();

  /*
   * Aceita:
   *
   * 51991234567
   * 51 99123-4567
   * (51) 99123-4567
   * O telefone é 51991234567
   * telefone da cliente: (51)...
   */

  const candidatos =
    original.match(
      /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\d{4}[-.\s]?\d{4}|\d{4,5}[-.\s]?\d{4})/g,
    );

  if (!candidatos) {
    return null;
  }

  for (
    const candidato of candidatos
  ) {
    const digitos =
      somenteDigitos(
        candidato,
      );

    let telefone =
      digitos;

    /*
     * Remove o código 55 quando
     * ele vier junto.
     */

    if (
      telefone.length === 13 &&
      telefone.startsWith("55")
    ) {
      telefone =
        telefone.slice(2);
    }

    if (
      telefone.length === 10 ||
      telefone.length === 11
    ) {
      return telefone;
    }
  }

  return null;
}

/* =========================================================
   DOCUMENTO
========================================================= */

function extrairDocumento(
  texto,
) {
  if (!texto) {
    return null;
  }

  const cpf =
    texto.match(
      /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/,
    );

  if (cpf) {
    return somenteDigitos(
      cpf[0],
    );
  }

  const cnpj =
    texto.match(
      /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/,
    );

  if (cnpj) {
    return somenteDigitos(
      cnpj[0],
    );
  }

  return null;
}

/* =========================================================
   ESTADO
========================================================= */

/*
 * Converte nomes completos dos estados
 * para as siglas exigidas pelo backend.
 *
 * Exemplos:
 *
 * Rio de Janeiro -> RJ
 * São Paulo      -> SP
 * Minas Gerais   -> MG
 * Paraná         -> PR
 *
 * Também aceita diretamente:
 *
 * RJ -> RJ
 * SP -> SP
 */

function normalizarEstado(
  valor,
) {
  if (!valor) {
    return null;
  }

  const texto =
    textoNormalizado(
      valor,
    );

  const estados = {
    acre: "AC",
    alagoas: "AL",
    amapa: "AP",
    amazonas: "AM",
    bahia: "BA",
    ceara: "CE",
    "distrito federal": "DF",
    "espirito santo": "ES",
    goias: "GO",
    maranhao: "MA",
    "mato grosso": "MT",
    "mato grosso do sul": "MS",
    "minas gerais": "MG",
    para: "PA",
    paraiba: "PB",
    parana: "PR",
    pernambuco: "PE",
    piaui: "PI",
    "rio de janeiro": "RJ",
    "rio grande do norte": "RN",
    "rio grande do sul": "RS",
    rondonia: "RO",
    roraima: "RR",
    "santa catarina": "SC",
    "sao paulo": "SP",
    sergipe: "SE",
    tocantins: "TO",
  };

  /*
   * Se já for uma sigla,
   * mantém em maiúsculo.
   */

  const sigla =
    String(
      valor,
    )
      .trim()
      .toUpperCase();

  if (
    /^[A-Z]{2}$/.test(
      sigla,
    )
  ) {
    return sigla;
  }

  /*
   * Se for o nome completo,
   * retorna a sigla.
   */

  return (
    estados[texto] ||
    null
  );
}

/*
 * Normaliza o estado dentro
 * dos dados do novo cliente.
 *
 * Esta função é chamada antes
 * de enviar o cliente para a API.
 */

function normalizarEstadoNovoCliente(
  venda,
) {
  if (
    !venda?.novo_cliente?.estado
  ) {
    return;
  }

  const estadoOriginal =
    venda.novo_cliente.estado;

  const estadoNormalizado =
    normalizarEstado(
      estadoOriginal,
    );

  if (
    estadoNormalizado
  ) {
    venda.novo_cliente.estado =
      estadoNormalizado;

    console.log(
      `[FLOW] Estado normalizado: "${estadoOriginal}" -> "${estadoNormalizado}"`,
    );
  }
}

/* =========================================================
   EXTRAÇÃO DIRETA DE DADOS
========================================================= */

function extrairDadosCliente(
  texto,
) {
  const dados = {};

  const telefone =
    extrairTelefone(texto);

  if (telefone) {
    dados.telefone =
      telefone;
  }

  const documento =
    extrairDocumento(texto);

  if (documento) {
    dados.documento =
      documento;
  }

  /*
   * Estado
   */

  const estadoMatch =
    String(texto || "").match(
      /(?:estado|uf)\s*:\s*([^\n,]+)/i,
    );

  if (estadoMatch) {
    const estado =
      normalizarEstado(
        estadoMatch[1],
      );

    if (estado) {
      dados.estado =
        estado;
    }
  }

  /*
   * Cidade
   */

  const cidadeMatch =
    String(texto || "").match(
      /cidade\s*:\s*([^\n]+)/i,
    );

  if (cidadeMatch) {
    dados.cidade =
      cidadeMatch[1]
        .trim()
        .replace(/[.,]$/, "");
  }

  /*
   * Bairro
   */

  const bairroMatch =
    String(texto || "").match(
      /bairro\s*:\s*([^\n]+)/i,
    );

  if (bairroMatch) {
    dados.bairro =
      bairroMatch[1]
        .trim()
        .replace(/[.,]$/, "");
  }

  /*
   * Endereço
   */

  const enderecoMatch =
    String(texto || "").match(
      /(?:endereco|endereço|rua)\s*:\s*([^\n]+)/i,
    );

  if (enderecoMatch) {
    dados.endereco =
      enderecoMatch[1]
        .trim()
        .replace(/[.,]$/, "");
  }

  /*
   * Número
   */

  const numeroMatch =
    String(texto || "").match(
      /(?:numero|número|n[ºo°]?)\s*:\s*([^\n,]+)/i,
    );

  if (numeroMatch) {
    dados.numero =
      numeroMatch[1]
        .trim()
        .replace(/[.,]$/, "");
  }

  /*
   * Telefone com texto:
   *
   * "O telefone é..."
   * "telefone da cliente..."
   */

  if (!dados.telefone) {
    const telefoneTexto =
      String(texto || "").match(
        /telefone(?:\s+da\s+cliente|\s+dela)?\s*(?:é|eh|:)?\s*([+\d() .-]{10,25})/i,
      );

    if (
      telefoneTexto
    ) {
      const telefoneExtraido =
        extrairTelefone(
          telefoneTexto[1],
        );

      if (
        telefoneExtraido
      ) {
        dados.telefone =
          telefoneExtraido;
      }
    }
  }

  return dados;
}

/* =========================================================
   IDENTIFICAR CLIENTE DIRETAMENTE
========================================================= */

function extrairClienteDaMensagem(
  texto,
  clientes,
) {
  if (
    !texto ||
    !Array.isArray(clientes)
  ) {
    return null;
  }

  const original =
    String(texto).trim();

  /*
   * Não considerar números como nome.
   */

  const apenasNumeros =
    somenteDigitos(
      original,
    );

  if (
    apenasNumeros.length >= 10
  ) {
    return null;
  }

  /*
   * Procurar "cliente: Nome"
   */

  const match =
    original.match(
      /cliente\s*:\s*([^\n]+)/i,
    );

  if (match) {
    const nome =
      match[1].trim();

    const proibidos = [
      "sem telefone",
      "sem cliente",
      "telefone",
      "dados",
      "novo",
    ];

    if (
      proibidos.includes(
        textoNormalizado(nome),
      )
    ) {
      return null;
    }

    const encontrado =
      clientes.find(
        (c) =>
          textoNormalizado(
            c.nome,
          ) ===
          textoNormalizado(
            nome,
          ),
      );

    if (encontrado) {
      return encontrado.nome;
    }

    return nome;
  }

  /*
   * Procurar nomes conhecidos
   * dentro da mensagem.
   */

  const ordenados =
    [...clientes].sort(
      (a, b) =>
        String(b.nome || "")
          .length -
        String(a.nome || "")
          .length,
    );

  for (
    const cliente of ordenados
  ) {
    if (
      !cliente.nome
    ) {
      continue;
    }

    if (
      textoNormalizado(
        original,
      ).includes(
        textoNormalizado(
          cliente.nome,
        ),
      )
    ) {
      return cliente.nome;
    }
  }

  /*
   * "para cliente Mariana Souza"
   */

  const paraCliente =
    original.match(
      /(?:cliente|comprador)\s+([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+){1,5})/i,
    );

  if (paraCliente) {
    const nome =
      paraCliente[1]
        .trim();

    if (
      nome.length > 2
    ) {
      return nome;
    }
  }

  return null;
}

/* =========================================================
   DETECTAR VENDA
========================================================= */

function mensagemIndicaVenda(
  texto,
) {
  const t =
    textoNormalizado(texto);

  return (
    t.includes(
      "registrar venda",
    ) ||
    t.includes(
      "nova venda",
    ) ||
    t.includes(
      "venda para",
    ) ||
    t.includes(
      "vendi",
    ) ||
    t.includes(
      "vendeu",
    ) ||
    t.includes(
      "foi vendido",
    ) ||
    t.includes(
      "registrar uma venda",
    )
  );
}

/* =========================================================
   ATUALIZAR VENDA
========================================================= */

function mesclarObjetos(
  anterior,
  novo,
) {
  return {
    ...(anterior || {}),
    ...(novo || {}),
  };
}

function mesclarVenda(
  anterior,
  nova,
) {
  if (!anterior) {
    return nova;
  }

  if (!nova) {
    return anterior;
  }

  const venda = {
    ...anterior,
    ...nova,
  };

  /*
   * Não deixar uma resposta curta
   * apagar informações anteriores.
   */

  if (
    nova.comprador
  ) {
    venda.comprador =
      nova.comprador;
  } else {
    venda.comprador =
      anterior.comprador;
  }

  if (
    nova.novo_cliente ||
    anterior.novo_cliente
  ) {
    venda.novo_cliente =
      mesclarObjetos(
        anterior.novo_cliente,
        nova.novo_cliente,
      );
  }

  if (
    nova.forma_pagamento
  ) {
    venda.forma_pagamento =
      nova.forma_pagamento;
  }

  if (
    nova.tipo_cartao
  ) {
    venda.tipo_cartao =
      nova.tipo_cartao;
  }

  if (
    nova.parcelas != null
  ) {
    venda.parcelas =
      nova.parcelas;
  }

  if (
    Array.isArray(
      nova.itens,
    ) &&
    nova.itens.length > 0
  ) {
    venda.itens =
      nova.itens;
  } else if (
    Array.isArray(
      anterior.itens,
    )
  ) {
    venda.itens =
      anterior.itens;
  }

  /*
   * Se o estado veio pelo nome completo
   * durante a mesclagem, já normaliza.
   */

  normalizarEstadoNovoCliente(
    venda,
  );

  return venda;
}

/* =========================================================
   PREÇOS
========================================================= */

function normalizarNomeProduto(
  nome,
) {
  return String(nome || "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase()
    .trim();
}

const PRECOS = {
  fondant: {
    22: 20.70,
    44: 21.30,
  },

  biriba: {
    22: 19.70,
    44: 19.70,
  },

  pacoca: {
    22: 18.70,
    44: 18.70,
  },
};

function descobrirProdutoPorNome(
  nome,
) {
  const n =
    normalizarNomeProduto(
      nome,
    );

  if (
    n.includes("fondant") ||
    n.includes("fondan")
  ) {
    return "fondant";
  }

  if (
    n.includes("biriba") ||
    n.includes("birriba")
  ) {
    return "biriba";
  }

  if (
    n.includes("pacoca")
  ) {
    return "pacoca";
  }

  return null;
}

function aplicarPrecoOficial(
  item,
) {
  const produto =
    descobrirProdutoPorNome(
      item.produto_nome,
    );

  const tamanho =
    Number(
      item.tamanho_pote,
    );

  if (
    produto &&
    (
      tamanho === 22 ||
      tamanho === 44
    )
  ) {
    item.preco_unitario =
      PRECOS[produto][tamanho];
  }

  return item;
}

function prepararItensVenda(
  venda,
) {
  if (
    !venda ||
    !Array.isArray(
      venda.itens,
    )
  ) {
    return;
  }

  venda.itens =
    venda.itens.map(
      (item) =>
        aplicarPrecoOficial({
          ...item,
        }),
    );
}

/* =========================================================
   VALIDAÇÃO
========================================================= */

function validarVendaParaConfirmacao(
  venda,
) {
  if (
    !venda ||
    !Array.isArray(
      venda.itens,
    ) ||
    venda.itens.length === 0
  ) {
    return "Venda sem itens identificados.";
  }

  if (
    !venda.comprador ||
    !String(
      venda.comprador,
    ).trim()
  ) {
    return "O cliente da venda não foi informado.";
  }

  /*
   * Normaliza o estado antes
   * da validação do novo cliente.
   */

  normalizarEstadoNovoCliente(
    venda,
  );

  prepararItensVenda(
    venda,
  );

  for (
    const item of venda.itens
  ) {
    if (
      !item.produto_final_id
    ) {
      return "Não consegui identificar o produto da venda.";
    }

    if (
      Number(
        item.quantidade,
      ) <= 0
    ) {
      return "Não consegui identificar a quantidade da venda.";
    }

    if (
      item.preco_unitario ==
      null
    ) {
      return "Não consegui identificar o preço do produto. Verifique o produto e o tamanho do pote.";
    }
  }

  if (
    !venda.forma_pagamento
  ) {
    return "Qual foi a forma de pagamento?";
  }

  const forma =
    String(
      venda.forma_pagamento,
    ).toUpperCase();

  if (
    forma === "CARTAO"
  ) {
    const tipo =
      String(
        venda.tipo_cartao ||
          "",
      ).toUpperCase();

    if (
      tipo !== "CREDITO" &&
      tipo !== "DEBITO"
    ) {
      return "Informe se o cartão é de crédito ou débito.";
    }

    if (
      tipo === "CREDITO"
    ) {
      const parcelas =
        Number(
          venda.parcelas,
        );

      if (
        !Number.isInteger(
          parcelas,
        ) ||
        parcelas < 1
      ) {
        return "Informe a quantidade de parcelas do cartão de crédito.";
      }
    }
  }

  /*
   * Se for cliente novo,
   * telefone é obrigatório.
   */

  if (
    venda.novo_cliente
  ) {
    if (
      !venda.novo_cliente
        .telefone
    ) {
      return "Informe o telefone do cliente.";
    }

    const telefone =
      somenteDigitos(
        venda.novo_cliente
          .telefone,
      );

    if (
      telefone.length !== 10 &&
      telefone.length !== 11
    ) {
      return "Informe um telefone válido com DDD.";
    }
  }

  return null;
}

/* =========================================================
   DADOS FALTANTES
========================================================= */

function identificarFaltantesVenda(
  venda,
) {
  const faltando = [];

  if (
    !venda ||
    !venda.comprador
  ) {
    faltando.push(
      "comprador",
    );
  }

  if (
    !venda ||
    !Array.isArray(
      venda.itens,
    ) ||
    venda.itens.length === 0
  ) {
    faltando.push(
      "produto",
    );
  }

  if (
    Array.isArray(
      venda?.itens,
    )
  ) {
    for (
      const item of venda.itens
    ) {
      if (
        !item.quantidade
      ) {
        if (
          !faltando.includes(
            "quantidade",
          )
        ) {
          faltando.push(
            "quantidade",
          );
        }
      }

      if (
        !item.tamanho_pote
      ) {
        const produto =
          descobrirProdutoPorNome(
            item.produto_nome,
          );

        if (
          produto &&
          !faltando.includes(
            "tamanho",
          )
        ) {
          faltando.push(
            "tamanho",
          );
        }
      }
    }
  }

  if (
    !venda?.forma_pagamento
  ) {
    faltando.push(
      "forma_pagamento",
    );
  }

  if (
    String(
      venda?.forma_pagamento ||
      "",
    ).toUpperCase() ===
    "CARTAO"
  ) {
    const tipo =
      String(
        venda.tipo_cartao ||
          "",
      ).toUpperCase();

    if (
      tipo !== "CREDITO" &&
      tipo !== "DEBITO"
    ) {
      faltando.push(
        "tipo_cartao",
      );
    }

    if (
      tipo === "CREDITO" &&
      !venda.parcelas
    ) {
      faltando.push(
        "parcelas",
      );
    }
  }

  if (
    venda?.novo_cliente
  ) {
    /*
     * Normaliza antes de verificar
     * o estado.
     */

    normalizarEstadoNovoCliente(
      venda,
    );

    const novo =
      venda.novo_cliente;

    if (
      !novo.documento
    ) {
      faltando.push(
        "documento",
      );
    }

    if (
      !novo.estado
    ) {
      faltando.push(
        "estado",
      );
    }

    if (
      !novo.cidade
    ) {
      faltando.push(
        "cidade",
      );
    }

    if (
      !novo.bairro
    ) {
      faltando.push(
        "bairro",
      );
    }

    if (
      !novo.endereco
    ) {
      faltando.push(
        "endereco",
      );
    }

    if (
      !novo.numero
    ) {
      faltando.push(
        "numero",
      );
    }

    if (
      !novo.telefone
    ) {
      faltando.push(
        "telefone",
      );
    }
  }

  return [
    ...new Set(
      faltando,
    ),
  ];
}

/* =========================================================
   PERGUNTA DO PRÓXIMO CAMPO
========================================================= */

function perguntaParaFaltante(
  faltando,
) {
  if (
    faltando.includes(
      "comprador",
    )
  ) {
    return "Qual cliente comprou?";
  }

  if (
    faltando.includes(
      "produto",
    )
  ) {
    return "Qual produto foi vendido?";
  }

  if (
    faltando.includes(
      "quantidade",
    )
  ) {
    return "Quantos potes foram vendidos?";
  }

  if (
    faltando.includes(
      "tamanho",
    )
  ) {
    return "Qual o tamanho do pote: 22 ou 44 unidades?";
  }

  if (
    faltando.includes(
      "forma_pagamento",
    )
  ) {
    return "Qual foi a forma de pagamento?";
  }

  if (
    faltando.includes(
      "tipo_cartao",
    )
  ) {
    return "O cartão foi de crédito ou débito?";
  }

  if (
    faltando.includes(
      "parcelas",
    )
  ) {
    return "Em quantas parcelas foi o cartão de crédito?";
  }

  if (
    faltando.includes(
      "telefone",
    )
  ) {
    return "Qual é o telefone do cliente?";
  }

  if (
    faltando.includes(
      "documento",
    )
  ) {
    return "Qual é o CPF ou CNPJ do cliente?";
  }

  if (
    faltando.includes(
      "estado",
    )
  ) {
    return "Qual é o estado do cliente?";
  }

  if (
    faltando.includes(
      "cidade",
    )
  ) {
    return "Qual é a cidade do cliente?";
  }

  if (
    faltando.includes(
      "bairro",
    )
  ) {
    return "Qual é o bairro do cliente?";
  }

  if (
    faltando.includes(
      "endereco",
    )
  ) {
    return "Qual é o endereço do cliente?";
  }

  if (
    faltando.includes(
      "numero",
    )
  ) {
    return "Qual é o número do endereço?";
  }

  return null;
}

/* =========================================================
   TOTAL
========================================================= */

function calcularTotalVenda(
  venda,
) {
  return venda.itens.reduce(
    (
      total,
      item,
    ) => {
      const quantidadeBase =
        item.tipo === "caixa"
          ? Number(
              item.quantidade,
            ) *
            POTES_POR_CAIXA
          : Number(
              item.quantidade,
            );

      return (
        total +
        quantidadeBase *
          Number(
            item.preco_unitario,
          )
      );
    },
    0,
  );
}

/* =========================================================
   MOEDA
========================================================= */

function formatarMoeda(
  valor,
) {
  return Number(
    valor || 0,
  )
    .toFixed(2)
    .replace(
      ".",
      ",",
    );
}

/* =========================================================
   CONFIRMAÇÃO DE VENDA
========================================================= */

function montarConfirmacaoVenda(
  venda,
) {
  const linhas = [];

  linhas.push(
    "Confirme a venda antes de eu salvar:",
  );

  linhas.push("");

  linhas.push(
    `Cliente: ${venda.comprador}`,
  );

  for (
    const item of venda.itens
  ) {
    const quantidade =
      Number(
        item.quantidade,
      );

    const unidade =
      item.tipo === "caixa"
        ? `${quantidade} caixa(s) (${quantidade * POTES_POR_CAIXA} potes)`
        : `${quantidade} pote(s)`;

    const tamanho =
      item.tamanho_pote
        ? ` — ${item.tamanho_pote} uni`
        : "";

    linhas.push(
      `Produto: ${unidade} de ${item.produto_nome}${tamanho}`,
    );

    linhas.push(
      `Valor unitário: R$ ${formatarMoeda(
        item.preco_unitario,
      )}`,
    );
  }

  const total =
    calcularTotalVenda(
      venda,
    );

  linhas.push(
    `Total: R$ ${formatarMoeda(
      total,
    )}`,
  );

  const forma =
    String(
      venda.forma_pagamento,
    ).toUpperCase();

  if (
    forma === "CARTAO"
  ) {
    const tipo =
      String(
        venda.tipo_cartao,
      ).toUpperCase();

    if (
      tipo === "CREDITO"
    ) {
      linhas.push(
        "Pagamento: Cartão de crédito",
      );

      linhas.push(
        `Parcelas: ${venda.parcelas}x`,
      );
    } else {
      linhas.push(
        "Pagamento: Cartão de débito",
      );
    }
  } else {
    const nomes = {
      DINHEIRO:
        "Dinheiro",
      PIX:
        "Pix",
      BOLETO:
        "Boleto",
      CHEQUE:
        "Cheque",
      OUTRO:
        "Outro",
    };

    linhas.push(
      `Pagamento: ${
        nomes[forma] ||
        venda.forma_pagamento
      }`,
    );
  }

  /*
   * Mostrar telefone quando
   * for cliente novo.
   */

  if (
    venda.novo_cliente?.telefone
  ) {
    linhas.push(
      `Telefone: ${formatarTelefone(
        venda.novo_cliente
          .telefone,
      )}`,
    );
  }

  linhas.push("");

  linhas.push(
    "Está tudo certo? Responda sim para registrar ou não para corrigir.",
  );

  return linhas.join(
    "\n",
  );
}

function formatarTelefone(
  telefone,
) {
  const d =
    somenteDigitos(
      telefone,
    );

  if (
    d.length === 11
  ) {
    return `(${d.slice(
      0,
      2,
    )}) ${d.slice(
      2,
      7,
    )}-${d.slice(
      7,
    )}`;
  }

  if (
    d.length === 10
  ) {
    return `(${d.slice(
      0,
      2,
    )}) ${d.slice(
      2,
      6,
    )}-${d.slice(
      6,
    )}`;
  }

  return telefone;
}

/* =========================================================
   PROCESSAR MENSAGEM
========================================================= */

async function processarMensagem(
  chatId,
  {
    texto,
    audioBase64,
    mime,
  },
) {
  return executarNaFila(
    chatId,
    () =>
      processarMensagemInternamente(
        chatId,
        {
          texto,
          audioBase64,
          mime,
        },
      ),
  );
}

/* =========================================================
   PROCESSAMENTO INTERNO
========================================================= */

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
      !String(
        texto,
      ).trim()
    ) {
      return "Não consegui identificar sua mensagem. Pode tentar novamente?";
    }

    const textoAtual =
      String(
        texto,
      ).trim();

    /*
     * =====================================================
     * CANCELAR PRIMEIRO
     * =====================================================
     */

    if (
      ehCancelamento(
        textoAtual,
      )
    ) {
      const tinhaVenda =
        Boolean(
          getEstadoVenda(
            chatId,
          ) ||
          getConfirmacao(
            chatId,
          ),
        );

      limparConfirmacao(
        chatId,
      );

      limparEstadoVenda(
        chatId,
      );

      limparConversa(
        chatId,
      );

      if (
        tinhaVenda
      ) {
        return "Certo. A venda foi cancelada e os dados pendentes foram descartados.";
      }

      return "Certo. Não há nenhuma venda pendente.";
    }

    /*
     * =====================================================
     * CAPTURA DIRETA DE TELEFONE
     *
     * Isso acontece ANTES da IA.
     * =====================================================
     */

    const estadoAtual =
      getEstadoVenda(
        chatId,
      );

    const confirmacaoAtual =
      getConfirmacao(
        chatId,
      );

    const telefone =
      extrairTelefone(
        textoAtual,
      );

    if (
      telefone &&
      (
        estadoAtual ||
        confirmacaoAtual
      )
    ) {
      const venda =
        estadoAtual ||
        confirmacaoAtual.venda;

      if (
        venda
      ) {
        if (
          !venda.novo_cliente
        ) {
          venda.novo_cliente =
            {};
        }

        venda.novo_cliente
          .telefone =
          telefone;

        normalizarEstadoNovoCliente(
          venda,
        );

        /*
         * Se a venda estava
         * aguardando confirmação,
         * precisamos substituir a
         * confirmação antiga.
         */

        salvarEstadoVenda(
          chatId,
          venda,
        );

        const erro =
          validarVendaParaConfirmacao(
            venda,
          );

        if (!erro) {
          const confirmacao =
            montarConfirmacaoVenda(
              venda,
            );

          const resultado =
            {
              tipo: "venda",
              venda,
              faltando: [],
              perguntaProximo:
                null,
            };

          salvarConfirmacao(
            chatId,
            resultado,
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

        /*
         * Ainda falta alguma coisa.
         */

        const faltantes =
          identificarFaltantesVenda(
            venda,
          );

        const pergunta =
          perguntaParaFaltante(
            faltantes,
          );

        acrescentarConversa(
          chatId,
          `Gestora: ${textoAtual}`,
        );

        if (
          pergunta
        ) {
          acrescentarConversa(
            chatId,
            `Vovó: ${pergunta}`,
          );

          return pergunta;
        }

        return erro;
      }
    }

    /*
     * =====================================================
     * CONFIRMAÇÃO POSITIVA
     * =====================================================
     *
     * Só aceita "sim" sozinho como confirmação.
     *
     * "Sim, o telefone é..."
     * NÃO entra aqui.
     */

    const vendaPendente =
      getConfirmacao(
        chatId,
      );

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

        limparConfirmacao(
          chatId,
        );

        limparEstadoVenda(
          chatId,
        );

        limparConversa(
          chatId,
        );

        return resposta;
      } catch (err) {
        const msg =
          err.response?.data
            ?.message ||
          err.response?.data
            ?.error ||
          err.message ||
          "erro desconhecido";

        console.error(
          "[FLOW] Erro ao concluir venda confirmada:",
          err.response?.data ||
            err,
        );

        return (
          `Deu um probleminha ao salvar: ${msg}\n\n` +
          "Os dados da venda continuam aguardando confirmação. Você pode corrigir os dados e confirmar novamente."
        );
      }
    }

    /*
     * =====================================================
     * CONFIRMAÇÃO NEGATIVA
     * =====================================================
     */

    if (
      vendaPendente &&
      ehConfirmacaoNegativa(
        textoAtual,
      )
    ) {
      limparConfirmacao(
        chatId,
      );

      acrescentarConversa(
        chatId,
        `Gestora: ${textoAtual}`,
      );

      acrescentarConversa(
        chatId,
        "Vovó: Certo. O que você deseja corrigir na venda?",
      );

      return "Certo. O que você deseja corrigir na venda?";
    }

    /*
     * =====================================================
     * BUSCAR CATÁLOGO
     * =====================================================
     */

    const produtos =
      await catalogCache.getProdutos();

    const materiasPrimas =
      await catalogCache.getMateriasPrimas();

    const clientes =
      await catalogCache.getClientes();

    console.log(
      `[FLOW] Processando mensagem de ${chatId}: ${textoAtual}`,
    );

    /*
     * =====================================================
     * EXTRAÇÃO DIRETA DE CLIENTE
     * =====================================================
     */

    const clienteDireto =
      extrairClienteDaMensagem(
        textoAtual,
        clientes,
      );

    if (
      clienteDireto
    ) {
      console.log(
        "[FLOW] Cliente identificado diretamente:",
        clienteDireto,
      );
    }

    /*
     * =====================================================
     * EXTRAÇÃO DIRETA DOS DADOS DO CLIENTE
     * =====================================================
     */

    const dadosDiretos =
      extrairDadosCliente(
        textoAtual,
      );

    /*
     * Se já existe venda em andamento,
     * mesclar os dados diretamente.
     */

    let vendaEmAndamento =
      getEstadoVenda(
        chatId,
      );

    if (
      vendaEmAndamento
    ) {
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

        /*
         * Normaliza o estado
         * imediatamente após mesclar.
         */

        normalizarEstadoNovoCliente(
          vendaEmAndamento,
        );
      }

      salvarEstadoVenda(
        chatId,
        vendaEmAndamento,
      );
    }

    /*
     * =====================================================
     * IA
     * =====================================================
     */

    const resultado =
      await interpretarMensagem({
        texto: textoAtual,
        produtos,
        materiasPrimas,
        clientes,
        conversaPrevia:
          getConversa(chatId) ||
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

    /*
     * =====================================================
     * CONVERSA
     * =====================================================
     */

    if (
      resultado.tipo ===
      "conversa"
    ) {
      /*
       * Se existe uma venda em andamento
       * e a mensagem indica venda,
       * não deixar a IA transformar
       * em conversa.
       */

      if (
        vendaEmAndamento &&
        mensagemIndicaVenda(
          textoAtual,
        )
      ) {
        resultado.tipo =
          "venda";
      } else {
        const resposta =
          resultado.resposta ||
          "Como posso ajudar?";

        acrescentarConversa(
          chatId,
          `Vovó: ${resposta}`,
        );

        return resposta;
      }
    }

    /*
     * =====================================================
     * DESCONHECIDO
     * =====================================================
     */

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

    /*
     * =====================================================
     * VENDA
     * =====================================================
     */

    if (
      resultado.tipo ===
      "venda"
    ) {
      /*
       * Se a IA não devolveu venda,
       * mas já existe uma venda estruturada,
       * usar o estado anterior.
       */

      let novaVenda =
        resultado.venda;

      if (
        !novaVenda &&
        vendaEmAndamento
      ) {
        novaVenda =
          vendaEmAndamento;
      }

      if (
        !novaVenda
      ) {
        throw new Error(
          "A IA informou que é uma venda, mas não retornou os dados da venda.",
        );
      }

      /*
       * Mesclar venda anterior.
       */

      novaVenda =
        mesclarVenda(
          vendaEmAndamento,
          novaVenda,
        );

      /*
       * Cliente identificado
       * diretamente.
       */

      if (
        clienteDireto &&
        clienteDireto !==
          "sem telefone"
      ) {
        novaVenda.comprador =
          clienteDireto;
      }

      /*
       * Dados diretos do cliente.
       */

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

      /*
       * IMPORTANTE:
       *
       * Se o texto contém telefone,
       * nunca deixar a IA apagar
       * o telefone capturado.
       */

      if (
        telefone
      ) {
        if (
          !novaVenda.novo_cliente
        ) {
          novaVenda.novo_cliente =
            {};
        }

        novaVenda.novo_cliente
          .telefone =
          telefone;
      }

      /*
       * NOVO:
       *
       * Normalizar o estado antes
       * de salvar o estado da venda.
       *
       * Exemplo:
       *
       * Rio de Janeiro -> RJ
       * São Paulo -> SP
       * Minas Gerais -> MG
       */

      normalizarEstadoNovoCliente(
        novaVenda,
      );

      prepararItensVenda(
        novaVenda,
      );

      salvarEstadoVenda(
        chatId,
        novaVenda,
      );

      const faltantes =
        identificarFaltantesVenda(
          novaVenda,
        );

      console.log(
        "[FLOW] Dados atuais da venda:",
        JSON.stringify(
          novaVenda,
          null,
          2,
        ),
      );

      console.log(
        "[FLOW] Dados faltantes:",
        faltantes,
      );

      /*
       * Ainda faltam dados.
       */

      if (
        faltantes.length > 0
      ) {
        const pergunta =
          perguntaParaFaltante(
            faltantes,
          );

        if (
          pergunta
        ) {
          acrescentarConversa(
            chatId,
            `Vovó: ${pergunta}`,
          );

          return pergunta;
        }
      }

      /*
       * Tudo preenchido.
       */

      const erroValidacao =
        validarVendaParaConfirmacao(
          novaVenda,
        );

      if (
        erroValidacao
      ) {
        acrescentarConversa(
          chatId,
          `Vovó: ${erroValidacao}`,
        );

        return erroValidacao;
      }

      const confirmacao =
        montarConfirmacaoVenda(
          novaVenda,
        );

      const resultadoConfirmacao =
        {
          tipo: "venda",
          venda: novaVenda,
          faltando: [],
          perguntaProximo:
            null,
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

    /*
     * =====================================================
     * OUTROS LANÇAMENTOS
     * =====================================================
     */

    try {
      const resposta =
        await concluirLancamento(
          resultado,
        );

      limparConversa(
        chatId,
      );

      return resposta;
    } catch (err) {
      const msg =
        err.response?.data
          ?.message ||
        err.response?.data
          ?.error ||
        err.message ||
        "erro desconhecido";

      console.error(
        "[FLOW] Erro ao concluir lançamento:",
        err.response?.data ||
          err,
      );

      const respostaErro =
        `Deu um probleminha ao salvar: ${msg}\n\n` +
        "Pode me mandar essa informação?";

      acrescentarConversa(
        chatId,
        `Vovó: ${respostaErro}`,
      );

      return respostaErro;
    }
  } catch (error) {
    console.error(
      "[FLOW] Erro ao processar mensagem:",
      error,
    );

    return "Tive um probleminha para entender sua mensagem. Pode tentar novamente?";
  }
}

/* =========================================================
   CONCLUIR LANÇAMENTO
========================================================= */

async function concluirLancamento(
  resultado,
) {
  switch (
    resultado.tipo
  ) {
    case "venda":
      return criarVenda(
        resultado.venda,
      );

    case "compra":
      return criarCompras(
        resultado.compras,
      );

    case "producao":
      return criarProducao(
        resultado.producao,
      );

    case "gasto":
      return criarGasto(
        resultado.gasto,
      );

    default:
      return "Não consegui identificar o tipo de lançamento.";
  }
}

/* =========================================================
   CRIAR VENDA
========================================================= */

async function criarVenda(
  venda,
) {
  if (
    !venda ||
    !Array.isArray(
      venda.itens,
    ) ||
    venda.itens.length === 0
  ) {
    throw new Error(
      "Venda sem itens identificados.",
    );
  }

  if (
    !venda.comprador ||
    !String(
      venda.comprador,
    ).trim()
  ) {
    throw new Error(
      "O cliente da venda não foi informado.",
    );
  }

  prepararItensVenda(
    venda,
  );

  const itensValidos =
    venda.itens.filter(
      (i) =>
        i.produto_final_id &&
        Number(
          i.quantidade,
        ) > 0 &&
        i.preco_unitario !=
          null &&
        Number(
          i.preco_unitario,
        ) >= 0,
    );

  if (
    itensValidos.length === 0
  ) {
    throw new Error(
      "Não consegui identificar o produto, quantidade ou preço da venda.",
    );
  }

  if (
    !venda.forma_pagamento
  ) {
    throw new Error(
      "A forma de pagamento não foi informada.",
    );
  }

  const formaPagamento =
    String(
      venda.forma_pagamento,
    ).toUpperCase();

  const formasValidas = [
    "DINHEIRO",
    "PIX",
    "CARTAO",
    "BOLETO",
    "CHEQUE",
    "OUTRO",
  ];

  if (
    !formasValidas.includes(
      formaPagamento,
    )
  ) {
    throw new Error(
      `Forma de pagamento inválida: ${formaPagamento}`,
    );
  }

  let tipoCartao =
    null;

  let parcelas =
    null;

  if (
    formaPagamento ===
    "CARTAO"
  ) {
    tipoCartao =
      String(
        venda.tipo_cartao ||
          "",
      ).toUpperCase();

    if (
      tipoCartao !==
        "CREDITO" &&
      tipoCartao !==
        "DEBITO"
    ) {
      throw new Error(
        "Informe se o cartão é de crédito ou débito.",
      );
    }

    if (
      tipoCartao ===
      "CREDITO"
    ) {
      parcelas =
        Number(
          venda.parcelas,
        );

      if (
        !Number.isInteger(
          parcelas,
        ) ||
        parcelas < 1
      ) {
        throw new Error(
          "Informe a quantidade de parcelas do cartão de crédito.",
        );
      }
    }
  }

  /*
   * =====================================================
   * NORMALIZAÇÃO DO ESTADO
   * =====================================================
   *
   * ESTA É A PARTE MAIS IMPORTANTE DA CORREÇÃO.
   *
   * Antes de chamar resolverClienteId(),
   * transformamos:
   *
   * Rio de Janeiro -> RJ
   * São Paulo -> SP
   * Minas Gerais -> MG
   *
   * Assim o clienteResolver recebe
   * exatamente o formato esperado
   * pelo backend.
   */

  normalizarEstadoNovoCliente(
    venda,
  );

  /*
   * Resolver cliente.
   *
   * Passamos os dados completos
   * do novo cliente.
   */

  const {
    clienteId,
    criadoAgora,
  } =
    await resolverClienteId(
      venda.comprador,
      venda.novo_cliente,
    );

  if (!clienteId) {
    throw new Error(
      "Não consegui identificar o cliente da venda.",
    );
  }

  const itens =
    itensValidos.map(
      (i) => ({
        produtoId:
          Number(
            i.produto_final_id,
          ),

        quantidade:
          i.tipo === "caixa"
            ? Number(
                i.quantidade,
              ) *
              POTES_POR_CAIXA
            : Number(
                i.quantidade,
              ),

        valorUnitario:
          Number(
            i.preco_unitario,
          ),
      }),
    );

  const dadosVenda = {
    clienteId,

    dataVenda:
      hojeISO(),

    formaPagamento,

    statusPagamento:
      "PAGO",

    observacao:
      "Lançado pelo WhatsApp",

    itens,
  };

  if (
    formaPagamento ===
    "CARTAO"
  ) {
    dadosVenda.tipoCartao =
      tipoCartao;

    if (
      tipoCartao ===
      "CREDITO"
    ) {
      dadosVenda.parcelas =
        parcelas;
    }
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

  const nomesProdutos =
    itensValidos
      .map(
        (i) =>
          `${i.quantidade}x ${i.produto_nome}`,
      )
      .join(", ");

  let resposta =
    `Venda registrada!\n` +
    `${nomesProdutos}\n` +
    `Total: R$ ${formatarMoeda(
      criada.valorTotal,
    )}`;

  if (
    formaPagamento ===
    "CARTAO"
  ) {
    if (
      tipoCartao ===
      "CREDITO"
    ) {
      resposta +=
        `\nPagamento: Cartão de crédito em ${parcelas}x`;
    } else {
      resposta +=
        "\nPagamento: Cartão de débito";
    }
  } else {
    resposta +=
      `\nPagamento: ${
        formaPagamento ===
        "PIX"
          ? "Pix"
          : formaPagamento ===
            "DINHEIRO"
            ? "Dinheiro"
            : formaPagamento
      }`;
  }

  if (
    criadoAgora
  ) {
    resposta +=
      `\n\nTambém cadastrei "${venda.comprador}" como cliente novo.`;
  }

  return resposta;
}

/* =========================================================
   COMPRAS
========================================================= */

async function criarCompras(
  compras,
) {
  if (
    !compras ||
    compras.length === 0
  ) {
    throw new Error(
      "Compra sem itens identificados.",
    );
  }

  const validas =
    compras.filter(
      (c) =>
        c.materia_prima_id &&
        Number(
          c.quantidade,
        ) > 0 &&
        c.valor_total !=
          null &&
        Number(
          c.valor_total,
        ) >= 0,
    );

  if (
    validas.length === 0
  ) {
    throw new Error(
      "Não consegui identificar o ingrediente, quantidade ou valor da compra.",
    );
  }

  const respostas = [];

  for (
    const c of validas
  ) {
    const quantidade =
      Number(
        c.quantidade,
      );

    const valorTotal =
      Number(
        c.valor_total,
      );

    const criada =
      await api.post(
        "/compras-materias-primas",
        {
          dataCompra:
            hojeISO(),

          formaPagamento:
            "PIX",

          statusPagamento:
            "PAGO",

          observacao:
            "Lançado pelo WhatsApp",

          itens: [
            {
              materiaPrimaId:
                Number(
                  c.materia_prima_id,
                ),

              quantidade,

              valorUnitario:
                valorTotal /
                quantidade,
            },
          ],
        },
      );

    respostas.push(
      `${quantidade} ${
        c.unidade || ""
      } de ${
        c.produto_nome
      } — R$ ${formatarMoeda(
        criada.valorTotal,
      )}`,
    );
  }

  return (
    `Compra registrada!\n` +
    respostas.join(
      "\n",
    )
  );
}

/* =========================================================
   PRODUÇÃO
========================================================= */

async function criarProducao(
  producao,
) {
  if (
    !producao ||
    !producao.produto_final_id ||
    !producao.potes ||
    Number(
      producao.potes,
    ) <= 0
  ) {
    throw new Error(
      "Não consegui identificar o produto ou a quantidade produzida.",
    );
  }

  await api.post(
    "/producoes",
    {
      produtoId:
        Number(
          producao.produto_final_id,
        ),

      dataProducao:
        hojeISO(),

      quantidadeProduzida:
        Number(
          producao.potes,
        ),

      observacao:
        producao.observacoes ||
        "Lançado pelo WhatsApp",

      insumos: [],
    },
  );

  return (
    `Produção registrada!\n` +
    `${producao.potes} potes de ${producao.produto_nome}`
  );
}

/* =========================================================
   GASTO
========================================================= */

async function criarGasto(
  gasto,
) {
  if (
    !gasto ||
    gasto.valor == null ||
    !gasto.descricao
  ) {
    throw new Error(
      "Não consegui identificar a descrição ou o valor do gasto.",
    );
  }

  await api.post(
    "/lancamentos",
    {
      tipo:
        "GASTO_GERAL",

      titulo:
        gasto.descricao,

      descricao:
        gasto.categoria ||
        gasto.descricao,

      valorTotal:
        Number(
          gasto.valor,
        ),

      dataLancamento:
        hojeISO(),

      statusPagamento:
        "PAGO",

      formaPagamento:
        "PIX",
    },
  );

  return (
    `Gasto registrado!\n` +
    `${gasto.descricao} — R$ ${formatarMoeda(
      gasto.valor,
    )}`
  );
}

/* =========================================================
   DATA
========================================================= */

function hojeISO() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

/* =========================================================
   EXPORT
========================================================= */

module.exports = {
  processarMensagem,
};
