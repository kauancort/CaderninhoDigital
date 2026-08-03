import { describe, expect, it } from "vitest";
import { decideAuthRoute, sanitizeRedirect } from "./auth-routing";

describe("proteção central das rotas", () => {
  it("envia usuário sem sessão de rota protegida ou desconhecida ao login", () => {
    expect(decideAuthRoute("/clientes", false)).toBe("login");
    expect(decideAuthRoute("/rota-inexistente", false)).toBe("login");
  });

  it("envia usuário autenticado que abre login para o painel", () => {
    expect(decideAuthRoute("/login", true)).toBe("home");
  });

  it("permite rota protegida e deixa o not-found tratar rota desconhecida autenticada", () => {
    expect(decideAuthRoute("/clientes", true)).toBe("allow");
    expect(decideAuthRoute("/rota-inexistente", true)).toBe("allow");
  });
});

describe("retorno após o login", () => {
  it("aceita apenas caminhos internos", () => {
    expect(sanitizeRedirect("/clientes?pagina=2")).toBe("/clientes?pagina=2");
    expect(sanitizeRedirect("https://site-malicioso.test")).toBeUndefined();
    expect(sanitizeRedirect("//site-malicioso.test")).toBeUndefined();
  });
});
