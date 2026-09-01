const { transcreverAudio } = require("./transcricaoService");
console.log("🚨 BOT.JS COMEÇOU A EXECUTAR");

const {
  Client,
  LocalAuth,
} = require("whatsapp-web.js");

const qrcode = require("qrcode-terminal");

require("dotenv").config();

const {
  processarMensagem,
} = require("./flow");

// ADICIONADO: evita que erros internos do Puppeteer/whatsapp-web.js
// (ex: "Execution context was destroyed", "Runtime.callFunctionOn timed out")
// derrubem o processo Node inteiro. Sem isso, uma falha de comunicação
// com o Chrome mata o bot até você reiniciar manualmente.
process.on("unhandledRejection", (reason) => {
  console.error(
    "⚠️ Unhandled Rejection (bot continua rodando):",
    reason,
  );
});

process.on("uncaughtException", (err) => {
  console.error(
    "⚠️ Uncaught Exception (bot continua rodando):",
    err,
  );
});

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: "caderninho-teste-2",
  }),

  // ADICIONADO: em vez de buscar remotamente qual versão do WhatsApp Web
  // usar (podendo ficar dessincronizada com o que o servidor realmente
  // serve, causando reload da página no meio da injeção do script —
  // exatamente o que gera "Execution context was destroyed"), usa a
  // versão do WhatsApp Web embutida na própria lib.
  webVersionCache: {
    type: "none",
  },

  puppeteer: {
    headless: true,

    // Aumenta o tempo permitido para o Puppeteer se comunicar
    // com o Chrome/WhatsApp Web.
    protocolTimeout: 180000,

    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage"
    ],
  },
});

function normalizarNumero(numero) {
  if (!numero) return "";
  return numero.replace(/\D/g, "").trim();
}

function numeroDaGestoraAutorizado(message) {
  const numeroConfigurado = normalizarNumero(
    process.env.WHATSAPP_GESTORA
  );

  const lidConfigurado = normalizarNumero(
    process.env.WHATSAPP_GESTORA_LID
  );

  if (!numeroConfigurado && !lidConfigurado) {
    console.warn(
      "⚠️ Nem WHATSAPP_GESTORA nem WHATSAPP_GESTORA_LID estão configurados no .env"
    );

    return false;
  }

  const [idPart, suffix] = (message.from || "").split("@");

  const idDigits = normalizarNumero(idPart);

  if (suffix === "lid") {
    const autorizado =
      !!lidConfigurado && idDigits === lidConfigurado;

    console.log(
      `🔎 Remetente via @lid: ${idDigits} | Autorizado: ${autorizado}`
    );

    return autorizado;
  }

  if (suffix === "c.us") {
    const autorizado =
      !!numeroConfigurado && idDigits === numeroConfigurado;

    console.log(
      `🔎 Remetente via @c.us: ${idDigits} | Autorizado: ${autorizado}`
    );

    return autorizado;
  }

  console.log(
    `🔎 Sufixo desconhecido no remetente: ${message.from}`
  );

  return false;
}

client.on("qr", (qr) => {
  console.log("📱 Escaneie o QR Code:");

  qrcode.generate(qr, {
    small: true,
  });
});

client.on("authenticated", () => {
  console.log("🔐 WhatsApp autenticado!");
});

client.on("ready", async () => {
  console.log("✅ WhatsApp conectado e pronto!");

  try {
    const versao = await client.getWWebVersion();

    console.log(
      "🔹 Versão do WhatsApp Web detectada:",
      versao
    );
  } catch (err) {
    console.error(
      "❌ Não foi possível detectar a versão do WhatsApp Web:",
      err.message
    );
  }

  if (
    process.env.WHATSAPP_GESTORA ||
    process.env.WHATSAPP_GESTORA_LID
  ) {
    console.log(
      "🔒 Bot configurado para aceitar mensagens somente da Gestora."
    );
  } else {
    console.warn(
      "⚠️ Configure WHATSAPP_GESTORA e/ou WHATSAPP_GESTORA_LID no arquivo .env."
    );
  }
});

client.on("auth_failure", (msg) => {
  console.error(
    "❌ Falha na autenticação:",
    msg
  );
});

client.on("disconnected", (reason) => {
  console.log(
    "⚠️ WhatsApp desconectado:",
    reason
  );
});

// Log cru para diagnóstico
client.on("message", async (message) => {
  console.log(
    "🟢 EVENTO 'message' DISPAROU. From:",
    message.from,
    "| Body:",
    message.body || "(sem texto)"
  );

  if (!numeroDaGestoraAutorizado(message)) {
    console.log(
      "🚫 Mensagem ignorada: número não autorizado.",
      message.from
    );

    return;
  }

  console.log(
    "✅ Mensagem autorizada da Gestora."
  );

  try {
    const chatId = message.from;

    const ehAudio =
      message.hasMedia &&
      (message.type === "ptt" ||
        message.type === "audio");

    if (ehAudio) {
      console.log("🎧 Áudio recebido, baixando...");

      let media = null;
      const tentativasMaximas = 3;

      for (let tentativa = 1; tentativa <= tentativasMaximas; tentativa++) {
        try {
          await new Promise((resolve) => setTimeout(resolve, 1500));

          media = await message.downloadMedia();

          if (media && media.data) {
            break;
          }
          
          } catch (erroDownload) {
          console.error(
            `🎧 Tentativa ${tentativa} de baixar áudio falhou:`,
            JSON.stringify(erroDownload, Object.getOwnPropertyNames(erroDownload), 2)
          );

          if (tentativa === tentativasMaximas) {
            await message.reply(
              "Não consegui baixar o áudio depois de várias tentativas, meu bem. Pode tentar mandar de novo ou me escrever por texto? 💛"
            );
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      if (!media || !media.data) {
        await message.reply(
          "Não consegui baixar o áudio, meu bem. Pode tentar mandar de novo ou me escrever por texto? 💛"
        );
        return;
      }

      try {
        console.log("🎧 Transcrevendo áudio...");

        const textoTranscrito = await transcreverAudio(
          media.data,
          media.mimetype
        );

        console.log("🎧 Áudio transcrito:", textoTranscrito);

        const resposta = await processarMensagem(chatId, {
          texto: textoTranscrito,
        });

        await message.reply(resposta);

        console.log("📤 Resposta enviada (via áudio)!");
      } catch (error) {
        console.error("❌ Erro ao processar áudio:", error);

        await message.reply(
          "Desculpa, meu bem, não consegui entender o áudio. Pode tentar de novo ou me mandar por texto? 💛"
        );
      }

      return;
    }

    if (
      message.body &&
      message.body.trim()
    ) {
      console.log(
        "🧠 Enviando para processarMensagem()..."
      );

      const resposta = await processarMensagem(
        chatId,
        {
          texto: message.body.trim(),
        }
      );

      await message.reply(resposta);

      console.log(
        "📤 Resposta enviada!"
      );

      return;
    }
  } catch (error) {
    console.error(
      "❌ Erro ao processar mensagem:",
      error
    );

    try {
      await message.reply(
        "Desculpa, meu bem, tive um probleminha aqui. Pode tentar de novo? 💛"
      );
    } catch (_) {}
  }
});

client.initialize();