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

const emailRecuperacaoSchema = z.string().trim().email("Informe um e-mail válido.").max(160);
const codigoRecuperacaoSchema = z.string().regex(/^\d{6}$/, "Informe o código de 6 dígitos.");
const novaSenhaSchema = z
  .string()
  .min(6, "A nova senha deve ter ao menos 6 caracteres.")
  .max(72)
  .regex(/[A-Za-z]/, "A nova senha deve conter uma letra.")
  .regex(/\d/, "A nova senha deve conter um número.");

export type LoginResult =
  | (UserSession & { requiresPasswordChange: false; email: null })
  | {
      token: null;
      tokenType: null;
      expiresIn: 0;
      expiresAt: null;
      user: null;
      requiresPasswordChange: true;
      email: string;
    };

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

export async function solicitarRecuperacaoSenha(email: string): Promise<{ message: string }> {
  return apiRequest(
    "/auth/password-recovery/request",
    {
      method: "POST",
      body: JSON.stringify({ email: emailRecuperacaoSchema.parse(email) }),
    },
    { public: true },
  );
}

export async function verificarCodigoRecuperacao(
  email: string,
  code: string,
): Promise<{ recoveryToken: string; expiresAt: string }> {
  return apiRequest(
    "/auth/password-recovery/verify",
    {
      method: "POST",
      body: JSON.stringify({
        email: emailRecuperacaoSchema.parse(email),
        code: codigoRecuperacaoSchema.parse(code),
      }),
    },
    { public: true },
  );
}

export async function redefinirSenha(
  recoveryToken: string,
  newPassword: string,
  confirmPassword: string,
): Promise<{ message: string }> {
  return apiRequest(
    "/auth/password-recovery/reset",
    {
      method: "POST",
      body: JSON.stringify({
        recoveryToken,
        newPassword: novaSenhaSchema.parse(newPassword),
        confirmPassword,
      }),
    },
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

export async function atualizarMeuPerfil(data: {
  nome: string;
  senhaAtual?: string;
  novaSenha?: string;
}): Promise<User> {
  return apiRequest("/usuarios/me", {
    method: "PUT",
    body: JSON.stringify({
      nome: data.nome.trim(),
      senhaAtual: data.senhaAtual || null,
      novaSenha: data.novaSenha || null,
    }),
  });
}
