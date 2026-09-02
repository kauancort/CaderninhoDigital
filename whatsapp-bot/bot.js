require("dotenv").config();

const { transcreverAudio } = require("./transcricaoService");

console.log("BOT.JS COMEÇOU A EXECUTAR");

const {
  Client,
  LocalAuth,
} = require("whatsapp-web.js");

const qrcode = require("qrcode-terminal");

const {
  processarMensagem,
} = require("./flow");

process.on("unhandledRejection", (reason) => {
  console.error(
    "Unhandled Rejection (bot continua rodando):",
    reason,
  );
});

process.on("uncaughtException", (err) => {
  console.error(
    "Uncaught Exception (bot continua rodando):",
    err,
  );
});

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: "caderninho-teste-2",
  }),

  webVersionCache: {
    type: "none",
  },

  puppeteer: {
    headless: true,
    protocolTimeout: 180000,

    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  },
});

function normalizarNumero(numero) {
  if (!numero) return "";

  return String(numero)
    .replace(/\D/g, "")
    .trim();
}

function numeroDaGestoraAutorizado(message) {
  const numeroConfigurado = normalizarNumero(
    process.env.WHATSAPP_GESTORA,
  );

  const lidConfigurado = normalizarNumero(
    process.env.WHATSAPP_GESTORA_LID,
  );

  if (!numeroConfigurado && !lidConfigurado) {
    console.warn(
      "Nem WHATSAPP_GESTORA nem WHATSAPP_GESTORA_LID estão configurados no .env",
    );

    return false;
  }

  const [idPart, suffix] = (
    message.from || ""
  ).split("@");

  const idDigits = normalizarNumero(idPart);

  if (suffix === "lid") {
    const autorizado =
      !!lidConfigurado &&
      idDigits === lidConfigurado;

    console.log(
      `Remetente via @lid: ${idDigits} | Autorizado: ${autorizado}`,
    );

    return autorizado;
  }

  if (suffix === "c.us") {
    const autorizado =
      !!numeroConfigurado &&
      idDigits === numeroConfigurado;

    console.log(
      `Remetente via @c.us: ${idDigits} | Autorizado: ${autorizado}`,
    );

    return autorizado;
  }

  console.log(
    `Sufixo desconhecido no remetente: ${message.from}`,
  );

  return false;
}

client.on("qr", (qr) => {
  console.log("Escaneie o QR Code:");

  qrcode.generate(qr, {
    small: true,
  });
});

client.on("authenticated", () => {
  console.log("WhatsApp autenticado!");
});

client.on("ready", async () => {
  console.log("WhatsApp conectado e pronto!");

  try {
    const versao =
      await client.getWWebVersion();

    console.log(
      "Versão do WhatsApp Web detectada:",
      versao,
    );
  } catch (err) {
    console.error(
      "Não foi possível detectar a versão do WhatsApp Web:",
      err.message,
    );
  }

  if (
    process.env.WHATSAPP_GESTORA ||
    process.env.WHATSAPP_GESTORA_LID
  ) {
    console.log(
      "Bot configurado para aceitar mensagens somente da Gestora.",
    );
  } else {
    console.warn(
      "Configure WHATSAPP_GESTORA e/ou WHATSAPP_GESTORA_LID no arquivo .env.",
    );
  }
});

client.on("auth_failure", (msg) => {
  console.error(
    "Falha na autenticação:",
    msg,
  );
});

client.on("disconnected", (reason) => {
  console.log(
    "WhatsApp desconectado:",
    reason,
  );
});

client.on("message", async (message) => {
  console.log(
    "EVENTO 'message' DISPAROU. From:",
    message.from,
    "| Body:",
    message.body || "(sem texto)",
  );

  if (!numeroDaGestoraAutorizado(message)) {
    console.log(
      "Mensagem ignorada: número não autorizado.",
      message.from,
    );

    return;
  }

  console.log(
    "Mensagem autorizada da Gestora.",
  );

  try {
    const chatId = message.from;

    const ehAudio =
      message.hasMedia &&
      (
        message.type === "ptt" ||
        message.type === "audio"
      );

    // =========================================================
    // ÁUDIO
    // =========================================================

    if (ehAudio) {
      console.log("Áudio recebido, baixando...");

      if (
        message.id &&
        !message.id._serialized
      ) {
        const idSerializado =
          message.id.$1 ||
          `${message.id.fromMe}_${message.id.remote}_${message.id.id}`;

        if (idSerializado) {
          message.id._serialized =
            idSerializado;

          console.log(
            "ID da mensagem corrigido para downloadMedia():",
            message.id._serialized,
          );
        }
      }

      let media = null;

      const tentativasMaximas = 3;

      for (
        let tentativa = 1;
        tentativa <= tentativasMaximas;
        tentativa++
      ) {
        try {
          // Primeira tentativa mais rápida.
          // As outras só aguardam se realmente houver falha.
          if (tentativa > 1) {
            await new Promise((resolve) =>
              setTimeout(resolve, 1500),
            );
          }

          media =
            await message.downloadMedia();

          if (
            media &&
            media.data
          ) {
            console.log(
              "Áudio baixado com sucesso!",
            );

            break;
          }

          console.warn(
            `Tentativa ${tentativa}: downloadMedia() não retornou dados.`,
          );
        } catch (erroDownload) {
          console.error(
            `Tentativa ${tentativa} de baixar áudio falhou:`,
            JSON.stringify(
              erroDownload,
              Object.getOwnPropertyNames(
                erroDownload,
              ),
              2,
            ),
          );

          if (
            tentativa === tentativasMaximas
          ) {
            await message.reply(
              "Não consegui baixar o áudio depois de várias tentativas. Pode tentar mandar de novo ou me escrever por texto?",
            );

            return;
          }
        }
      }

      if (
        !media ||
        !media.data
      ) {
        await message.reply(
          "Não consegui baixar o áudio. Pode tentar mandar de novo ou me escrever por texto?",
        );

        return;
      }

      try {
        console.log(
          "Transcrevendo áudio...",
        );

        const textoTranscrito =
          await transcreverAudio(
            media.data,
            media.mimetype,
          );

        console.log(
          "Áudio transcrito:",
          textoTranscrito,
        );

        const resposta =
          await processarMensagem(
            chatId,
            {
              texto: textoTranscrito,
            },
          );

        await message.reply(
          resposta,
        );

        console.log(
          "Resposta enviada via áudio!",
        );
      } catch (error) {
        console.error(
          "Erro ao processar áudio:",
          error,
        );

        await message.reply(
          "Desculpa, não consegui entender o áudio. Pode tentar de novo ou me mandar por texto?",
        );
      }

      return;
    }

    // =========================================================
    // TEXTO
    // =========================================================

    if (
      message.body &&
      message.body.trim()
    ) {
      console.log(
        "Enviando para processarMensagem()...",
      );

      const resposta =
        await processarMensagem(
          chatId,
          {
            texto:
              message.body.trim(),
          },
        );

      await message.reply(
        resposta,
      );

      console.log(
        "Resposta enviada!",
      );

      return;
    }
  } catch (error) {
    console.error(
      "Erro ao processar mensagem:",
      error,
    );

    try {
      await message.reply(
        "Desculpa, tive um probleminha aqui. Pode tentar de novo?",
      );
    } catch (_) {}
  }
});

client.initialize();