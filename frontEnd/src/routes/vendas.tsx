import { createFileRoute, Outlet, useMatchRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { HistoricoVendas } from "@/components/vendas/HistoricoVendas";
import { VendasLayout } from "@/components/vendas/VendasLayout";
import { resumirCobrancas } from "@/lib/cobrancas.functions";

export const Route = createFileRoute("/vendas")({
  component: VendasRoute,
});

function VendasRoute() {
  const matchRoute = useMatchRoute();
  const noHistorico = Boolean(matchRoute({ to: "/vendas", fuzzy: false }));
  const resumoQuery = useQuery({
    queryKey: ["vendas", "contador-receber"],
    queryFn: () => resumirCobrancas({}),
  });

  return (
    <AppShell>
      <VendasLayout
        pendentes={resumoQuery.data?.quantidadeCobrancas}
        atrasadas={resumoQuery.data?.quantidadeAtrasadas}
      >
        {noHistorico ? <HistoricoVendas /> : <Outlet />}
      </VendasLayout>
    </AppShell>
  );
}
