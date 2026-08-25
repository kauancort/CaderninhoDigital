const axios = require("axios");

const API_URL =
  process.env.API_URL || "http://localhost:8080/api/v1";

const EMAIL = process.env.GESTORA_EMAIL;
const SENHA = process.env.GESTORA_SENHA;

let tokenAtual = null;
let expiraEm = 0;

// Promessa compartilhada para impedir vários logins simultâneos
let loginEmAndamento = null;

async function login() {
  if (!EMAIL || !SENHA) {
    throw new Error(
      "GESTORA_EMAIL e GESTORA_SENHA precisam estar definidos no arquivo .env",
    );
  }

  console.log("[auth] Iniciando login na API...");

  const res = await axios.post(
    `${API_URL}/auth/login`,
    {
      email: EMAIL,
      senha: SENHA,
    },
    {
      timeout: 10000,
    },
  );

  const dados = res.data;

  if (dados.requiresPasswordChange) {
    throw new Error(
      "A conta da gestora precisa trocar a senha no primeiro acesso. Faça isso pelo site antes de usar o bot.",
    );
  }

  if (!dados.token) {
    throw new Error("A API não retornou um token de autenticação.");
  }

  tokenAtual = dados.token;

  const expiresIn = Number(dados.expiresIn || 3600);

  expiraEm = Date.now() + Math.max(expiresIn - 60, 30) * 1000;

  console.log(
    "[auth] Login realizado com sucesso. Token válido por",
    expiresIn,
    "s",
  );

  return tokenAtual;
}

async function getToken() {
  // Token ainda válido
  if (tokenAtual && Date.now() < expiraEm) {
    return tokenAtual;
  }

  // Já existe outro login acontecendo.
  // Reutiliza a mesma Promise em vez de fazer outro login.
  if (loginEmAndamento) {
    console.log("[auth] Login já está em andamento. Aguardando...");
    return await loginEmAndamento;
  }

  // Primeiro login
  loginEmAndamento = login();

  try {
    return await loginEmAndamento;
  } finally {
    loginEmAndamento = null;
  }
}

async function fazerRequisicao(method, path, data, token) {
  console.log(`[api] ${method.toUpperCase()} ${API_URL}${path}`);

  const res = await axios({
    method,
    url: `${API_URL}${path}`,
    data,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    timeout: 15000,
  });

  return res.data;
}

async function api(method, path, data) {
  let token = await getToken();

  try {
    return await fazerRequisicao(method, path, data, token);
  } catch (err) {
    // Token expirado/inválido
    if (err.response?.status === 401) {
      console.log(
        `[api] Token rejeitado para ${method.toUpperCase()} ${path}. Fazendo novo login...`,
      );

      tokenAtual = null;
      expiraEm = 0;

      token = await getToken();

      return await fazerRequisicao(
        method,
        path,
        data,
        token,
      );
    }

    console.error(
      `[api] Erro em ${method.toUpperCase()} ${path}:`,
      err.message,
    );

    if (err.code) {
      console.error("[api] Código:", err.code);
    }

    if (err.response) {
      console.error("[api] Status:", err.response.status);
      console.error("[api] Resposta:", err.response.data);
    }

    throw err;
  }
}

module.exports = {
  get: (path) => api("get", path),
  post: (path, data) => api("post", path, data),
};