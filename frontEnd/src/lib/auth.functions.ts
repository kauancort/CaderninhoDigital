import { z } from "zod";
import { apiRequest } from "./api-client";
import type { UserSession, User } from "./user-session";

const credenciaisSchema = z.object({
  email: z.string().trim().email(),
  senha: z.string().min(1).max(72),
});

const primeiroAcessoSchema = z.object({
  email: z.string().trim().email(),
  senhaAtual: z.string().min(1).max(72),
  novaSenha: z
    .string()
    .min(6, "A nova senha deve ter ao menos 6 caracteres.")
    .max(72)
    .regex(/[A-Za-z]/, "A nova senha deve conter uma letra.")
    .regex(/\d/, "A nova senha deve conter um número."),
});

export type LoginResult = UserSession | { requiresPasswordChange: true; email: string };

export async function login({ data }: { data: unknown }): Promise<LoginResult> {
  return apiRequest<LoginResult>(
    "/auth/login",
    { method: "POST", body: JSON.stringify(credenciaisSchema.parse(data)) },
    { public: true },
  );
}

export async function primeiroAcesso({ data }: { data: unknown }): Promise<UserSession> {
  return apiRequest<UserSession>(
    "/auth/primeiro-acesso",
    { method: "POST", body: JSON.stringify(primeiroAcessoSchema.parse(data)) },
    { public: true },
  );
}

export async function obterBootstrapStatus(): Promise<{ available: boolean }> {
  return apiRequest("/auth/bootstrap-status", {}, { public: true });
}

export async function listarUsuarios(): Promise<User[]> {
  return apiRequest("/usuarios");
}

export async function criarUsuario(data: {
  nome: string;
  email: string;
  cargoFuncao: string;
  perfil: "GESTOR" | "FUNCIONARIO";
}): Promise<{ usuario: User; senhaTemporaria: string }> {
  return apiRequest("/usuarios", { method: "POST", body: JSON.stringify(data) });
}
