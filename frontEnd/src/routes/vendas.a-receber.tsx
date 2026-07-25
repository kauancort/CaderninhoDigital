import { createFileRoute } from "@tanstack/react-router";
import { AReceber } from "@/components/vendas/AReceber";

export const Route = createFileRoute("/vendas/a-receber")({
  component: AReceber,
});
