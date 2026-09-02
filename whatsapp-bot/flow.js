const api = require("./apiClient");

const catalogCache =
  require("./catalogCache");

const {
  resolverClienteId,
} = require("./clienteResolver");

const {
  interpretarMensagem,
} = require("./aiService");

const POTES_POR_CAIXA = 6;

const conversas =
  new Map();

const confirmacoesPendentes =
  new Map();

const estadosConversas =
  new Map();

/*
 * Fila por conversa.
 *
 * Garante que duas mensagens da mesma Gestora
 * não sejam processadas ao mesmo tempo.
 */
const filas =
  new Map();

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

function getConversa(
  chatId,
) {
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

function getEstadoConversa(
  chatId,
) {
  return (
    estadosConversas.get(
      chatId,
    ) || null
  );
}

function salvarEstadoConversa(
  chatId,
  estado,
) {
  estadosConversas.set(
    chatId,
    estado,
  );
}

function limparConversa(
  chatId,
) {
  conversas.delete(
    chatId,
  );

  estadosConversas.delete(
    chatId,
  );
}

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
  return (
    confirmacoesPendentes.get(
      chatId,
    ) || null
  );
}

function limparConfirmacao(
  chatId,
) {
  confirmacoesPendentes.delete(
    chatId,
  );
}

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

function ehConfirmacaoPositiva(
  texto,
) {
  const t =
    textoNormalizado(
      texto,
    );

  return [
    "sim",
    "sim.",
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
  ].includes(t);
}

function ehConfirmacaoNegativa(
  texto,
) {
  const t =
    textoNormalizado(
      texto,
    );

  return [
    "nao",
    "nao.",
    "esta errado",
    "errado",
    "precisa corrigir",
    "quero corrigir",
  ].includes(t);
}

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

/*
 * Preços oficiais.
 */
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
    (tamanho === 22 ||
      tamanho === 44)
  ) {
    item.preco_unitario =
      PRECOS[
        produto
      ][tamanho];
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

function normalizarVenda(
  venda,
  estadoAnterior,
) {
  const vendaAtual =
    venda || {};

  const anterior =
    estadoAnterior || {};

  const itensNovos =
    Array.isArray(
      vendaAtual.itens,
    ) &&
    vendaAtual.itens.length >
      0
      ? vendaAtual.itens
      : null;

  const itensAnteriores =
    Array.isArray(
      anterior.itens,
    )
      ? anterior.itens
      : [];

  const vendaFinal = {
    comprador:
      vendaAtual.comprador ||
      anterior.comprador ||
      null,

    novo_cliente:
      vendaAtual.novo_cliente ||
      anterior.novo_cliente ||
      null,

    forma_pagamento:
      vendaAtual.forma_pagamento ||
      anterior.forma_pagamento ||
      null,

    tipo_cartao:
      vendaAtual.tipo_cartao ||
      anterior.tipo_cartao ||
      null,

    parcelas:
      vendaAtual.parcelas ??
      anterior.parcelas ??
      null,

    itens:
      itensNovos ||
      itensAnteriores,
  };

  /*
   * Se a IA retornou um item parcial,
   * tenta preservar dados do item anterior.
   */
  if (
    vendaFinal.itens.length >
      0 &&
    itensAnteriores.length >
      0
  ) {
    vendaFinal.itens =
      vendaFinal.itens.map(
        (item, index) => {
          const antigo =
            itensAnteriores[
              index
            ] || {};

          return {
            ...antigo,
            ...item,
            produto_final_id:
              item.produto_final_id ||
              antigo.produto_final_id ||
              null,

            produto_nome:
              item.produto_nome ||
              antigo.produto_nome ||
              null,

            quantidade:
              item.quantidade ??
              antigo.quantidade ??
              null,

            tipo:
              item.tipo ||
              antigo.tipo ||
              null,

            tamanho_pote:
              item.tamanho_pote ??
              antigo.tamanho_pote ??
              null,

            preco_unitario:
              item.preco_unitario ??
              antigo.preco_unitario ??
              null,
          };
        },
      );
  }

  prepararItensVenda(
    vendaFinal,
  );

  return vendaFinal;
}

function extrairClienteDaMensagem(
  texto,
  clientes,
) {
  const original =
    String(texto || "")
      .trim();

  if (!original) {
    return null;
  }

  const normalizado =
    original
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        "",
      )
      .toLowerCase();

  /*
   * Primeiro procura clientes já cadastrados
   * dentro da própria mensagem.
   */
  if (
    Array.isArray(clientes)
  ) {
    for (
      const cliente of clientes
    ) {
      if (
        !cliente ||
        !cliente.nome
      ) {
        continue;
      }

      const nome =
        String(
          cliente.nome,
        ).trim();

      const nomeNormalizado =
        nome
          .normalize("NFD")
          .replace(
            /[\u0300-\u036f]/g,
            "",
          )
          .toLowerCase();

      if (
        nomeNormalizado.length >
          2 &&
        normalizado.includes(
          nomeNormalizado,
        )
      ) {
        return nome;
      }
    }
  }

  /*
   * Procura padrões comuns:
   *
   * "para cliente Mariana"
   * "cliente Mariana"
   * "para a cliente Mariana"
   */
  const padroes = [
    /(?:para\s+(?:a\s+)?cliente)\s+(.+?)(?:\.|,|$)/i,

    /(?:cliente)\s+(.+?)(?:\.|,|$)/i,

    /(?:para\s+(?:a\s+)?cliente)\s+(.+)/i,
  ];

  for (
    const regex of padroes
  ) {
    const match =
      original.match(
        regex,
      );

    if (
      match &&
      match[1]
    ) {
      let nome =
        match[1].trim();

      nome =
        nome.replace(
          /^(o|a)\s+/i,
          "",
        );

      nome =
        nome.replace(
          /\s+(comprou|vai comprar|fez a compra).*$/i,
          "",
        );

      if (
        nome.length >= 2
      ) {
        return nome;
      }
    }
  }

  return null;
}

