import { z } from "zod";
import { apiRequest } from "./api-client";

const conversaSchema = z.object({
  mensagem: z.string().trim().min(1).max(2000),
  historico: z
    .array(z.object({ autor: z.enum(["usuario", "assistente"]), texto: z.string().max(4000) }))
    .max(30),
});

export type MensagemConversa = z.infer<typeof conversaSchema>["historico"][number];

export async function conversarComAssistente(data: {
  mensagem: string;
  historico: MensagemConversa[];
}): Promise<{ resposta: string }> {
  return apiRequest("/assistente/conversa", {
    method: "POST",
    body: JSON.stringify(conversaSchema.parse(data)),
  });
}
