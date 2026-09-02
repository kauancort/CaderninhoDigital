import { describe, expect, it } from "vitest";
import { clienteSchema } from "./clientes.functions";

const valido = {
  nome: "Maria",
  telefone: "(11) 99999-9999",
  email: "",
  documento: "52998224725",
  endereco: "Rua A",
  numero: "10",
  complemento: "",
  cep: "",
  bairro: "Centro",
  cidade: "São Paulo",
  estado: "SP",
  inscricaoEstadual: "",
};

describe("validação do cliente", () => {
  it("aceita cliente sem e-mail e com e-mail válido", () => {
    expect(clienteSchema.safeParse(valido).success).toBe(true);
    expect(clienteSchema.safeParse({ ...valido, email: "maria@email.com" }).success).toBe(true);
  });

  it("aceita transportadora somente com nome", () => {
    expect(clienteSchema.safeParse({ nome: "Jadlog", tipo: "TRANSPORTADORA" }).success).toBe(true);
  });

  it("rejeita e-mail inválido quando preenchido", () => {
    expect(clienteSchema.safeParse({ ...valido, email: "email-invalido" }).success).toBe(false);
  });

  it.each(["nome", "telefone", "documento", "endereco", "numero", "bairro", "cidade", "estado"])(
    "rejeita ausência do campo %s",
    (campo) => expect(clienteSchema.safeParse({ ...valido, [campo]: "" }).success).toBe(false),
  );

  it("rejeita CEP incompleto quando preenchido", () => {
    expect(clienteSchema.safeParse({ ...valido, cep: "1234567" }).success).toBe(false);
  });

  it("rejeita uma sigla de estado inexistente", () => {
    expect(clienteSchema.safeParse({ ...valido, estado: "XX" }).success).toBe(false);
  });
});