function mensagemIndicaVenda(
  texto,
) {
  const t =
    textoNormalizado(
      texto,
    );

  return (
    t.includes("venda") ||
    t.includes("vender") ||
    t.includes("vendi") ||
    t.includes("registrar uma nova venda") ||
    t.includes("registrar venda")
  );
}

function identificarFaltantesVenda(
  venda,
  clientes,
) {
  const faltando = [];

  if (
    !venda ||
    !venda.comprador
  ) {
    faltando.push(
      "comprador",
    );

    return {
      faltando,
      perguntaProximo:
        "Qual cliente comprou?",
    };
  }

  if (
    !Array.isArray(
      venda.itens,
    ) ||
    venda.itens.length === 0
  ) {
    faltando.push(
      "produto",
    );

    return {
      faltando,
      perguntaProximo:
        "Qual produto foi vendido?",
    };
  }

  const item =
    venda.itens[0];

  if (
    !item.produto_final_id ||
    !item.produto_nome
  ) {
    faltando.push(
      "produto",
    );

    return {
      faltando,
      perguntaProximo:
        "Qual produto foi vendido?",
    };
  }

  if (
    !item.quantidade ||
    Number(
      item.quantidade,
    ) <= 0
  ) {
    faltando.push(
      "quantidade",
    );

    return {
      faltando,
      perguntaProximo:
        "Quantos potes foram vendidos?",
    };
  }

  /*
   * Para os produtos da tabela oficial,
   * o tamanho é obrigatório.
   */
  const produto =
    descobrirProdutoPorNome(
      item.produto_nome,
    );

  if (
    produto &&
    ![22, 44].includes(
      Number(
        item.tamanho_pote,
      ),
    )
  ) {
    faltando.push(
      "tamanho",
    );

    return {
      faltando,
      perguntaProximo:
        "Qual o tamanho do pote: 22 ou 44 unidades?",
    };
  }

  if (
    !venda.forma_pagamento
  ) {
    faltando.push(
      "forma_pagamento",
    );

    return {
      faltando,
      perguntaProximo:
        "Qual foi a forma de pagamento?",
    };
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
      faltando.push(
        "tipo_cartao",
      );

      return {
        faltando,
        perguntaProximo:
          "O cartão foi de crédito ou débito?",
      };
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
        faltando.push(
          "parcelas",
        );

        return {
          faltando,
          perguntaProximo:
            "Em quantas parcelas foi o pagamento no cartão de crédito?",
        };
      }
    }
  }

  /*
   * Se o cliente não estiver cadastrado,
   * os dados de cadastro são necessários.
   */
  const clienteExiste =
    Array.isArray(
      clientes,
    ) &&
    clientes.some(
      (cliente) => {
        if (
          !cliente ||
          !cliente.nome
        ) {
          return false;
        }

        const a =
          normalizarNomeCliente(
            cliente.nome,
          );

        const b =
          normalizarNomeCliente(
            venda.comprador,
          );

        return (
          a === b ||
          a.includes(b) ||
          b.includes(a)
        );
      },
    );

  if (
    !clienteExiste
  ) {
    const novo =
      venda.novo_cliente;

    const campos = [
      "documento",
      "estado",
      "cidade",
      "bairro",
      "endereco",
      "numero",
    ];

    for (
      const campo of campos
    ) {
      if (
        !novo ||
        !String(
          novo[campo] || "",
        ).trim()
      ) {
        faltando.push(
          `cliente_${campo}`,
        );
      }
    }

    if (
      faltando.length >
      0
    ) {
      return {
        faltando,
        perguntaProximo:
          "Esse cliente ainda não está cadastrado. Preciso do CPF ou CNPJ, estado, cidade, bairro, endereço e número.",
      };
    }
  }

  return {
    faltando: [],
    perguntaProximo:
      null,
  };
}

