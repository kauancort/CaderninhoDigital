import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("endereço da API", () => {
  it("usa o proxy local para permitir acesso pelo celular", async () => {
    vi.stubEnv("PROD", false);
    vi.stubEnv("VITE_API_URL", "");
    expect((await import("./api-client")).API_URL).toBe("/api/v1");
  });

  it("converte uma configuração antiga de localhost para o proxy no desenvolvimento", async () => {
    vi.stubEnv("PROD", false);
    vi.stubEnv("VITE_API_URL", "http://localhost:8080/api/v1");
    expect((await import("./api-client")).API_URL).toBe("/api/v1");
  });

  it.each(["", "/api/v1", "http://localhost:8080/api/v1"])(
    "mantém a API de produção com configuração local %s",
    async (url) => {
      vi.stubEnv("PROD", true);
      vi.stubEnv("VITE_API_URL", url);
      expect((await import("./api-client")).API_URL).toBe(
        "https://caderninho-digital-api.onrender.com/api/v1",
      );
    },
  );

  it("respeita um servidor explicitamente configurado", async () => {
    vi.stubEnv("PROD", true);
    vi.stubEnv("VITE_API_URL", "https://api.example.com/api/v1/");
    expect((await import("./api-client")).API_URL).toBe("https://api.example.com/api/v1");
  });
});
