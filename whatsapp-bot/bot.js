

require("dotenv").config();

const http = require("http");
const qrcode = require("qrcode-terminal");
const pino = require("pino");
// Baileys é ESM. O projeto permanece CommonJS e carrega a biblioteca
// com import() dinâmico para não exigir "type": "module" no package.json.
let makeWASocket;
let DisconnectReason;
let downloadMediaMessage;
let getContentType;
let initAuthCreds;
let proto;
let addTransactionCapability;

async function carregarBaileys() {
  if (makeWASocket) return;
  const biblioteca = await import("@whiskeysockets/baileys");
  makeWASocket = biblioteca.default;
  DisconnectReason = biblioteca.DisconnectReason;
  downloadMediaMessage = biblioteca.downloadMediaMessage;
  getContentType = biblioteca.getContentType;
  initAuthCreds = biblioteca.initAuthCreds;
  proto = biblioteca.proto;
  addTransactionCapability = biblioteca.addTransactionCapability;

  if (
    typeof makeWASocket !== "function" ||
    !initAuthCreds ||
    !proto ||
    typeof addTransactionCapability !== "function"
  ) {
    throw new Error(
      "A instalação do Baileys não expôs todas as funções necessárias. Confira a versão 7.0.0-rc14."
    );
  }
}

const { transcreverAudio } = require("./transcricaoService");
const { processarMensagem } = require("./flow");
const { criarEstadoAutenticacao } = require("./supabaseAuthStore");

const PORT = Number(process.env.PORT || 3000);
const loggerBaileys = pino({ level: process.env.BAILEYS_LOG_LEVEL || "warn" });

