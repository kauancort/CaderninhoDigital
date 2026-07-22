import { useEffect, useState } from "react";
import { clearUserSession, getUserSession, type User } from "@/lib/user-session";

export type { User } from "@/lib/user-session";
export type AuthState = { user: User | null; loading: boolean };

export function notifyAuthChange() {
  window.dispatchEvent(new Event("user-session-changed"));
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    let expirationTimer: number | undefined;
    function check() {
      if (expirationTimer) window.clearTimeout(expirationTimer);
      const session = getUserSession();
      setState({ user: session?.user ?? null, loading: false });
      if (session) {
        const remaining = Date.parse(session.expiresAt) - Date.now();
        expirationTimer = window.setTimeout(
          () => {
            clearUserSession();
            if (window.location.pathname !== "/login") window.location.assign("/login");
          },
          Math.min(remaining, 2_147_483_647),
        );
      }
    }
    check();
    window.addEventListener("storage", check);
    window.addEventListener("user-session-changed", check);
    return () => {
      if (expirationTimer) window.clearTimeout(expirationTimer);
      window.removeEventListener("storage", check);
      window.removeEventListener("user-session-changed", check);
    };
  }, []);

  return state;
}
