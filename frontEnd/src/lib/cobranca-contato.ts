import { fmtBRL } from "@/lib/format";

export type DadosMensagemCobranca = {
  clienteNome: string;
  dataVencimento: string;
  valor: number;
};

export type TomMensagemCobranca = "padrao" | "formal";

export function formatarDataCobranca(dataIso: string) {
  const [ano, mes, dia] = dataIso.split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : dataIso;
}

export function criarMensagemCobranca(
  dados: DadosMensagemCobranca,
  tom: TomMensagemCobranca = "padrao",
) {
  const nome = dados.clienteNome.trim();
  const vencimento = formatarDataCobranca(dados.dataVencimento);
  const valor = fmtBRL(dados.valor);
  const mensagem =
    tom === "formal"
      ? `Olá, ${nome}. Gostaria de tratar sobre a parcela com vencimento em ${vencimento}, no valor de ${valor}.`
      : `Olá, ${nome}. Estou entrando em contato sobre uma parcela com vencimento em ${vencimento}, no valor de ${valor}.`;
  return mensagem.replace(/\s+/g, " ").trim();
}

export function normalizarTelefoneWhatsApp(telefone: string | null | undefined) {
  const digitos = telefone?.replace(/\D/g, "") ?? "";
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  if (digitos.startsWith("55") && (digitos.length === 12 || digitos.length === 13)) return digitos;
  return digitos.length >= 8 && digitos.length <= 15 ? digitos : null;
}

export function criarLinkWhatsApp(
  telefone: string | null | undefined,
  dados: DadosMensagemCobranca,
) {
  const numero = normalizarTelefoneWhatsApp(telefone);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(criarMensagemCobranca(dados))}`;
}

export function criarLinkEmail(email: string, dados: DadosMensagemCobranca) {
  const assunto = "Cobrança de parcela";
  const corpo = criarMensagemCobranca(dados, "formal");
  return `mailto:${email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
}
