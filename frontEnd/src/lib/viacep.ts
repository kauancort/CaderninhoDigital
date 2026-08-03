export type EnderecoViaCep = {
  cep: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
};

type ViaCepBody = {
  erro?: boolean;
  cep?: unknown;
  logradouro?: unknown;
  bairro?: unknown;
  localidade?: unknown;
  uf?: unknown;
};

export function apenasDigitosCep(valor: string) {
  return valor.replace(/\D/g, "").slice(0, 8);
}

export function mascararCep(valor: string) {
  const cep = apenasDigitosCep(valor);
  return cep.length <= 5 ? cep : `${cep.slice(0, 5)}-${cep.slice(5)}`;
}

export async function consultarCep(
  valor: string,
  signal?: AbortSignal,
): Promise<EnderecoViaCep | null> {
  const cep = apenasDigitosCep(valor);
  if (cep.length !== 8) return null;

  const timeout = new AbortController();
  const timer = globalThis.setTimeout(() => timeout.abort(), 8_000);
  const abort = () => timeout.abort();
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: timeout.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("ViaCEP indisponível");
    const body = (await response.json()) as ViaCepBody;
    if (body.erro === true) return null;
    if (
      typeof body.cep !== "string" ||
      apenasDigitosCep(body.cep) !== cep ||
      typeof body.logradouro !== "string" ||
      typeof body.bairro !== "string" ||
      typeof body.localidade !== "string" ||
      typeof body.uf !== "string" ||
      !/^[A-Z]{2}$/.test(body.uf)
    ) {
      throw new Error("Resposta inválida do ViaCEP");
    }
    return {
      cep,
      endereco: body.logradouro,
      bairro: body.bairro,
      cidade: body.localidade,
      estado: body.uf,
    };
  } finally {
    globalThis.clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
