import { describe, expect, it } from "vitest";
import { validarCnpj, validarCpf } from "./documento-fiscal";

describe("documentos fiscais", () => {
  it("aceita CPF e CNPJ válidos com ou sem máscara", () => {
    expect(validarCpf("529.982.247-25")).toBe(true);
    expect(validarCnpj("11.222.333/0001-81")).toBe(true);
  });

  it("rejeita documentos inválidos e sequências repetidas", () => {
    expect(validarCpf("111.111.111-11")).toBe(false);
    expect(validarCpf("529.982.247-24")).toBe(false);
    expect(validarCnpj("11.222.333/0001-82")).toBe(false);
  });
});
