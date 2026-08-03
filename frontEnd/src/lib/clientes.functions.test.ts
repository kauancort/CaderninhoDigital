import { describe, expect, it } from "vitest";
import { clientePayload } from "./clientes.functions";

describe("payload de cliente", () => {
  it("envia os novos campos sem converter inscrição estadual em número", () => {
    const payload = clientePayload({
      nome: "Empresa",
      telefone: "(11) 99999-9999",
      email: "empresa@email.com",
      endereco: "Rua A",
      numero: "001",
      complemento: "Fundos",
      documento: "00.000.000/0001-00",
      cep: "12345678",
      bairro: "Centro",
      inscricaoEstadual: "00123-X",
    });
    expect(payload).toMatchObject({
      cep: "12345678",
      bairro: "Centro",
      inscricaoEstadual: "00123-X",
      numero: "001",
      complemento: "Fundos",
    });
  });

  it("mantém os campos opcionais nulos", () => {
    const payload = clientePayload({
      nome: "Pessoa",
      telefone: "(11) 99999-9999",
      email: "pessoa@email.com",
      endereco: "",
      numero: "",
      complemento: "",
      documento: "",
      cep: "",
      bairro: "",
      inscricaoEstadual: "",
    });
    expect(payload).toMatchObject({
      cep: null,
      bairro: null,
      inscricaoEstadual: null,
      numero: null,
      complemento: null,
    });
  });
});
