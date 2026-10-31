require("dotenv").config();

/*
 * SERVIDOR HTTP PARA O RENDER
 * O Render fornece a porta pela variável process.env.PORT.
 * O HTTPS externo é gerenciado pelo próprio Render.
 */
const http = require("http");
const path = require("path");
const fs = require("fs");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
    });

    res.end(
      JSON.stringify({
        status: "online",
        service: "Caderninho WhatsApp Bot",
      })
    );

    return;
  }

  res.writeHead(404, {
    "Content-Type": "application/json; charset=utf-8",
  });

  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[HTTP] Servidor iniciado na porta ${PORT}`);
});

const { transcreverAudio } = require("./transcricaoService");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { processarMensagem } = require("./flow");

console.log("BOT.JS COMECOU A EXECUTAR");

process.on("unhandledRejection", (reason) => {
  console.error("[BOT] Unhandled Rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[BOT] Uncaught Exception:", err);
});

/* =========================
   CLIENTE WHATSAPP
========================= */

console.log("[BOT] Criando cliente do WhatsApp...");

/*
 * CORREÇÃO DO CHROME NO RENDER
 * Só usamos um caminho manual se a variável PUPPETEER_EXECUTABLE_PATH
 * existir E o arquivo realmente existir. Caso contrário, o Puppeteer
 * procura o Chrome sozinho (na pasta definida em .puppeteerrc.cjs).
 */
const puppeteerConfig = {
  headless: true,
  protocolTimeout: 180000,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-features=Translate,BackForwardCache",
  ],
};

const caminhoChrome = process.env.PUPPETEER_EXECUTABLE_PATH;

if (caminhoChrome && fs.existsSync(caminhoChrome)) {
  puppeteerConfig.executablePath = caminhoChrome;
  console.log("[BOT] Usando Chrome de PUPPETEER_EXECUTABLE_PATH:", caminhoChrome);
} else if (caminhoChrome) {
  console.warn(
    "[BOT] PUPPETEER_EXECUTABLE_PATH inválido (arquivo não existe), ignorando:",
    caminhoChrome
  );
}

try {
  console.log(
    "[BOT] Chrome esperado pelo Puppeteer em:",
    require("puppeteer").executablePath()
  );
} catch (e) {
  console.warn("[BOT] Não foi possível descobrir o caminho do Chrome:", e?.message || e);
}

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: "caderninho-teste-2",
    // Plano gratuito do Render não tem disco persistente:
    // sem WHATSAPP_SESSION_PATH, a sessão fica dentro do projeto
    // e será perdida a cada reinício (será preciso ler o QR de novo).
    dataPath: process.env.WHATSAPP_SESSION_PATH || path.join(__dirname, ".wwebjs_auth"),
  }),

  puppeteer: puppeteerConfig,
});

console.log("[BOT] Cliente do WhatsApp criado.");

const mensagensProcessadas = new Set();
const filas = new Map();

/* =========================
   FUNÇÕES AUXILIARES
========================= */

function normalizarNumero(numero) {
  return String(numero || "")
    .replace(/\D/g, "")
    .trim();
}

async function numeroDaGestoraAutorizado(message) {
  const numeroGestora = normalizarNumero(
    process.env.WHATSAPP_GESTORA
  );

  if (!numeroGestora) {
    console.error(
      "[BOT] WHATSAPP_GESTORA não está configurado nas variáveis de ambiente."
    );

    return false;
  }

  const [id, sufixo] = String(message.from || "").split("@");
  const idNormalizado = normalizarNumero(id);

  /* =========================
     MENSAGEM @c.us
  ========================= */

  if (sufixo === "c.us") {
    return idNormalizado === numeroGestora;
  }

  /* =========================
     MENSAGEM @lid
  ========================= */

  if (sufixo === "lid") {
    try {
      /*
       * Não usamos contato.number nem contato.id.user,
       * porque esses campos podem continuar trazendo
       * o próprio LID.
       *
       * O whatsapp-web.js possui getContactLidAndPhone(),
       * que converte o LID para o número real associado.
       */
      const resultado =
        await client.getContactLidAndPhone([
          message.from,
        ]);

      const dadosContato = resultado?.[0];

      const telefoneReal = normalizarNumero(
        String(dadosContato?.pn || "")
          .replace("@c.us", "")
      );

      console.log(
        "[BOT] LID recebido:",
        message.from
      );

      console.log(
        "[BOT] Número real associado ao LID:",
        telefoneReal || "(não identificado)"
      );

      return telefoneReal === numeroGestora;

    } catch (erro) {
      console.error(
        "[BOT] Não foi possível converter o LID para o número real:",
        erro?.message || erro
      );

      return false;
    }
  }

  return false;
}

/* =========================
   ENVIO DE RESPOSTAS
========================= */

async function enviarResposta(message, resposta) {
  const texto = String(resposta || "").trim();

  if (!texto) {
    console.log("[BOT] Resposta vazia. Nada para enviar.");
    return;
  }

  let ultimoErro = null;

  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      await message.reply(texto);

      console.log("[BOT] Resposta enviada com sucesso.");

      return;
    } catch (erro) {
      ultimoErro = erro;

      console.error(
        `[BOT] Falha ao enviar resposta (tentativa ${tentativa}/3):`,
        erro?.message || erro
      );

      if (tentativa < 3) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1200 * tentativa)
        );
      }
    }
  }

  console.log("[BOT] Tentando enviar pelo chat.sendMessage()...");

  try {
    const chat = await message.getChat();

    await chat.sendMessage(texto);

    console.log("[BOT] Resposta enviada pelo chat.sendMessage().");

    return;
  } catch (erroFallback) {
    console.error(
      "[BOT] Falha definitiva ao enviar resposta:",
      ultimoErro || erroFallback
    );

    throw erroFallback;
  }
}

/* =========================
   FILA DE MENSAGENS
========================= */

function enfileirar(chatId, tarefa) {
  const anterior = filas.get(chatId) || Promise.resolve();

  const proxima = anterior
    .catch(() => {})
    .then(tarefa)
    .finally(() => {
      if (filas.get(chatId) === proxima) {
        filas.delete(chatId);
      }
    });

  filas.set(chatId, proxima);

  return proxima;
}

/* =========================
   EVENTOS DO WHATSAPP
========================= */

client.on("qr", (qr) => {
  console.log("");
  console.log("========================================");
  console.log("[BOT] QR CODE RECEBIDO");
  console.log("[BOT] Escaneie o QR Code abaixo:");
  console.log("========================================");

  qrcode.generate(qr, {
    small: true,
  });

  /*
   * No log do Render o QR desenhado costuma sair torto.
   * Copie o texto abaixo e cole em um gerador de QR Code
   * (ex.: qr-code-generator) para escanear com o WhatsApp.
   * ATENÇÃO: quem tiver esse texto pode logar no seu WhatsApp.
   * Depois que o bot estiver conectado, APAGUE a linha abaixo.
   */
  console.log("[BOT] QR (texto):", qr);
});

client.on("authenticated", () => {
  console.log("[BOT] WhatsApp autenticado!");
});

client.on("auth_failure", (msg) => {
  console.error("[BOT] Falha na autenticação:", msg);
});

client.on("loading_screen", (percent, message) => {
  console.log(
    `[BOT] Carregando WhatsApp Web: ${percent}% - ${message}`
  );
});

client.on("change_state", (state) => {
  console.log("[BOT] Estado do WhatsApp:", state);
});

client.on("ready", async () => {
  console.log("");
  console.log("========================================");
  console.log("[BOT] WHATSAPP CONECTADO E PRONTO!");
  console.log("========================================");

  try {
    console.log("[BOT] Verificando versão do WhatsApp Web...");

    const versao = await client.getWWebVersion();

    console.log("[BOT] Versão do WhatsApp Web:", versao);
  } catch (err) {
    console.log(
      "[BOT] Não foi possível obter a versão do WhatsApp Web:",
      err?.message || err
    );
  }

  console.log(
    "[BOT] Bot configurado para aceitar mensagens somente da Gestora."
  );
});

client.on("disconnected", (reason) => {
  console.log("[BOT] WhatsApp desconectado:", reason);
});

/* =========================
   RECEBIMENTO DE MENSAGENS
========================= */

client.on("message_create", async (message) => {
  if (message.fromMe) {
    console.log(
      "[BOT] Mensagem enviada pelo próprio bot. Ignorando."
    );
    return;
  }

  const messageId =
    message.id?._serialized ||
    message.id?.$1 ||
    null;

  /* =========================
     EVITAR MENSAGENS DUPLICADAS
  ========================= */

  if (messageId && mensagensProcessadas.has(messageId)) {
    console.log("[BOT] Mensagem duplicada ignorada.");
    return;
  }

  console.log(
    "[BOT] Mensagem recebida:",
    message.from,
    "|",
    message.body || "(sem texto)"
  );

  /* =========================
     VERIFICAR GESTORA
  ========================= */

  if (!(await numeroDaGestoraAutorizado(message))) {
    console.log(
      "[BOT] Mensagem ignorada: remetente não autorizado."
    );

    return;
  }

  console.log("[BOT] Mensagem da Gestora autorizada.");

  // Só guardar IDs após validar o remetente autorizado.
  if (messageId) {
    mensagensProcessadas.add(messageId);
    if (mensagensProcessadas.size > 500) {
      const primeiro = mensagensProcessadas.values().next().value;
      mensagensProcessadas.delete(primeiro);
    }
  }

  const chatId = message.from;

  const ehAudio = Boolean(
    message.hasMedia &&
    (message.type === "ptt" || message.type === "audio")
  );

  return enfileirar(chatId, async () => {
    try {
      /* =========================
         ÁUDIO
      ========================= */

      if (ehAudio) {
        console.log("[BOT] Áudio recebido. Baixando...");

        let media = null;

        if (message.id && !message.id._serialized) {
          message.id._serialized =
            message.id.$1 ||
            `${message.id.fromMe}_${message.id.remote}_${message.id.id}`;
        }

        for (let tentativa = 1; tentativa <= 3; tentativa++) {
          try {
            await new Promise((resolve) =>
              setTimeout(resolve, 1000)
            );

            media = await message.downloadMedia();

            if (media?.data) {
              break;
            }
          } catch (erro) {
            console.error(
              `[BOT] Falha no download do áudio ${tentativa}/3:`,
              erro?.message || erro
            );

            if (tentativa < 3) {
              await new Promise((resolve) =>
                setTimeout(resolve, 1500)
              );
            }
          }
        }

        if (!media?.data) {
          await enviarResposta(
            message,
            "Não consegui baixar o áudio. Pode tentar novamente ou mandar por texto?"
          );

          return;
        }

        console.log("[BOT] Áudio baixado.");
        console.log("[BOT] Transcrevendo áudio...");

        const texto = await transcreverAudio(
          media.data,
          media.mimetype
        );

        console.log("[BOT] Áudio transcrito:", texto);

        if (!texto?.trim()) {
          await enviarResposta(
            message,
            "Não consegui entender o áudio. Pode tentar novamente?"
          );

          return;
        }

        console.log(
          "[BOT] Enviando áudio transcrito para processarMensagem()..."
        );

        /*
         * IMPORTANTE:
         * Já estamos dentro da fila desta conversa.
         * Não enfileirar novamente aqui, pois isso faria
         * a tarefa esperar por ela mesma indefinidamente.
         */
        const resposta = await processarMensagem(chatId, {
          texto,
        });

        console.log("[BOT] Resposta gerada pelo flow.");

        await enviarResposta(message, resposta);

        return;
      }

      /* =========================
         TEXTO
      ========================= */

      const texto = String(
        message.body || ""
      ).trim();

      if (!texto) {
        return;
      }

      console.log(
        "[BOT] Enviando para processarMensagem():",
        texto
      );

      /*
       * IMPORTANTE:
       * Processar diretamente, sem chamar enfileirar()
       * novamente. Isso evita o travamento da fila.
       */
      const resposta = await processarMensagem(chatId, {
        texto,
      });

      console.log("[BOT] Resposta gerada pelo flow.");

      await enviarResposta(message, resposta);

    } catch (error) {
      console.error(
        "[BOT] Erro ao processar mensagem:",
        error
      );

      try {
        await enviarResposta(
          message,
          "Tive um probleminha aqui. Os dados pendentes foram mantidos. Pode tentar novamente?"
        );
      } catch (_) {
        console.error(
          "[BOT] Também não foi possível enviar a mensagem de erro."
        );
      }
    }
  });
});

/* =========================
   INICIALIZAÇÃO
========================= */

console.log("[BOT] Iniciando WhatsApp...");

client
  .initialize()
  .then(() => {
    console.log("[BOT] client.initialize() finalizado.");
  })
  .catch((erro) => {
    console.error(
      "[BOT] Erro ao inicializar WhatsApp:",
      erro
    );
  });