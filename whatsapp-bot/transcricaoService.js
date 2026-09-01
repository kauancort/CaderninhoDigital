const axios = require("axios");
const FormData = require("form-data");
require("dotenv").config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

function validarConfiguracao() {
  if (!GROQ_API_KEY || !GROQ_API_KEY.trim()) {
    throw new Error(
      "GROQ_API_KEY não está configurada no arquivo .env",
    );
  }
}

async function transcreverAudio(base64Audio, mimetype) {
  validarConfiguracao();

  if (!base64Audio) {
    throw new Error("Áudio vazio recebido para transcrição.");
  }

  const buffer = Buffer.from(base64Audio, "base64");

  const extensao = mimetype && mimetype.includes("mp4") ? "mp4" : "ogg";

  const form = new FormData();
  form.append("file", buffer, {
    filename: `audio.${extensao}`,
    contentType: mimetype || "audio/ogg",
  });
  form.append("model", "whisper-large-v3-turbo");
  form.append("language", "pt");
  form.append("response_format", "json");

  console.log("[transcricao] Enviando áudio para Groq Whisper...");

  try {
    const resposta = await axios.post(GROQ_URL, form, {
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        ...form.getHeaders(),
      },
      timeout: 30000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    const texto = resposta.data?.text?.trim();

    if (!texto) {
      throw new Error("A transcrição retornou vazia.");
    }

    console.log("[transcricao] Texto transcrito:", texto);

    return texto;
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;

    console.error(
      "[transcricao] Erro ao transcrever áudio:",
      status || "",
      data || error.message,
    );

    if (status === 401) {
      throw new Error("A chave GROQ_API_KEY é inválida.");
    }

    if (status === 429) {
      throw new Error(
        "Limite de transcrições da Groq atingido. Tente novamente em instantes.",
      );
    }

    throw new Error(
      `Não consegui entender o áudio: ${
        data?.error?.message || error.message
      }`,
    );
  }
}

module.exports = { transcreverAudio };