const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ status: "online", service: "Caderninho WhatsApp Bot" }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[HTTP] Servidor iniciado na porta ${PORT}`);
});

process.on("unhandledRejection", (reason) => {
  console.error("[BOT] Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[BOT] Uncaught Exception:", error);
});

const mensagensProcessadas = new Set();
const filas = new Map();
let socketAtual = null;
let reconexaoAgendada = false;
let encerrando = false;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizarNumero(numero) {
  return String(numero || "").replace(/\D/g, "").trim();
}

function numerosEquivalentes(a, b) {
  const primeiro = normalizarNumero(a);
  const segundo = normalizarNumero(b);
  if (!primeiro || !segundo) return false;
  if (primeiro === segundo) return true;

  // Permite comparar o mesmo telefone quando um dos lados inclui o código 55.
  if (primeiro.startsWith("55") && primeiro.slice(2) === segundo) return true;
  if (segundo.startsWith("55") && segundo.slice(2) === primeiro) return true;
  return false;
}

function extrairNumeroDoJid(jid) {
  if (!jid || typeof jid !== "string") return null;
  const [usuario, servidor] = jid.split("@");
  if (!usuario || !["s.whatsapp.net", "c.us"].includes(servidor)) return null;
  return normalizarNumero(usuario.split(":")[0]);
}

function extrairLidDoJid(jid) {
  if (!jid || typeof jid !== "string" || !jid.endsWith("@lid")) return null;
  return normalizarNumero(jid.split("@")[0].split(":")[0]);
}

async function obterLidMapping(sock) {
  return sock?.signalRepository?.lidMapping || null;
}

async function resolverTelefonePorLid(lidJid, sock) {
  const lid = String(lidJid || "").split(":")[0];
  if (!lid.endsWith("@lid")) return null;

  const lidMapping = await obterLidMapping(sock);
  if (!lidMapping || typeof lidMapping.getPNForLID !== "function") {
    console.warn("[BOT] O socket não disponibilizou o armazenamento LID do Baileys.");
    return null;
  }

  try {
    const jidTelefone = await lidMapping.getPNForLID(lid);
    return extrairNumeroDoJid(jidTelefone);
  } catch (error) {
    console.warn("[BOT] Falha ao resolver LID:", error?.message || error);
    return null;
  }
}

async function numeroRemetente(message, sock) {
  const candidatos = [
    message.key?.remoteJidAlt,
    message.key?.participantAlt,
    message.key?.remoteJid,
    message.key?.participant,
  ].filter(Boolean);

  for (const jid of candidatos) {
    const numero = extrairNumeroDoJid(jid);
    if (numero) return numero;
  }

  const lid = candidatos.find((jid) => String(jid).endsWith("@lid"));
  return lid ? await resolverTelefonePorLid(lid, sock) : null;
}

async function numeroDaGestoraAutorizado(message, sock) {
  const numeroGestora = normalizarNumero(process.env.WHATSAPP_GESTORA);

  if (!numeroGestora) {
    console.error("[BOT] WHATSAPP_GESTORA não está configurado.");
    return false;
  }

  const jids = [
    message.key?.remoteJidAlt,
    message.key?.participantAlt,
    message.key?.remoteJid,
    message.key?.participant,
  ].filter(Boolean);

  // Primeiro: usa o telefone alternativo fornecido diretamente pelo WhatsApp.
  for (const jid of jids) {
    const numero = extrairNumeroDoJid(jid);
    if (numero && numerosEquivalentes(numero, numeroGestora)) {
      console.log("[BOT] Gestora autorizada pelo número cadastrado.");
      return true;
    }
  }

  // Segundo: resolve o LID usando o repositório oficial do Baileys.
  const lidsRecebidos = jids.filter((jid) => String(jid).endsWith("@lid"));
  for (const lid of lidsRecebidos) {
    const numeroResolvido = await resolverTelefonePorLid(lid, sock);
    if (numeroResolvido && numerosEquivalentes(numeroResolvido, numeroGestora)) {
      console.log("[BOT] Gestora autorizada: LID associado ao telefone cadastrado.");
      return true;
    }
  }

  console.log("[BOT] Remetente não pôde ser confirmado como Gestora; mensagem ignorada.");
  return false;
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

function normalizarConteudoMensagem(messageContent) {
  let content = messageContent;
  const wrappers = [
    "ephemeralMessage",
    "viewOnceMessage",
    "viewOnceMessageV2",
    "viewOnceMessageV2Extension",
    "documentWithCaptionMessage",
  ];

  while (content && typeof content === "object") {
    const wrapper = wrappers.find((key) => content[key]?.message);
    if (!wrapper) break;
    content = content[wrapper].message;
  }

  return content || {};
}

function extrairTexto(content) {
  return String(
    content?.conversation ||
    content?.extendedTextMessage?.text ||
    content?.imageMessage?.caption ||
    content?.videoMessage?.caption ||
    content?.documentMessage?.caption ||
    content?.buttonsResponseMessage?.selectedButtonId ||
    content?.templateButtonReplyMessage?.selectedId ||
    content?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    ""
  ).trim();
}

async function enviarResposta(sock, message, resposta) {
  const texto = String(resposta || "").trim();
  if (!texto) {
    console.log("[BOT] Resposta vazia. Nada para enviar.");
    return;
  }

  const chatId = message.key?.remoteJid;
  if (!chatId) throw new Error("Não foi possível identificar o chat para responder.");

  let ultimoErro = null;
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      await sock.sendMessage(chatId, { text: texto }, { quoted: message });
      console.log("[BOT] Resposta enviada com sucesso.");
      return;
    } catch (error) {
      ultimoErro = error;
      console.error(`[BOT] Falha ao enviar resposta (${tentativa}/3):`, error?.message || error);
      if (tentativa < 3) await esperar(1200 * tentativa);
    }
  }

  // Última tentativa sem citar a mensagem original.
  try {
    await sock.sendMessage(chatId, { text: texto });
    console.log("[BOT] Resposta enviada sem citação.");
  } catch (error) {
    console.error("[BOT] Falha definitiva ao enviar resposta:", ultimoErro || error);
    throw error;
  }
}

async function baixarAudio(message, sock) {
  const buffer = await downloadMediaMessage(
    message,
    "buffer",
    {},
    {
      logger: loggerBaileys,
      reuploadRequest: sock.updateMediaMessage,
    }
  );

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("O WhatsApp não retornou o arquivo de áudio.");
  }

  const content = normalizarConteudoMensagem(message.message);
  const audio = content.audioMessage || {};
  const mimetype = audio.mimetype || "audio/ogg";

  return {
    base64: buffer.toString("base64"),
    mimetype,
  };
}

async function processarMensagemRecebida(sock, message) {
  if (!message?.message || message.key?.fromMe) return;

  const chatId = message.key?.remoteJid;
  if (!chatId || chatId.endsWith("@g.us") || chatId === "status@broadcast") return;

  const messageId = message.key?.id;
  if (messageId && mensagensProcessadas.has(messageId)) {
    console.log("[BOT] Mensagem duplicada ignorada.");
    return;
  }

  console.log("[BOT] Mensagem recebida:", chatId);

  if (!(await numeroDaGestoraAutorizado(message, sock))) {
    console.log("[BOT] Mensagem ignorada: remetente não autorizado.");
    return;
  }

  console.log("[BOT] Mensagem da Gestora autorizada.");
  if (messageId) {
    mensagensProcessadas.add(messageId);
    if (mensagensProcessadas.size > 500) {
      mensagensProcessadas.delete(mensagensProcessadas.values().next().value);
    }
  }

  const content = normalizarConteudoMensagem(message.message);
  const tipo = getContentType(content);
  const ehAudio = tipo === "audioMessage" || Boolean(content.audioMessage);

  return enfileirar(chatId, async () => {
    try {
      let texto = "";

      if (ehAudio) {
        console.log("[BOT] Áudio recebido. Baixando...");
        let audio = null;

        for (let tentativa = 1; tentativa <= 3; tentativa++) {
          try {
            audio = await baixarAudio(message, sock);
            if (audio?.base64) break;
          } catch (error) {
            console.error(`[BOT] Falha no download do áudio ${tentativa}/3:`, error?.message || error);
            if (tentativa < 3) await esperar(1500 * tentativa);
          }
        }

        if (!audio?.base64) {
          await enviarResposta(sock, message, "Não consegui baixar o áudio. Pode tentar novamente ou mandar por texto?");
          return;
        }

        console.log("[BOT] Áudio baixado. Transcrevendo pela Groq...");
        texto = await transcreverAudio(audio.base64, audio.mimetype);
        console.log("[BOT] Áudio transcrito:", texto);

        if (!texto?.trim()) {
          await enviarResposta(sock, message, "Não consegui entender o áudio. Pode tentar novamente?");
          return;
        }
      } else {
        texto = extrairTexto(content);
      }

      if (!texto) {
        console.log("[BOT] Mensagem sem texto utilizável. Ignorando.");
        return;
      }

      console.log("[BOT] Enviando para processarMensagem():", texto);
      const resposta = await processarMensagem(chatId, { texto });
      console.log("[BOT] Resposta gerada pelo flow.");
      await enviarResposta(sock, message, resposta);
    } catch (error) {
      console.error("[BOT] Erro ao processar mensagem:", error);
      try {
        await enviarResposta(
          sock,
          message,
          "Tive um probleminha aqui. Os dados pendentes foram mantidos. Pode tentar novamente?"
        );
      } catch (erroEnvio) {
        console.error("[BOT] Também não foi possível enviar a mensagem de erro:", erroEnvio?.message || erroEnvio);
      }
    }
  });
}

function agendarReconexao() {
  if (reconexaoAgendada || encerrando) return;
  reconexaoAgendada = true;
  setTimeout(() => {
    reconexaoAgendada = false;
    iniciarWhatsApp().catch((error) => {
      console.error("[BOT] Falha ao reconectar:", error);
      agendarReconexao();
    });
  }, 3000);
}

async function iniciarWhatsApp() {
  await carregarBaileys();
  console.log("[BOT] Carregando autenticação do Supabase...");
  const auth = await criarEstadoAutenticacao({
    initAuthCreds,
    proto,
    addTransactionCapability,
  });

  console.log("[BOT] Criando conexão Baileys (sem Chrome/Puppeteer)...");
  const sock = makeWASocket({
    auth: auth.state,
    logger: loggerBaileys,
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    // Evita consultas iniciais de histórico/propriedades que estão expirando
    // com 408 no ambiente atual. A conexão e o recebimento de mensagens
    // continuam habilitados.
    fireInitQueries: false,
    browser: ["Caderninho Digital", "Chrome", "1.0.0"],
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 25000,
  });

  socketAtual = sock;

  sock.ev.on("creds.update", () => {
    auth.saveCreds().catch((error) => {
      console.error("[AUTH] Não foi possível salvar as credenciais no Supabase:", error?.message || error);
    });
  });

  // Baileys pode receber associações PN<->LID em notificações e contatos.
  // Guardamos esses pares no próprio armazenamento de chaves da sessão.
  sock.ev.on("lid-mapping.update", async (mapping) => {
    try {
      const lidMapping = await obterLidMapping(sock);
      if (lidMapping && mapping?.lid && mapping?.pn) {
        await lidMapping.storeLIDPNMappings([{
          lid: String(mapping.lid).includes("@") ? mapping.lid : `${mapping.lid}@lid`,
          pn: String(mapping.pn).includes("@") ? mapping.pn : `${mapping.pn}@s.whatsapp.net`,
        }]);
        console.log("[BOT] Mapeamento LID/telefone atualizado pelo WhatsApp.");
      }
    } catch (error) {
      console.warn("[BOT] Não foi possível salvar mapeamento LID:", error?.message || error);
    }
  });

  async function salvarMapeamentosDosContatos(contatos) {
    try {
      const lidMapping = await obterLidMapping(sock);
      if (!lidMapping || typeof lidMapping.storeLIDPNMappings !== "function") return;

      const pares = (Array.isArray(contatos) ? contatos : [contatos])
        .filter((contato) => contato?.id && contato?.lid)
        .map((contato) => ({
          lid: String(contato.lid).includes("@") ? contato.lid : `${contato.lid}@lid`,
          pn: String(contato.id).includes("@") ? contato.id : `${contato.id}@s.whatsapp.net`,
        }));

      if (pares.length) {
        await lidMapping.storeLIDPNMappings(pares);
        console.log(`[BOT] ${pares.length} mapeamento(s) de contato LID/telefone armazenado(s).`);
      }
    } catch (error) {
      console.warn("[BOT] Falha ao armazenar mapeamentos dos contatos:", error?.message || error);
    }
  }

  sock.ev.on("contacts.upsert", salvarMapeamentosDosContatos);
  sock.ev.on("contacts.update", salvarMapeamentosDosContatos);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log("\n========================================");
      console.log("[BOT] QR CODE RECEBIDO — escaneie em Aparelhos conectados no WhatsApp");
      console.log("========================================");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "connecting") {
      console.log("[BOT] Conectando ao WhatsApp...");
    }

    if (connection === "open") {
      console.log("========================================");
      console.log("[BOT] WHATSAPP CONECTADO E PRONTO!");
      console.log("[BOT] Sessão armazenada no Supabase.");
      console.log("[BOT] Mensagens aceitas somente da Gestora.");
      console.log("========================================");
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      console.warn("[BOT] Conexão WhatsApp encerrada. Código:", statusCode || "não identificado");

      if (statusCode === DisconnectReason.loggedOut) {
        console.error("[BOT] Sessão desconectada pelo WhatsApp. Será necessário vincular novamente.");
        return;
      }

      agendarReconexao();
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const message of messages || []) {
      try {
        await processarMensagemRecebida(sock, message);
      } catch (error) {
        console.error("[BOT] Erro inesperado no evento messages.upsert:", error);
      }
    }
  });

  return sock;
}

async function encerrar() {
  encerrando = true;
  console.log("[BOT] Encerrando serviço...");
  try {
    socketAtual?.end(undefined);
  } catch (_) {}
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on("SIGTERM", encerrar);
process.on("SIGINT", encerrar);

console.log("[BOT] Iniciando WhatsApp com Baileys...");
iniciarWhatsApp().catch((error) => {
  // Não imprimir o objeto Axios completo: ele pode conter cabeçalhos secretos.
  console.error("[BOT] Não foi possível iniciar o WhatsApp:", error?.message || error);
  process.exitCode = 1;
});
