import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  redirect,
  useRouter,
} from "@tanstack/react-router";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import voCidaImg from "@/assets/vo-cida.png";
import { getUserSession } from "@/lib/user-session";
import { Toaster } from "@/components/ui/sonner";

function SystemPage({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-card text-center shadow-warm-md">
        <div className="vovo-gradient px-6 py-8">
          <img
            src={voCidaImg}
            alt=""
            className="mx-auto h-20 w-20 rounded-full bg-card object-contain shadow-warm-sm"
          />
          <p className="mt-3 font-display text-lg font-bold text-primary">Doces da Vó Cida</p>
        </div>
        <div className="px-6 py-8">{children}</div>
      </section>
    </main>
  );
}

function NotFoundComponent() {
  return (
    <SystemPage>
      <div className="font-display text-6xl font-bold text-gold-dark">404</div>
      <h1 className="mt-3 font-display text-2xl font-bold text-foreground">
        Página não encontrada
      </h1>
      <p className="mt-2 text-sm text-muted-foreground font-body">
        Este endereço não existe ou foi movido para outro lugar do caderninho.
      </p>
      <div className="mt-6 flex justify-center">
        <Link
          to="/"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-dark"
        >
          <Home size={16} /> Voltar ao painel
        </Link>
      </div>
    </SystemPage>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <SystemPage>
      <AlertTriangle className="mx-auto text-error" size={34} aria-hidden="true" />
      <h1 className="mt-3 font-display text-2xl font-bold text-foreground">
        Não foi possível carregar esta página
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Tivemos um problema inesperado. Você pode tentar novamente ou voltar ao painel.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-dark"
        >
          <RefreshCw size={16} /> Tentar novamente
        </button>
        <a
          href="/"
          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <Home size={16} /> Voltar ao painel
        </a>
      </div>
    </SystemPage>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: ({ location }) => {
    const session = getUserSession();
    if (location.pathname !== "/login" && !session) throw redirect({ to: "/login" });
    if (location.pathname === "/login" && session) throw redirect({ to: "/" });
  },
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
