import { z } from "zod";
import { apiRequest } from "./api-client";

const CatalogoItem = z.object({ id: z.union([z.string(), z.number()]), nome: z.string() });
const InterpretarInput = z.object({
  audioBase64: z.string().min(1),
  mime: z.string().min(1),
  produtos: z.array(CatalogoItem).default([]),
  materiasPrimas: z.array(CatalogoItem).default([]),
  conversaPrevia: z.string().optional().nullable(),
});

export type VozTipo = "venda" | "compra" | "producao" | "gasto" | "desconhecido";
export type ItemVendaParsed = {
  produto_final_id: string | null;
  produto_nome: string | null;
  quantidade: number;
  tipo: "pote" | "caixa";
  preco_unitario: number | null;
};
export type CompraParsed = {
  materia_prima_id: string | null;
  produto_nome: string | null;
  quantidade: number;
  unidade: string;
  valor_total: number | null;
  categoria: "materia-prima" | "embalagens";
  fornecedor: string | null;
};
export type ProducaoParsed = {
  produto_final_id: string | null;
  produto_nome: string | null;
  potes: number | null;
  unidade: 22 | 44 | null;
  observacoes: string | null;
};
export type GastoParsed = {
  descricao: string;
  categoria: "materia-prima" | "embalagens" | "energia" | "aluguel" | "transporte" | "outros";
  valor: number | null;
};
export type VozResultado = {
  transcricao: string;
  tipo: VozTipo;
  faltando: string[];
  perguntaProximo: string | null;
  venda?: {
    itens: ItemVendaParsed[];
    comprador: string | null;
    forma_pagamento: "dinheiro" | "pix" | "cartao";
  };
  compras?: CompraParsed[];
  producao?: ProducaoParsed;
  gasto?: GastoParsed;
};

// A chave do provedor de IA deve existir somente no Spring Boot.
export async function interpretarVoz({ data }: { data: unknown }): Promise<VozResultado> {
  return apiRequest<VozResultado>("/assistente/interpretar-voz", {
    method: "POST",
    body: JSON.stringify(InterpretarInput.parse(data)),
  });
}
