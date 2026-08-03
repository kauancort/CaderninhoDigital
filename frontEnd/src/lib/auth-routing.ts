export type AuthRouteDecision = "allow" | "login" | "home";

export function decideAuthRoute(pathname: string, hasSession: boolean): AuthRouteDecision {
  if (!hasSession && pathname !== "/login") return "login";
  if (hasSession && pathname === "/login") return "home";
  return "allow";
}

export function sanitizeRedirect(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return undefined;
  }
  return value;
}
