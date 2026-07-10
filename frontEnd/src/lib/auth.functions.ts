import { z } from "zod";
import { apiRequest } from "./api-client";
import type { User } from "@/hooks/use-auth";

const credenciaisSchema = z.object({
  email: z.string().trim().email(),
  senha: z.string().regex(/^\d{3}$/, "A senha deve conter exatamente 3 dígitos."),
});

const cadastroSchema = credenciaisSchema.extend({
  nome: z.string().trim().min(1).max(120),
  cargoFuncao: z.string().trim().min(1).max(80),
  perfil: z.enum(["GESTOR", "FUNCIONARIO"]),
});

export async function login({ data }: { data: unknown }): Promise<User> {
  return apiRequest<User>(
    "/auth/login",
    { method: "POST", body: JSON.stringify(credenciaisSchema.parse(data)) },
    { public: true },
  );
}

export async function cadastro({ data }: { data: unknown }): Promise<void> {
  await apiRequest(
    "/auth/cadastro",
    { method: "POST", body: JSON.stringify(cadastroSchema.parse(data)) },
    { public: true },
  );
}

export async function logout(): Promise<void> {
  await apiRequest("/auth/logout", { method: "POST" }).catch(() => undefined);
}
