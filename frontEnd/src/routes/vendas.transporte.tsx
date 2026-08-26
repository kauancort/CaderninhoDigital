import { createFileRoute } from "@tanstack/react-router";

import { TransporteVendas } from "@/components/vendas/TransporteVendas";

export const Route = createFileRoute("/vendas/transporte")({
  component: TransporteVendas,
});