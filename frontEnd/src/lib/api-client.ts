export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8080/api/v1").replace(
  /\/$/,
  "",
);

type ApiErrorBody = {
  message?: string;
  mensagem?: string;
  error?: string;
};

export function getUsuarioId(): number {
  const raw = localStorage.getItem("vovo_user");
  if (!raw) throw new Error("Sessão expirada. Entre novamente.");

  try {
    const id = Number(JSON.parse(raw).usuarioId);
    if (!Number.isInteger(id) || id <= 0) throw new Error();
    return id;
  } catch {
    localStorage.removeItem("vovo_user");
    throw new Error("Sessão inválida. Entre novamente.");
  }
}

export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("X-Usuario-Id", String(getUsuarioId()));
  if (init.body && !(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");

  return fetch(input, { ...init, headers, credentials: "include" });
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  options: { public?: boolean } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Compatibilidade temporária. O Spring Boot deve validar uma sessão/JWT e nunca
  // confiar neste identificador como mecanismo de autorização.
  if (!options.public) headers.set("X-Usuario-Id", String(getUsuarioId()));

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });
  } catch {
    throw new Error("Não foi possível conectar ao servidor. Verifique se a API está ativa.");
  }

  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem("vovo_user");
    window.dispatchEvent(new Event("vovo:auth-change"));
    throw new Error("Sessão expirada. Entre novamente.");
  }

  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = body as ApiErrorBody | null;
    throw new Error(
      error?.message ??
        error?.mensagem ??
        error?.error ??
        `Erro na requisição (${response.status}).`,
    );
  }

  return body as T;
}
