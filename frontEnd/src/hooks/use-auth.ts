import { useEffect, useState } from "react";

export type User = {
  usuarioId: number;
  nome: string;
  email: string;
  cargoFuncao: string;
  perfil: "GESTOR" | "FUNCIONARIO";
};

export type AuthState = {
  user: User | null;
  loading: boolean;
};

const authListeners = new Set<() => void>();

export function notifyAuthChange() {
  authListeners.forEach((l) => l());
  window.dispatchEvent(new Event("vovo:auth-change"));
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    function check() {
      const stored = localStorage.getItem("vovo_user");
      if (stored) {
        try {
          setState({ user: JSON.parse(stored), loading: false });
          return;
        } catch {
          localStorage.removeItem("vovo_user");
        }
      }
      setState({ user: null, loading: false });
    }
    check();
    authListeners.add(check);
    window.addEventListener("storage", check);
    window.addEventListener("vovo:auth-change", check);
    return () => {
      authListeners.delete(check);
      window.removeEventListener("storage", check);
      window.removeEventListener("vovo:auth-change", check);
    };
  }, []);

  return state;
}
