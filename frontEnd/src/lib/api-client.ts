import { clearUserSession, getUserSession } from "./user-session";

const LOCAL_API_URL = "http://localhost:8080/api/v1";
const RENDER_API_URL = "https://caderninho-digital-api.onrender.com/api/v1";
const configuredApiUrl = import.meta.env.VITE_API_URL;
const isLocalApiUrl = configuredApiUrl?.startsWith("http://localhost");
const DEFAULT_API_URL = import.meta.env.PROD ? RENDER_API_URL : LOCAL_API_URL;

export const API_URL = (
  import.meta.env.PROD && isLocalApiUrl ? RENDER_API_URL : configuredApiUrl || DEFAULT_API_URL
).replace(/\/$/, "");

type ApiErrorBody = {
  message?: string;
  mensagem?: string;
  error?: string;
  code?: string;
  correlationId?: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly correlationId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function authHeaders(headers: Headers, publicRequest: boolean) {
  headers.set("Accept", "application/json");
  if (!publicRequest) {
    const session = getUserSession();
    if (!session) throw new Error("Sessão expirada. Entre novamente.");
    headers.set("Authorization", `${session.tokenType} ${session.token}`);
  }
}

async function handleAuthError(response: Response) {
  if (response.status === 401) {
    clearUserSession();
    if (window.location.pathname !== "/login") window.location.replace("/login");
    throw new Error("Sessão expirada. Entre novamente.");
  }
  if (response.status === 403) {
    const body = (await response
      .clone()
      .json()
      .catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(
      body?.message ?? "Você não possui permissão para esta operação.",
      403,
      body?.code,
      body?.correlationId,
    );
  }
}

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  authHeaders(headers, false);
  if (init.body && !(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const response = await fetch(input, { ...init, headers });
  await handleAuthError(response);
  return response;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  options: { public?: boolean } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  authHeaders(headers, options.public === true);
  if (init.body && !(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw new ApiError("A consulta excedeu o tempo de espera.", 504, "TIMEOUT");
    throw new Error("Não foi possível conectar ao servidor. Verifique se a API está ativa.");
  }
  await handleAuthError(response);
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = body as ApiErrorBody | null;
    throw new ApiError(
      error?.message ??
        error?.mensagem ??
        error?.error ??
        `Erro na requisição (${response.status}).`,
      response.status,
      error?.code,
      error?.correlationId,
    );
  }
  return body as T;
}
