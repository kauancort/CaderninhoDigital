import { createApiFn } from "@/lib/api-function";
import { API_URL as BASE_URL, apiFetch as fetch } from "@/lib/api-client";
import { z } from "zod";
export const registrarCompra = createApiFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        materia_prima_id: z.union([z.string(), z.number()]),
        quantidade: z.number().positive(),
        valor_total: z.number().min(0),
        data_compra: z.string().date(),
        forma_pagamento: z.enum(["DINHEIRO", "PIX", "CARTAO", "BOLETO", "OUTRO"]).nullable(),
        status_pagamento: z.enum(["PAGO", "PENDENTE", "ATRASADO", "NAO_SE_APLICA"]),
        observacao: z.string().max(1000).optional().nullable(),
        fornecedor: z.string().max(120).optional().nullable(),
        categoria: z.enum([
          "materia-prima",
          "embalagens",
          "energia",
          "aluguel",
          "transporte",
          "outros",
        ]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    let fornecedorId: number | null = null;

    if (data.fornecedor && data.fornecedor.trim().length > 0) {
      const fornecedorNome = data.fornecedor.trim();
      // Fetch suppliers to match fornecedor by name
      const suppliersRes = await fetch(`${BASE_URL}/fornecedores`, {});
      if (suppliersRes.ok) {
        const suppliers = await suppliersRes.json();
        const matched = suppliers.find(
          (s: any) => s.nome.toLowerCase() === fornecedorNome.toLowerCase(),
        );
        if (matched) {
          fornecedorId = matched.id;
        } else {
          // Create supplier if not found
          const createRes = await fetch(`${BASE_URL}/fornecedores`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              nome: fornecedorNome,
              ativo: true,
            }),
          });
          if (createRes.ok) {
            const newSupplier = await createRes.json();
            fornecedorId = newSupplier.id;
          }
        }
      }
    }

    const valorUnitario =
      data.quantidade > 0 ? data.valor_total / data.quantidade : data.valor_total;

    const payload = {
      fornecedorId: fornecedorId,
      dataCompra: data.data_compra,
      formaPagamento: data.forma_pagamento,
      statusPagamento: data.status_pagamento,
      observacao: data.observacao || `Categoria: ${data.categoria}`,
      itens: [
        {
          materiaPrimaId: Number(data.materia_prima_id),
          quantidade: data.quantidade,
          valorUnitario: valorUnitario,
        },
      ],
    };

    const res = await fetch(`${BASE_URL}/compras-materias-primas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Erro ao registrar compra" }));
      throw new Error(err.message || "Erro ao registrar compra");
    }

    return { ok: true };
  });
