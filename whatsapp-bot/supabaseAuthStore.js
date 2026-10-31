
const axios = require("axios");
const pino = require("pino");

const SESSION_ID = process.env.WHATSAPP_SESSION_ID || "caderninho-whatsapp";
const TABLE = process.env.SUPABASE_AUTH_TABLE || "whatsapp_auth";

// Logger usado pelo mecanismo oficial de transações do Baileys.
const transactionLogger = pino({ level: "silent" });

function obterConfiguracao() {
  const url = String(process.env.SUPABASE_URL || "")
    .trim()
    .replace(/\/+$/, "");

  const key = String(
    process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      ""
  ).trim();

  if (!url || !key) {
    throw new Error(
      "Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SECRET_KEY) nas variáveis privadas."
    );
  }

  return {
    url: `${url}/rest/v1/${TABLE}`,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  };
}

// Serializa Buffer e Uint8Array sem perder os bytes.
function replacer(_key, value) {
  if (Buffer.isBuffer(value)) {
    return {
      type: "Buffer",
      data: value.toString("base64"),
    };
  }

  if (value instanceof Uint8Array) {
    return {
      type: "Buffer",
      data: Buffer.from(value).toString("base64"),
    };
  }

  // Buffer.toJSON() pode ser executado antes do replacer.
  if (value && value.type === "Buffer" && Array.isArray(value.data)) {
    return {
      type: "Buffer",
      data: Buffer.from(value.data).toString("base64"),
    };
  }

  return value;
}

function reviver(_key, value) {
  if (!value || value.type !== "Buffer") {
    return value;
  }

  if (typeof value.data === "string") {
    return Buffer.from(value.data, "base64");
  }

  if (Array.isArray(value.data)) {
    return Buffer.from(value.data);
  }

  return value;
}

function clonarParaBanco(valor) {
  return JSON.parse(JSON.stringify(valor, replacer));
}

function restaurarDoBanco(valor) {
  if (valor === null || valor === undefined) {
    return valor;
  }

  return JSON.parse(JSON.stringify(valor), reviver);
}

async function criarEstadoAutenticacao({
  initAuthCreds,
  proto,
  addTransactionCapability,
}) {
  if (typeof addTransactionCapability !== "function") {
    throw new Error(
      "A função addTransactionCapability não foi recebida do Baileys. Verifique a importação no bot.js."
    );
  }

  const config = obterConfiguracao();

  console.log(`[AUTH] Buscando sessão '${SESSION_ID}' no Supabase...`);

  const consulta = await axios.get(config.url, {
    params: {
      id: `eq.${SESSION_ID}`,
      select: "auth_data",
      limit: 1,
    },
    headers: config.headers,
    timeout: 20000,
  });

  const registro = Array.isArray(consulta.data) ? consulta.data[0] : null;
  const dadosSalvos = registro?.auth_data || null;

  const creds = dadosSalvos?.creds
    ? restaurarDoBanco(dadosSalvos.creds)
    : initAuthCreds();

  // Mantém todas as categorias de chaves, inclusive as do Baileys v7:
  // lid-mapping, device-list, tctoken, pre-key, session etc.
  const keyData = dadosSalvos?.keys
    ? restaurarDoBanco(dadosSalvos.keys)
    : {};

  // Serializa as gravações no Supabase para evitar que requisições
  // simultâneas sobrescrevam uma versão mais recente da sessão.
  let filaDeGravacao = Promise.resolve();

  async function persistir() {
    const authData = clonarParaBanco({
      creds,
      keys: keyData,
    });

    const gravacao = filaDeGravacao
      .catch(() => {
        // Permite que a fila continue após uma falha anterior.
      })
      .then(async () => {
        await axios.post(
          config.url,
          {
            id: SESSION_ID,
            auth_data: authData,
            updated_at: new Date().toISOString(),
          },
          {
            params: {
              on_conflict: "id",
            },
            headers: {
              ...config.headers,
              Prefer: "resolution=merge-duplicates,return=minimal",
            },
            timeout: 20000,
          }
        );
      });

    filaDeGravacao = gravacao;
    return gravacao;
  }

  // Este é o armazenamento-base. O addTransactionCapability do Baileys
  // será aplicado abaixo, envolvendo este get/set com transações reais.
  const keysBase = {
    get: async (type, ids) => {
      const resultado = {};

      for (const id of ids) {
        let value = keyData[type]?.[id] ?? null;

        // O Baileys v7 espera o objeto protobuf AppStateSyncKeyData.
        if (value && type === "app-state-sync-key") {
          const tipoProto = proto?.Message?.AppStateSyncKeyData;

          if (tipoProto?.create) {
            value = tipoProto.create(value);
          }
        }

        resultado[id] = value;
      }

      return resultado;
    },

    set: async (data) => {
      for (const [categoria, itens] of Object.entries(data || {})) {
        if (!keyData[categoria]) {
          keyData[categoria] = {};
        }

        for (const [id, value] of Object.entries(itens || {})) {
          if (value === null || value === undefined) {
            delete keyData[categoria][id];
          } else {
            keyData[categoria][id] = value;
          }
        }

        if (Object.keys(keyData[categoria]).length === 0) {
          delete keyData[categoria];
        }
      }

      // Persiste antes de retornar, como exige o contrato do SignalKeyStore.
      await persistir();
    },
  };

  // Implementação oficial do Baileys para transações Signal.
  // Ela controla concorrência, contexto assíncrono e operações especiais
  // de PreKeys; não substitua por uma flag booleana manual.
  const keys = addTransactionCapability(
    keysBase,
    transactionLogger,
    {
      maxCommitRetries: 10,
      delayBetweenTriesMs: 3000,
    }
  );

  const state = {
    creds,
    keys,
  };

  console.log(
    dadosSalvos
      ? "[AUTH] Sessão encontrada. Tentando restaurar sem novo QR Code."
      : "[AUTH] Nenhuma sessão salva. O primeiro acesso exibirá um QR Code."
  );

  return {
    state,
    saveCreds: persistir,
    persistir,
  };
}

module.exports = {
  criarEstadoAutenticacao,
};
