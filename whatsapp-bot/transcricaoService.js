const Groq = require("groq-sdk");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
require("dotenv").config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
  console.warn("⚠️ GROQ_API_KEY não está configurada no arquivo .env");
}

const groq = new Groq({ apiKey: GROQ_API_KEY });

function escolherExtensao(mimetype = "audio/ogg") {
  const tipo = String(mimetype).toLowerCase();
  if (tipo.includes("webm")) return ".webm";
  if (tipo.includes("mpeg") || tipo.includes("mp3")) return ".mp3";
  if (tipo.includes("wav")) return ".wav";
  if (tipo.includes("mp4")) return ".mp4";
  if (tipo.includes("m4a")) return ".m4a";
  return ".ogg";
}

async function transcreverAudio(audioBase64, mimetype = "audio/ogg") {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY não está configurada no .env");
  }

  if (!audioBase64) {
    throw new Error("O áudio não foi informado.");
  }

  const extensao = escolherExtensao(mimetype);
  const nomeTemporario = `whatsapp-${crypto.randomUUID()}${extensao}`;
  const caminhoTemporario = path.join(os.tmpdir(), nomeTemporario);

  try {
    const buffer = Buffer.from(audioBase64, "base64");
    fs.writeFileSync(caminhoTemporario, buffer);

    console.log("[transcricao] Enviando áudio para Groq Whisper...");

    const resposta = await groq.audio.transcriptions.create({
      file: fs.createReadStream(caminhoTemporario),
      model: "whisper-large-v3",
      language: "pt",
      response_format: "text",
    });

    const texto =
      typeof resposta === "string"
        ? resposta
        : resposta?.text || "";

    if (!texto.trim()) {
      throw new Error("A Groq não retornou nenhum texto para o áudio.");
    }

    console.log("[transcricao] Texto transcrito:", texto.trim());

    return texto.trim();
  } finally {
    try {
      if (fs.existsSync(caminhoTemporario)) {
        fs.unlinkSync(caminhoTemporario);
      }
    } catch (erroLimpeza) {
      console.warn(
        "⚠️ Não foi possível remover o arquivo temporário do áudio:",
        erroLimpeza.message,
      );
    }
  }
}

module.exports = {
  transcreverAudio,
};
