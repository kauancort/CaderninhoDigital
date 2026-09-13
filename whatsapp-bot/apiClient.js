const axios = require("axios");

const API_URL = process.env.API_URL || "http://localhost:8080/api/v1";
const EMAIL = process.env.GESTORA_EMAIL;
const SENHA = process.env.GESTORA_SENHA;

let tokenAtual = null;
let expiraEm = 0;
let loginEmAndamento = null;

const TIMEOUT = Number(process.env.API_TIMEOUT_MS || 60000);

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mensagemErro(err) {
  return err?.response?.data?.message || err?.response?.data?.error || err?.message || String(err);
}

async function login() {
  if (!EMAIL || !SENHA) {
    throw new Error("GESTORA_EMAIL e GESTORA_SENHA precisam estar definidos no .env");
  }

  let ultimoErro = null;

  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      console.log(`[auth] Login na API (tentativa ${tentativa}/3)...`);
      const res = await axios.post(
        `${API_URL}/auth/login`,
        { email: EMAIL, senha: SENHA },
        { timeout: TIMEOUT },
      );

      const dados = res.data || {};
      if (dados.requiresPasswordChange) {
        throw new Error("A conta da Gestora exige alteração de senha antes de usar a API.");
      }
      if (!dados.token) throw new Error("A API não retornou um token de autenticação.");

      tokenAtual = dados.token;
      const expiresIn = Number(dados.expiresIn || 3600);
      expiraEm = Date.now() + Math.max(expiresIn - 60, 30) * 1000;
      console.log("[auth] Login realizado com sucesso.");
      return tokenAtual;
    } catch (err) {
      ultimoErro = err;
      console.error(`[auth] Falha no login: ${mensagemErro(err)}`);
      if (tentativa < 3) await esperar(1500 * tentativa);
    }
  }

  throw ultimoErro || new Error("Não foi possível autenticar na API.");
}

async function getToken() {
  if (tokenAtual && Date.now() < expiraEm) return tokenAtual;
  if (loginEmAndamento) return loginEmAndamento;

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
      "Content-Type": "application/json",
    },
    timeout: TIMEOUT,
  });
  return res.data;
}

async function api(method, path, data) {
  let token = await getToken();

  try {
    return await fazerRequisicao(method, path, data, token);
  } catch (err) {
    if (err.response?.status === 401) {
      console.log("[api] Token rejeitado. Fazendo login novamente...");
      tokenAtual = null;
      expiraEm = 0;
      token = await getToken();
      return await fazerRequisicao(method, path, data, token);
    }

    console.error(`[api] Erro ${method.toUpperCase()} ${path}:`, mensagemErro(err));
    throw err;
  }
}

module.exports = {
  get: (path) => api("get", path),
  post: (path, data) => api("post", path, data),
};
