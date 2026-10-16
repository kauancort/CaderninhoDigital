const axios = require("axios");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// ============================================================
// CARREGAMENTO DO .ENV
// ============================================================

function limpar(valor) {
  return String(valor ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^['"]|['"]$/g, "");
}

function carregarEnv() {
  const candidatos = [
    path.join(__dirname, ".env"),
    path.join(process.cwd(), ".env"),
  ];

  const envUsado = candidatos.find((arquivo) => fs.existsSync(arquivo));

  if (envUsado) {
    dotenv.config({ path: envUsado, override: true });
    console.log(`[env] Usando .env em: ${envUsado}`);
  } else {
    dotenv.config();
    console.warn("[env] Nenhum .env encontrado no diretório esperado.");
  }
}

carregarEnv();

// ============================================================
// CONFIGURAÇÃO
// ============================================================

const API_URL = (
  limpar(process.env.API_URL) ||
  "http://localhost:8080/api/v1"
).replace(/\/+$/, "");

const TIMEOUT = Number(process.env.API_TIMEOUT_MS || 60000);

if (!/^https?:\/\//i.test(API_URL)) {
  throw new Error(
    `[env] API_URL inválida: ${API_URL}. Use http:// ou https://.`
  );
}

console.log(`[env] API_URL em uso: ${API_URL}`);

if (/localhost|127\.0\.0\.1/i.test(API_URL)) {
  console.warn("[env] ATENÇÃO: API_URL está apontando para localhost.");
}

// ============================================================
// ESTADO DE AUTENTICAÇÃO
// ============================================================

let token = null;
let loginEmAndamento = null;

// ============================================================
// UTILITÁRIOS
// ============================================================

function erroSemResposta(error) {
  return !error?.response;
}

function erroDeRedeNaoRetryavel(error) {
  return [
    "ENOTFOUND",
    "EAI_AGAIN",
    "ECONNREFUSED",
    "ECONNRESET",
  ].includes(error?.code);
}

function deveTentarLoginNovamente(error) {
  if (erroDeRedeNaoRetryavel(error)) {
    return false;
  }

  if (error?.code === "ETIMEDOUT" || error?.code === "ECONNABORTED") {
    return true;
  }

  const status = error?.response?.status;

  if (!status) {
    return true;
  }

  return status === 408 || status === 429 || status >= 500;
}

function mensagemDoErro(error) {
  const status = error?.response?.status;
  const dados = error?.response?.data;

  if (status) {
    return (
      dados?.message ||
      dados?.error ||
      `HTTP ${status}`
    );
  }

  return error?.message || "Erro de comunicação com a API.";
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extrairToken(data) {
  return (
    data?.token ||
    data?.accessToken ||
    data?.access_token ||
    data?.jwt ||
    data?.data?.token ||
    data?.data?.accessToken ||
    data?.data?.access_token ||
    null
  );
}

// ============================================================
// LOGIN
// ============================================================

async function login() {
  const email = limpar(process.env.GESTORA_EMAIL);
  const senha = limpar(process.env.GESTORA_SENHA);

  if (!email || !senha) {
    throw new Error(
      "GESTORA_EMAIL e GESTORA_SENHA precisam estar configurados no .env."
    );
  }

  console.log(
    `[auth] POST ${API_URL}/auth/login | email=${email.slice(0, 2)}***@${
      email.split("@")[1] || ""
    } (len ${email.length}) | len(senha)=${senha.length}`
  );

  const maxTentativas = 3;
  let ultimoErro = null;

  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    try {
      console.log(
        `[auth] Login na API (tentativa ${tentativa}/${maxTentativas})...`
      );

      const resposta = await axios.post(
        `${API_URL}/auth/login`,
        {
          email,
          senha,
        },
        {
          timeout: TIMEOUT,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );

      const novoToken = extrairToken(resposta.data);

      if (!novoToken) {
        throw new Error(
          "A API respondeu ao login, mas não retornou um token de autenticação."
        );
      }

      token = novoToken;

      console.log("[auth] Login na API realizado com sucesso.");

      return token;
    } catch (error) {
      ultimoErro = error;

      if (erroSemResposta(error)) {
        console.error(
          `[auth] Falha no login (HTTP sem resposta): ${
            error?.code || "SEM_RESPOSTA"
          } - ${error?.message || error}`
        );
      } else {
        console.error(
          `[auth] Falha no login (HTTP ${error.response.status}): ${mensagemDoErro(
            error
          )}`
        );
      }

      if (
        tentativa >= maxTentativas ||
        !deveTentarLoginNovamente(error)
      ) {
        break;
      }

      await esperar(1500 * tentativa);
    }
  }

  const codigo = ultimoErro?.code;

  if (["ENOTFOUND", "EAI_AGAIN"].includes(codigo)) {
    throw new Error(
      `Não foi possível localizar a API em ${API_URL}. O DNS não conseguiu resolver o endereço (${codigo}).`
    );
  }

  if (codigo === "ECONNREFUSED") {
    throw new Error(
      `A conexão com a API foi recusada em ${API_URL}. Verifique se a API está online.`
    );
  }

  if (codigo === "ETIMEDOUT" || codigo === "ECONNABORTED") {
    throw new Error(
      `A API demorou mais de ${TIMEOUT} ms para responder.`
    );
  }

  if (
    ultimoErro?.response?.status === 401 ||
    ultimoErro?.response?.status === 403
  ) {
    throw new Error(
      `Falha de autenticação na API: ${mensagemDoErro(ultimoErro)}`
    );
  }

  throw new Error(
    `Não foi possível fazer login na API: ${mensagemDoErro(ultimoErro)}`
  );
}

// ============================================================
// TOKEN
// ============================================================

async function getToken() {
  if (token) {
    return token;
  }

  if (!loginEmAndamento) {
    loginEmAndamento = login().finally(() => {
      loginEmAndamento = null;
    });
  }

  return loginEmAndamento;
}

function limparToken() {
  token = null;
}

// ============================================================
// CHAMADA À API
// ============================================================

async function api(method, endpoint, data = undefined, opcoes = {}) {
  const rota = String(endpoint || "").startsWith("/")
    ? endpoint
    : `/${endpoint}`;

  const executar = async () => {
    const accessToken = await getToken();

    const config = {
      method,
      url: `${API_URL}${rota}`,
      timeout: opcoes.timeout || TIMEOUT,
      headers: {
        Accept: "application/json",
        ...(data !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        Authorization: `Bearer ${accessToken}`,
        ...(opcoes.headers || {}),
      },
    };

    if (data !== undefined) {
      config.data = data;
    }

    // IMPORTANTE:
    // Retornamos somente response.data, e não o objeto completo
    // do Axios. Assim api.get("/produtos") retorna diretamente
    // o array de produtos.
    const resposta = await axios(config);

    return resposta.data;
  };

  try {
    return await executar();
  } catch (error) {
    if (error?.response?.status === 401) {
      console.warn("[auth] Token recusado pela API. Fazendo novo login...");
      limparToken();
      return await executar();
    }

    throw error;
  }
}

// ============================================================
// MÉTODOS PÚBLICOS
// ============================================================

async function get(endpoint, opcoes = {}) {
  return api("GET", endpoint, undefined, opcoes);
}

async function post(endpoint, data = {}, opcoes = {}) {
  return api("POST", endpoint, data, opcoes);
}

async function put(endpoint, data = {}, opcoes = {}) {
  return api("PUT", endpoint, data, opcoes);
}

async function patch(endpoint, data = {}, opcoes = {}) {
  return api("PATCH", endpoint, data, opcoes);
}

async function del(endpoint, opcoes = {}) {
  return api("DELETE", endpoint, undefined, opcoes);
}

// ============================================================
// TESTE DE CONEXÃO
// ============================================================

async function testarConexao() {
  try {
    const resposta = await axios.get(API_URL, {
      timeout: Math.min(TIMEOUT, 15000),
      validateStatus: () => true,
    });

    console.log(
      `[api] Conexão com ${API_URL} respondeu HTTP ${resposta.status}.`
    );

    return resposta;
  } catch (error) {
    console.error(
      `[api] Falha ao testar conexão com ${API_URL}:`,
      error?.code || error?.message || error
    );

    throw error;
  }
}

module.exports = {
  login,
  getToken,
  limparToken,
  testarConexao,
  get,
  post,
  put,
  patch,
  del,
};
