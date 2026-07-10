// Bridge: passa os dados parseados pela voz para os formulários existentes via sessionStorage.
import type { VozResultado } from "./voz.functions";

const KEYS = {
  venda: "voz:prefill:venda",
  compra: "voz:prefill:compra",
  producao: "voz:prefill:producao",
  gasto: "voz:prefill:gasto",
} as const;

export type PrefillVenda = NonNullable<VozResultado["venda"]>;
export type PrefillCompra = NonNullable<VozResultado["compras"]>[number];
export type PrefillProducao = NonNullable<VozResultado["producao"]>;
export type PrefillGasto = NonNullable<VozResultado["gasto"]>;

export function setPrefill<K extends keyof typeof KEYS>(tipo: K, data: unknown) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEYS[tipo], JSON.stringify(data));
}

export function consumePrefill<T = unknown>(tipo: keyof typeof KEYS): T | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(KEYS[tipo]);
  if (!raw) return null;
  sessionStorage.removeItem(KEYS[tipo]);
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
