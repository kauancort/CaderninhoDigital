export const USER_SESSION_KEY = "userSession";
const LEGACY_SESSION_KEY = "vovo_user";

export type User = {
  id: number;
  nome: string;
  email: string;
  cargoFuncao: string;
  perfil: "GESTOR" | "FUNCIONARIO";
};

export type UserSession = {
  token: string;
  tokenType: "Bearer";
  expiresIn: number;
  expiresAt: string;
  user: User;
};

function notify() {
  window.dispatchEvent(new Event("user-session-changed"));
}

export function getUserSession(): UserSession | null {
  localStorage.removeItem(LEGACY_SESSION_KEY);
  const raw = localStorage.getItem(USER_SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as UserSession;
    const valid =
      typeof session.token === "string" &&
      session.token.length > 0 &&
      session.tokenType === "Bearer" &&
      Number.isFinite(Date.parse(session.expiresAt)) &&
      Date.parse(session.expiresAt) > Date.now() &&
      Number.isInteger(session.user?.id) &&
      session.user.id > 0;
    if (!valid) throw new Error("invalid session");
    return session;
  } catch {
    clearUserSession();
    return null;
  }
}

export function saveUserSession(session: UserSession) {
  localStorage.setItem(USER_SESSION_KEY, JSON.stringify(session));
  localStorage.removeItem(LEGACY_SESSION_KEY);
  notify();
}

export function clearUserSession() {
  localStorage.removeItem(USER_SESSION_KEY);
  localStorage.removeItem(LEGACY_SESSION_KEY);
  notify();
}
