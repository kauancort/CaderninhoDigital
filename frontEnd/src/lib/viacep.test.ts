import { afterEach, describe, expect, it, vi } from "vitest";
import { apenasDigitosCep, consultarCep, mascararCep } from "./viacep";

describe("ViaCEP", () => {
  afterEach(() => vi.restoreAllMocks());

  it("mascara e remove caracteres não numéricos", () => {
    expect(mascararCep("12.345-6789")).toBe("12345-678");
    expect(apenasDigitosCep("12345-678")).toBe("12345678");
  });

  it("não consulta CEP incompleto", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await expect(consultarCep("12345-67")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aceita CEP mascarado e valida a resposta", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          cep: "12345-678",
          logradouro: "Rua A",
          bairro: "Centro",
          localidade: "São Paulo",
          uf: "SP",
        }),
        { status: 200 },
      ),
    );
    await expect(consultarCep("12345-678")).resolves.toEqual({
      cep: "12345678",
      endereco: "Rua A",
      bairro: "Centro",
      cidade: "São Paulo",
      estado: "SP",
    });
  });

  it("trata CEP inexistente sem lançar erro", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ erro: true }), { status: 200 }),
    );
    await expect(consultarCep("12345678")).resolves.toBeNull();
  });

  it("propaga falha de rede para tratamento amigável da tela", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
    await expect(consultarCep("12345678")).rejects.toThrow("offline");
  });

  it("cancela uma consulta antiga", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Abortado", "AbortError")),
          );
        }),
    );
    const controller = new AbortController();
    const consulta = consultarCep("12345678", controller.signal);
    controller.abort();
    await expect(consulta).rejects.toMatchObject({ name: "AbortError" });
  });
});
