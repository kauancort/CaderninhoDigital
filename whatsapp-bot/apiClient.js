const axios = require("axios");

const API_URL = process.env.API_URL || "http://localhost:8080/api/v1";
const EMAIL = process.env.GESTORA_EMAIL;
const SENHA = process.env.GESTORA_SENHA;

let tokenAtual = null;
let expiraEm = 0; // timestamp em ms

async function login() {
  if (!EMAIL || !SENHA) {
    throw new Error(
      "GESTORA_EMAIL e GESTORA_SENHA precisam estar definidos no arquivo .env",
    );
  }

  const res = await axios.post(`${API_URL}/auth/login`, {
    email: EMAIL,
    senha: SENHA,
  });

  const dados = res.data;

  if (dados.requiresPasswordChange) {
    throw new Error(
      "A conta da gestora precisa trocar a senha no primeiro acesso. Faça isso pelo site antes de usar o bot.",
    );
  }

  tokenAtual = dados.token;
  expiraEm = Date.now() + (dados.expiresIn - 60) * 1000;
  console.log("[auth] Login realizado com sucesso, token válido por", dados.expiresIn, "s");
  return tokenAtual;
}

async function getToken() {
  if (!tokenAtual || Date.now() >= expiraEm) {
    await login();
  }
  return tokenAtual;
}

async function api(method, path, data) {
  const token = await getToken();
  try {
    const res = await axios({
      method,
      url: `${API_URL}${path}`,
      data,
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  } catch (err) {
    if (err.response?.status === 401) {
      await login();
      const res = await axios({
        method,
        url: `${API_URL}${path}`,
        data,
        headers: { Authorization: `Bearer ${tokenAtual}` },
      });
      return res.data;
    }
    throw err;
  }
}

module.exports = {
  get: (path) => api("get", path),
  post: (path, data) => api("post", path, data),
};