function normalizarNomeCliente(
  nome,
) {
  return String(
    nome || "",
  )
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase()
    .trim();
}

function validarVendaParaConfirmacao(
  venda,
) {
  const resultado =
    identificarFaltantesVenda(
      venda,
      [],
    );

  if (
    resultado.faltando.length >
    0
  ) {
    return resultado
      .perguntaProximo;
  }

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

  return null;
}

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

  linhas.push("");

  linhas.push(
    "Está tudo certo? Responda sim para registrar ou não para corrigir.",
  );

  return linhas.join(
    "\n",
  );
}

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
      return (
        "O áudio precisa ser transcrito antes de ser processado."
      );
    }

    if (
      !texto ||
      !texto.trim()
    ) {
      return "Não consegui identificar sua mensagem. Pode tentar novamente?";
    }

    const textoAtual =
      texto.trim();

    /*
     * Primeiro verificamos se existe
     * uma venda aguardando confirmação.
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
          "Os dados da venda continuam aguardando confirmação. Pode tentar novamente."
        );
      }
    }

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

      return (
        "Certo. O que você deseja corrigir na venda?"
      );
    }

    /*
     * Carrega catálogo.
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
     * =========================================================
     * MEMÓRIA ESTRUTURADA
     * =========================================================
     */

    let estado =
      getEstadoConversa(
        chatId,
      );

    /*
     * Se ainda não existe estado,
     * mas a mensagem claramente inicia uma venda,
     * criamos o estado.
     */
    if (
      !estado &&
      mensagemIndicaVenda(
        textoAtual,
      )
    ) {
      estado = {
        tipo: "venda",
        comprador: null,
        novo_cliente: null,
        forma_pagamento:
          null,
        tipo_cartao:
          null,
        parcelas: null,
        itens: [],
      };

      salvarEstadoConversa(
        chatId,
        estado,
      );
    }

    /*
     * Detecta diretamente um cliente
     * mencionado na mensagem.
     *
     * Isso funciona mesmo se a IA falhar.
     */
    const clienteExtraido =
      extrairClienteDaMensagem(
        textoAtual,
        clientes,
      );

    if (
      clienteExtraido &&
      (
        !estado ||
        estado.tipo ===
          "venda"
      )
    ) {
      estado =
        estado || {
          tipo: "venda",
          comprador: null,
          novo_cliente: null,
          forma_pagamento:
            null,
          tipo_cartao:
            null,
          parcelas: null,
          itens: [],
        };

      estado.tipo =
        "venda";

      estado.comprador =
        clienteExtraido;

      salvarEstadoConversa(
        chatId,
        estado,
      );

      console.log(
        "[FLOW] Cliente identificado diretamente:",
        clienteExtraido,
      );
    }

    /*
     * =========================================================
     * IA
     * =========================================================
     */

    const resultado =
      await interpretarMensagem({
        texto: textoAtual,
        produtos,
        materiasPrimas,
        clientes,
        conversaPrevia:
          getConversa(
            chatId,
          ) || null,
        estadoAtual:
          getEstadoConversa(
            chatId,
          ) || null,
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
     * =========================================================
     * VENDA
     * =========================================================
     */

    if (
      resultado.tipo ===
      "venda"
    ) {
      const estadoAnterior =
        getEstadoConversa(
          chatId,
        ) || {};

      const venda =
        normalizarVenda(
          resultado.venda,
          estadoAnterior,
        );

      /*
       * Se a IA retornou comprador,
       * atualiza a memória.
       */
      if (
        resultado.venda
          ?.comprador
      ) {
        venda.comprador =
          resultado.venda.comprador;
      }

      /*
       * Se o cliente foi detectado
       * diretamente na mensagem,
       * ele tem prioridade.
       */
      if (
        clienteExtraido
      ) {
        venda.comprador =
          clienteExtraido;
      }

      /*
       * Salva o estado estruturado.
       */
      const novoEstado = {
        tipo: "venda",

        comprador:
          venda.comprador ||
          null,

        novo_cliente:
          venda.novo_cliente ||
          null,

        forma_pagamento:
          venda.forma_pagamento ||
          null,

        tipo_cartao:
          venda.tipo_cartao ||
          null,

        parcelas:
          venda.parcelas ??
          null,

        itens:
          Array.isArray(
            venda.itens,
          )
            ? venda.itens
            : [],
      };

      prepararItensVenda(
        novoEstado,
      );

      salvarEstadoConversa(
        chatId,
        novoEstado,
      );

      /*
       * Verifica os dados faltantes
       * de forma determinística.
       */
      const verificacao =
        identificarFaltantesVenda(
          novoEstado,
          clientes,
        );

      console.log(
        "[FLOW] Dados atuais da venda:",
        JSON.stringify(
          novoEstado,
          null,
          2,
        ),
      );

      console.log(
        "[FLOW] Dados faltantes:",
        verificacao.faltando,
      );

      /*
       * Ainda faltam informações.
       */
      if (
        verificacao.faltando
          .length > 0
      ) {
        acrescentarConversa(
          chatId,
          `Vovó: ${verificacao.perguntaProximo}`,
        );

        return (
          verificacao.perguntaProximo
        );
      }

      /*
       * =======================================================
       * VENDA COMPLETA
       * =======================================================
       */

      const erroValidacao =
        validarVendaParaConfirmacao(
          novoEstado,
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
          novoEstado,
        );

      /*
       * Guardamos a venda inteira.
       *
       * Só será salva no backend
       * quando a Gestora responder "sim".
       */
      salvarConfirmacao(
        chatId,
        {
          tipo: "venda",
          venda: novoEstado,
        },
      );

      acrescentarConversa(
        chatId,
        `Vovó: ${confirmacao}`,
      );

      return confirmacao;
    }

    /*
     * =========================================================
     * CONVERSA
     * =========================================================
     */

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

    /*
     * =========================================================
     * DESCONHECIDO
     * =========================================================
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
     * =========================================================
     * OUTROS LANÇAMENTOS
     * =========================================================
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

    return (
      "Tive um probleminha para entender sua mensagem. Pode tentar novamente?"
    );
  }
}

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

async function criarVenda(
  venda,
) {
  if (
    !venda ||
    !Array.isArray(
      venda.itens,
    ) ||
    venda.itens.length ===
      0
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
    itensValidos.length ===
    0
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
  }

  if (
    criadoAgora
  ) {
    resposta +=
      `\n\nTambém cadastrei "${venda.comprador}" como cliente novo.`;
  }

  return resposta;
}

async function criarCompras(
  compras,
) {
  if (
    !compras ||
    compras.length ===
      0
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
    validas.length ===
    0
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

function hojeISO() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

module.exports = {
  processarMensagem,
};