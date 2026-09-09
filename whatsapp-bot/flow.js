async function processarMensagemInternamente(chatId, { texto, audioBase64, mime }) {
  try {
    if (audioBase64) {
      return "O áudio precisa ser transcrito antes de ser processado.";
    }

    if (!texto || !String(texto).trim()) {
      return "Não consegui identificar sua mensagem. Pode tentar novamente?";
    }

    const textoAtual = String(texto).trim();

    /* =====================================================
       CANCELAMENTO
    ===================================================== */
    if (ehCancelamento(textoAtual)) {
      const tinhaVenda = Boolean(
        getEstadoVenda(chatId) || getConfirmacao(chatId),
      );

      limparConfirmacao(chatId);
      limparEstadoVenda(chatId);
      limparConversa(chatId);

      if (tinhaVenda) {
        return "Certo. A venda foi cancelada e os dados pendentes foram descartados.";
      }

      return "Certo. Não há nenhuma venda pendente.";
    }

    /* =====================================================
       INÍCIO DE VENDA
       NÃO CHAMA A IA
    ===================================================== */

    const textoNormal = textoNormalizado(textoAtual);

    const inicioVenda =
      textoNormal === "venda" ||
      textoNormal === "registrar venda" ||
      textoNormal === "registrar uma venda" ||
      textoNormal === "quero registrar venda" ||
      textoNormal === "quero registrar uma venda" ||
      textoNormal === "nova venda" ||
      textoNormal === "fazer uma venda";

    if (inicioVenda && !getEstadoVenda(chatId)) {
      const vendaInicial = {
        tipo: "venda",
        comprador: null,
        novo_cliente: null,
        forma_pagamento: null,
        tipo_cartao: null,
        parcelas: null,
        itens: [],
      };

      salvarEstadoVenda(chatId, vendaInicial);

      const checklist = montarChecklistInicialVenda();

      acrescentarConversa(chatId, `Gestora: ${textoAtual}`);
      acrescentarConversa(chatId, `Vovó: ${checklist}`);

      console.log("[FLOW] Nova venda iniciada sem chamar a IA.");

      return checklist;
    }

    /* =====================================================
       ESTADO ATUAL
    ===================================================== */

    let vendaEmAndamento = getEstadoVenda(chatId);
    const confirmacaoAtual = getConfirmacao(chatId);

    /* =====================================================
       TELEFONE DIRETO
    ===================================================== */

    const telefone = extrairTelefone(textoAtual);

    if (telefone && (vendaEmAndamento || confirmacaoAtual)) {
      const venda = vendaEmAndamento || confirmacaoAtual.venda;

      if (venda) {
        if (!venda.novo_cliente) {
          venda.novo_cliente = {};
        }

        venda.novo_cliente.telefone = telefone;

        normalizarEstadoNovoCliente(venda);
        salvarEstadoVenda(chatId, venda);

        const faltantes = identificarFaltantesVenda(venda);

        if (faltantes.length === 0) {
          const erro = validarVendaParaConfirmacao(venda);

          if (!erro) {
            prepararItensVenda(venda);

            const confirmacao = montarConfirmacaoVenda(venda);

            const resultado = {
              tipo: "venda",
              venda,
              faltando: [],
              perguntaProximo: null,
            };

            salvarConfirmacao(chatId, resultado);

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

        const pergunta =
          faltantes.length > 1
            ? montarChecklistFaltantes(
                faltantes,
                "Ainda faltam alguns dados. Me manda:",
              )
            : perguntaParaFaltante(faltantes);

        acrescentarConversa(
          chatId,
          `Gestora: ${textoAtual}`,
        );

        if (pergunta) {
          acrescentarConversa(
            chatId,
            `Vovó: ${pergunta}`,
          );

          return pergunta;
        }
      }
    }

    /* =====================================================
       CONFIRMAÇÃO POSITIVA
    ===================================================== */

    const vendaPendente = getConfirmacao(chatId);

    if (
      vendaPendente &&
      ehConfirmacaoPositiva(textoAtual)
    ) {
      console.log("[FLOW] Venda confirmada pela Gestora.");

      try {
        const resposta =
          await concluirLancamento(vendaPendente);

        limparConfirmacao(chatId);
        limparEstadoVenda(chatId);
        limparConversa(chatId);

        return resposta;
      } catch (err) {
        console.error(
          "[FLOW] Erro ao concluir venda:",
          err.response?.data || err,
        );

        const msg =
          err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          "erro desconhecido";

        return (
          `Deu um probleminha ao salvar: ${msg}\n\n` +
          "Os dados da venda continuam pendentes."
        );
      }
    }

    /* =====================================================
       CONFIRMAÇÃO NEGATIVA
    ===================================================== */

    if (
      vendaPendente &&
      ehConfirmacaoNegativa(textoAtual)
    ) {
      salvarEstadoVenda(chatId, vendaPendente.venda);
      limparConfirmacao(chatId);

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

    /* =====================================================
       BUSCAR CATÁLOGO
    ===================================================== */

    const produtos =
      await catalogCache.getProdutos();

    const materiasPrimas =
      await catalogCache.getMateriasPrimas();

    const clientes =
      await catalogCache.getClientes();

    console.log(
      `[FLOW] Processando mensagem de ${chatId}: ${textoAtual}`,
    );

    /* =====================================================
       EXTRAÇÕES DIRETAS
    ===================================================== */

    const clienteDireto =
      extrairClienteDaMensagem(
        textoAtual,
        clientes,
      );

    if (clienteDireto) {
      console.log(
        "[FLOW] Cliente identificado:",
        clienteDireto,
      );
    }

    const dadosDiretos =
      extrairDadosCliente(textoAtual);

    vendaEmAndamento =
      getEstadoVenda(chatId);

    if (vendaEmAndamento) {
      if (
        clienteDireto &&
        clienteDireto !== "sem telefone"
      ) {
        vendaEmAndamento.comprador =
          clienteDireto;
      }

      if (Object.keys(dadosDiretos).length > 0) {
        if (!vendaEmAndamento.novo_cliente) {
          vendaEmAndamento.novo_cliente = {};
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

      salvarEstadoVenda(
        chatId,
        vendaEmAndamento,
      );
    }

    /* =====================================================
       IA
    ===================================================== */

    const resultado =
      await interpretarMensagem({
        texto: textoAtual,
        produtos,
        materiasPrimas,
        clientes,
        conversaPrevia:
          getConversa(chatId) || null,

        // IMPORTANTE:
        // agora o estado realmente é enviado para a IA
        estadoAtual:
          vendaEmAndamento || null,
      });

    console.log(
      "[FLOW] Resultado da IA:",
      JSON.stringify(resultado, null, 2),
    );

    acrescentarConversa(
      chatId,
      `Gestora: ${textoAtual}`,
    );

    if (!resultado || !resultado.tipo) {
      throw new Error(
        "A IA retornou uma resposta sem informar o tipo da ação.",
      );
    }

    /* =====================================================
       CONVERSA
    ===================================================== */

    if (resultado.tipo === "conversa") {
      const resposta =
        resultado.resposta ||
        "Como posso ajudar?";

      acrescentarConversa(
        chatId,
        `Vovó: ${resposta}`,
      );

      return resposta;
    }

    /* =====================================================
       DESCONHECIDO
    ===================================================== */

    if (resultado.tipo === "desconhecido") {
      const resposta =
        resultado.resposta ||
        "Não entendi o que você gostaria de fazer. Pode explicar de outro jeito?";

      acrescentarConversa(
        chatId,
        `Vovó: ${resposta}`,
      );

      return resposta;
    }

    /* =====================================================
       VENDA
    ===================================================== */

    if (resultado.tipo === "venda") {
      let novaVenda = resultado.venda;

      /*
       * Se a IA não criou uma venda, usa o estado existente.
       */
      if (!novaVenda && vendaEmAndamento) {
        novaVenda = vendaEmAndamento;
      }

      /*
       * Se ainda não existe venda, cria uma.
       */
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

      /*
       * Junta o que já estava salvo com a resposta nova da IA.
       */
      novaVenda =
        mesclarVenda(
          vendaEmAndamento,
          novaVenda,
        );

      /*
       * Cliente identificado diretamente.
       */
      if (
        clienteDireto &&
        clienteDireto !== "sem telefone"
      ) {
        novaVenda.comprador =
          clienteDireto;
      }

      /*
       * Dados de cliente identificados diretamente.
       */
      if (
        Object.keys(dadosDiretos).length > 0
      ) {
        if (!novaVenda.novo_cliente) {
          novaVenda.novo_cliente = {};
        }

        novaVenda.novo_cliente =
          mesclarObjetos(
            novaVenda.novo_cliente,
            dadosDiretos,
          );
      }

      if (telefone) {
        if (!novaVenda.novo_cliente) {
          novaVenda.novo_cliente = {};
        }

        novaVenda.novo_cliente.telefone =
          telefone;
      }

      normalizarEstadoNovoCliente(
        novaVenda,
      );

      prepararItensVenda(novaVenda);

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

      /* ===================================================
         AINDA FALTAM DADOS
      =================================================== */

      if (faltantes.length > 0) {
        let resposta;

        if (faltantes.length > 1) {
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

      /* ===================================================
         VALIDAR
      =================================================== */

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

      /* ===================================================
         CONFIRMAÇÃO
      =================================================== */

      const confirmacao =
        montarConfirmacaoVenda(
          novaVenda,
        );

      const resultadoConfirmacao = {
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

    /* =====================================================
       OUTROS LANÇAMENTOS
    ===================================================== */

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
        err.response?.data || err,
      );

      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "erro desconhecido";

      return (
        `Deu um probleminha ao salvar: ${msg}`
      );
    }
  } catch (error) {
    console.error(
      "========================================",
    );
    console.error(
      "[FLOW] ERRO REAL:",
    );
    console.error(
      error.response?.data || error,
    );
    console.error(
      error.stack,
    );
    console.error(
      "========================================",
    );

    /*
     * NÃO esconder o erro real no terminal.
     * O WhatsApp continua recebendo uma mensagem amigável.
     */
    return "Tive um probleminha para entender sua mensagem. Pode tentar novamente?";
  }
}

// =========================================================
// FUNÇÃO PÚBLICA USADA PELO BOT
// =========================================================

async function processarMensagem(chatId, dados) {
  return await processarMensagemInternamente(
    chatId,
    dados,
  );
}


// =========================================================
// EXPORTAÇÃO
// =========================================================

module.exports = {
  processarMensagem,
};