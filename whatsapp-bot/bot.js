require("dotenv").config();

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

const client = new Client({
  authStrategy: new LocalAuth({ clientId: "caderninho-teste-2" }),
  webVersionCache: { type: "none" },
  puppeteer: {
    headless: true,
    protocolTimeout: 180000,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  },
});

const mensagensProcessadas = new Set();
const filas = new Map();

function normalizarNumero(numero) {
  return String(numero || "").replace(/\D/g, "").trim();
}

function numeroDaGestoraAutorizado(message) {
  const numero = normalizarNumero(process.env.WHATSAPP_GESTORA);
  const lid = normalizarNumero(process.env.WHATSAPP_GESTORA_LID);

  const [id, sufixo] = String(message.from || "").split("@");
  const idNormalizado = normalizarNumero(id);

  if (sufixo === "lid") return Boolean(lid && idNormalizado === lid);
  if (sufixo === "c.us") return Boolean(numero && idNormalizado === numero);
  return false;
}

async function enviarResposta(message, resposta) {
  const texto = String(resposta || "").trim();
  if (!texto) return;

  let ultimoErro = null;

  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      await message.reply(texto);
      console.log("[BOT] Resposta enviada com sucesso.");
      return;
    } catch (erro) {
      ultimoErro = erro;
      console.error(`[BOT] Falha ao enviar resposta (tentativa ${tentativa}/3):`, erro?.message || erro);
      await new Promise((resolve) => setTimeout(resolve, 1200 * tentativa));
    }
  }

  // Fallback sem usar Client.sendMessage diretamente com um ID @lid.
  try {
    const chat = await message.getChat();
    await chat.sendMessage(texto);
    console.log("[BOT] Resposta enviada pelo chat.sendMessage().");
    return;
  } catch (erroFallback) {
    console.error("[BOT] Falha definitiva ao enviar resposta:", ultimoErro || erroFallback);
    throw erroFallback;
  }
}

function enfileirar(chatId, tarefa) {
  const anterior = filas.get(chatId) || Promise.resolve();
  const proxima = anterior
    .catch(() => {})
    .then(tarefa)
    .finally(() => {
      if (filas.get(chatId) === proxima) filas.delete(chatId);
    });
  filas.set(chatId, proxima);
  return proxima;
}

client.on("qr", (qr) => {
  console.log("[BOT] Escaneie o QR Code:");
  qrcode.generate(qr, { small: true });
});

client.on("authenticated", () => {
  console.log("WhatsApp autenticado!");
});

client.on("ready", async () => {
  console.log("WhatsApp conectado e pronto!");
  try {
    console.log("Versao do WhatsApp Web:", await client.getWWebVersion());
  } catch (err) {
    console.log("Nao foi possivel obter a versao do WhatsApp Web:", err.message);
  }
  console.log("Bot configurado para aceitar mensagens somente da Gestora.");
});

client.on("auth_failure", (msg) => console.error("Falha na autenticacao:", msg));
client.on("disconnected", (reason) => console.log("WhatsApp desconectado:", reason));

client.on("message", async (message) => {
  const messageId = message.id?._serialized || message.id?.$1 || null;
  if (messageId && mensagensProcessadas.has(messageId)) return;
  if (messageId) {
    mensagensProcessadas.add(messageId);
    if (mensagensProcessadas.size > 500) mensagensProcessadas.delete(mensagensProcessadas.values().next().value);
  }

  console.log("[BOT] Mensagem recebida:", message.from, "|", message.body || "(sem texto)");

  if (!numeroDaGestoraAutorizado(message)) {
    console.log("[BOT] Mensagem ignorada: remetente nao autorizado.");
    return;
  }

  const chatId = message.from;
  const ehAudio = Boolean(message.hasMedia && (message.type === "ptt" || message.type === "audio"));

  return enfileirar(chatId, async () => {
    try {
      if (ehAudio) {
        console.log("[BOT] Audio recebido. Baixando...");
        let media = null;

        if (message.id && !message.id._serialized) {
          message.id._serialized = message.id.$1 || `${message.id.fromMe}_${message.id.remote}_${message.id.id}`;
        }

        for (let tentativa = 1; tentativa <= 3; tentativa++) {
          try {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            media = await message.downloadMedia();
            if (media?.data) break;
          } catch (erro) {
            console.error(`[BOT] Falha no download do audio ${tentativa}/3:`, erro.message);
            if (tentativa < 3) await new Promise((resolve) => setTimeout(resolve, 1500));
          }
        }

        if (!media?.data) {
          await enviarResposta(message, "Nao consegui baixar o audio. Pode tentar novamente ou mandar por texto?");
          return;
        }

        console.log("[BOT] Transcrevendo audio...");
        const texto = await transcreverAudio(media.data, media.mimetype);
        console.log("[BOT] Audio transcrito:", texto);

        const resposta = await processarMensagem(chatId, { texto });
        await enviarResposta(message, resposta);
        return;
      }

      const texto = String(message.body || "").trim();
      if (!texto) return;

      console.log("[BOT] Enviando para processarMensagem()...");
      const resposta = await processarMensagem(chatId, { texto });
      await enviarResposta(message, resposta);
    } catch (error) {
      console.error("[BOT] Erro ao processar mensagem:", error);
      try {
        await enviarResposta(message, "Tive um probleminha aqui. Os dados pendentes foram mantidos. Pode tentar novamente?");
      } catch (_) {}
    }
  });
});

client.initialize();
