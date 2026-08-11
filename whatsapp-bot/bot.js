const {
  Client,
  LocalAuth,
} = require("whatsapp-web.js");

const qrcode = require("qrcode-terminal");

require("dotenv").config();

const {
  processarMensagem,
} = require("./flow");

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: "caderninho-teste",
  }),

  puppeteer: {
    headless: false,

    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  },
});

function normalizarNumero(numero) {
  if (!numero) {
    return "";
  }

  return numero
    .replace(/\D/g, "")
    .trim();
}

function numeroDaGestoraAutorizado(message) {
  const numeroConfigurado =
    normalizarNumero(
      process.env.WHATSAPP_GESTORA,
    );

  if (!numeroConfigurado) {
    console.warn(
      "⚠️ WHATSAPP_GESTORA não está configurado no .env",
    );

    return false;
  }

  const numeroRemetente =
    normalizarNumero(
      message.from,
    );

  /*
   * O WhatsApp Web.js normalmente entrega o remetente
   * no formato:
   *
   * 5511999999999@c.us
   *
   * Depois da normalização fica:
   *
   * 5511999999999
   */

  return (
    numeroRemetente ===
    numeroConfigurado
  );
}

client.on("qr", (qr) => {
  console.log(
    "📱 Escaneie o QR Code:",
  );

  qrcode.generate(qr, {
    small: true,
  });
});

client.on("authenticated", () => {
  console.log(
    "🔐 WhatsApp autenticado!",
  );
});

client.on("ready", () => {
  console.log(
    "✅ WhatsApp conectado e pronto!",
  );

  const gestora =
    process.env.WHATSAPP_GESTORA;

  if (gestora) {
    console.log(
      "🔒 Bot configurado para aceitar mensagens somente da Gestora.",
    );
  } else {
    console.warn(
      "⚠️ Configure WHATSAPP_GESTORA no arquivo .env.",
    );
  }
});

client.on(
  "auth_failure",
  (msg) => {
    console.error(
      "❌ Falha na autenticação:",
      msg,
    );
  },
);

client.on(
  "disconnected",
  (reason) => {
    console.log(
      "⚠️ WhatsApp desconectado:",
      reason,
    );
  },
);

client.on(
  "message",
  async (message) => {
    console.log(
      "📩 Mensagem recebida:",
      message.body ||
        "(áudio/mídia)",
    );

    /*
     * SEGURANÇA
     *
     * Apenas a Gestora pode utilizar o bot.
     */
    if (
      !numeroDaGestoraAutorizado(
        message,
      )
    ) {
      console.log(
        "🚫 Mensagem ignorada: número não autorizado.",
        message.from,
      );

      return;
    }

    try {
      const chatId =
        message.from;

      /*
       * Nota de voz / áudio
       *
       * Nesta primeira etapa o flow.js ainda
       * não processa áudio. Estamos deixando
       * o recebimento preparado para a próxima etapa.
       */
      const ehAudio =
        message.hasMedia &&
        (
          message.type === "ptt" ||
          message.type === "audio"
        );

      if (ehAudio) {
        await message.reply(
          "🎧 Recebi seu áudio, meu bem! " +
          "Ainda estou terminando a parte de áudio. " +
          "Por enquanto, pode me mandar essa informação por texto. 💛",
        );

        return;
      }

      /*
       * Mensagem de texto
       */
      if (
        message.body &&
        message.body.trim()
      ) {
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
          "📤 Resposta enviada!",
        );

        return;
      }
    } catch (error) {
      console.error(
        "❌ Erro ao processar mensagem:",
        error,
      );

      try {
        await message.reply(
          "Desculpa, meu bem, tive um probleminha aqui. Pode tentar de novo? 💛",
        );
      } catch (_) {
        // Ignora erro ao tentar responder.
      }
    }
  },
);

client.initialize();