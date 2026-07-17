import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  PlusCircle,
  Package,
  Wallet,
  Cookie,
  Sparkles,
  ReceiptText,
  Users,
  LogOut,
  MoreHorizontal,
  HandCoins,
} from "lucide-react";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { listarMateriaPrima } from "@/lib/catalogo.functions";
import { logout } from "@/lib/auth.functions";
import { AssistenteVoz } from "@/components/AssistenteVoz";
import { AssistenteChat } from "@/components/AssistenteChat";
import voCidaImg from "@/assets/vo-cida.png";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type Item = {
  to:
    | "/"
    | "/registrar"
    | "/vendas"
    | "/a-receber"
    | "/estoque"
    | "/producao"
    | "/gastos"
    | "/clientes";

  icon: typeof LayoutDashboard;
  label: string;
  badge?: number;
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [chatAberto, setChatAberto] = useState(false);
  const [vozAberta, setVozAberta] = useState(false);
  const [maisAberto, setMaisAberto] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const { data: mp = [] } = useQuery({
    queryKey: ["materia_prima"],
    queryFn: () => listarMateriaPrima(),
    enabled: !!user,
  });

  const baixos = mp.filter(
    (i: any) => Number(i.quantidade_estoque) <= Number(i.estoque_minimo),
  ).length;

  const items: Item[] = [
    { to: "/", icon: LayoutDashboard, label: "Painel" },
    { to: "/registrar", icon: PlusCircle, label: "Registrar" },
    { to: "/vendas", icon: ReceiptText, label: "Vendas" },
    { to: "/a-receber", icon: HandCoins, label: "A receber" },
    { to: "/clientes", icon: Users, label: "Clientes" },
    { to: "/estoque", icon: Package, label: "Estoque", badge: baixos || undefined },
    { to: "/producao", icon: Cookie, label: "Produção" },
    { to: "/gastos", icon: Wallet, label: "Gastos" },
  ];

  const mobileItems = items.filter((i) =>
    ["/", "/registrar", "/estoque", "/producao"].includes(i.to),
  );
  const moreItems = items.filter((i) =>
    ["/vendas", "/a-receber", "/clientes", "/gastos"].includes(i.to),
  );

  function itemAtivo(to: Item["to"]) {
    if (to === "/") return location.pathname === "/";
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  }

  const moreActive = moreItems.some((item) => itemAtivo(item.to));

  async function sair() {
    await logout();
    localStorage.removeItem("vovo_user");
    navigate({ to: "/login" });
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground font-body">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden md:flex w-60 flex-col bg-sidebar border-r border-sidebar-border">
        <div className="px-6 py-6 border-b border-sidebar-border flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-card overflow-hidden shrink-0 flex items-center justify-center">
            <img src={voCidaImg} alt="Doces da Vó Cida" className="w-full h-full object-contain" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-primary text-sm">Doces da Vó Cida</div>
            <div className="text-xs text-muted-foreground truncate max-w-[140px]">{user.email}</div>
          </div>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto">
          {items.map((it) => {
            const active = itemAtivo(it.to);
            const Icon = it.icon;
            return (
              <Link
                key={it.to}
                to={it.to}
                className={[
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm mb-1 transition-colors",
                  active
                    ? "bg-white text-primary font-semibold border border-border shadow-warm-sm"
                    : "text-sidebar-foreground hover:bg-white/40 hover:text-foreground",
                ].join(" ")}
              >
                <Icon size={18} />
                <span>{it.label}</span>
                {it.badge ? (
                  <span className="ml-auto bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {it.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 p-3 border-t border-sidebar-border space-y-2">
          <button
            type="button"
            onClick={() => setChatAberto(true)}
            className="w-full box-border vovo-gradient rounded-lg p-3 flex items-start gap-2 border border-gold-light/40 text-left hover:border-primary/50 hover:shadow-warm-sm transition-all"
            aria-label="Fale com a IA Assistente"
          >
            <Sparkles size={16} className="text-gold-dark mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-bold font-display text-primary">
                Fale com a IA Assistente
              </div>
              <div className="text-[11px] text-brown-mid leading-snug mt-0.5">
                Pergunte, dite ou peça relatórios.
              </div>
            </div>
          </button>

          <button
            onClick={sair}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <LogOut size={14} /> Sair
          </button>
        </div>
      </aside>

      {/* Bottom nav mobile */}
      <nav className="mobile-safe-bottom md:hidden fixed bottom-0 inset-x-0 z-40 bg-sidebar border-t border-sidebar-border flex">
        {mobileItems.map((it) => {
          const active = itemAtivo(it.to);
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={[
                "flex-1 flex flex-col items-center gap-1 py-2 text-[10px] font-medium",
                active ? "text-primary" : "text-muted-foreground",
              ].join(" ")}
            >
              <div className="relative">
                <Icon size={18} />
                {it.badge ? (
                  <span className="absolute -top-1.5 -right-2 bg-primary text-primary-foreground text-[9px] font-bold px-1 rounded-full">
                    {it.badge}
                  </span>
                ) : null}
              </div>
              {it.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMaisAberto(true)}
          className={[
            "flex-1 flex flex-col items-center gap-1 py-2 text-[11px] font-medium",
            moreActive ? "text-primary" : "text-muted-foreground",
          ].join(" ")}
          aria-label="Abrir mais opções"
          aria-expanded={maisAberto}
        >
          <MoreHorizontal size={19} />
          Mais
        </button>
      </nav>

      {/* Main */}
      <main className="flex-1 min-w-0 pb-24 md:pb-0 md:ml-60">
        <header className="md:hidden flex items-center gap-3 px-5 py-4 border-b border-border bg-sidebar">
          <div className="w-10 h-10 rounded-full bg-card overflow-hidden flex items-center justify-center">
            <img src={voCidaImg} alt="Doces da Vó Cida" className="w-full h-full object-contain" />
          </div>
          <div className="leading-tight flex-1 min-w-0">
            <div className="font-display font-bold text-sm text-primary">Doces da Vó Cida</div>
            <div className="text-[11px] text-muted-foreground truncate">{user.email}</div>
          </div>
          <button
            onClick={sair}
            className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label="Sair"
          >
            <LogOut size={15} />
          </button>
        </header>

        <div className="max-w-6xl mx-auto px-4 sm:px-5 md:px-10 py-5 md:py-10">{children}</div>
      </main>

      <AssistenteChat
        open={chatAberto}
        onClose={() => setChatAberto(false)}
        onOpenVoice={() => {
          setChatAberto(false);
          setVozAberta(true);
        }}
      />
      <AssistenteVoz open={vozAberta} onClose={() => setVozAberta(false)} />

      <Sheet open={maisAberto} onOpenChange={setMaisAberto}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl border-sidebar-border bg-sidebar px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-6 md:hidden"
        >
          <SheetHeader className="pr-8 text-left">
            <SheetTitle className="font-display text-2xl text-primary">Mais opções</SheetTitle>
            <SheetDescription className="truncate">{user.email}</SheetDescription>
          </SheetHeader>
          <nav className="mt-5 grid gap-2" aria-label="Mais opções de navegação">
            {moreItems.map((item) => {
              const Icon = item.icon;
              const active = itemAtivo(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMaisAberto(false)}
                  className={[
                    "flex min-h-12 items-center gap-3 rounded-xl border px-4 text-sm font-semibold",
                    active
                      ? "border-primary/30 bg-card text-primary shadow-warm-sm"
                      : "border-border bg-card/70 text-foreground",
                  ].join(" ")}
                >
                  <Icon size={19} /> {item.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setMaisAberto(false);
                setChatAberto(true);
              }}
              className="flex min-h-12 items-center gap-3 rounded-xl border border-gold-light/50 vovo-gradient px-4 text-sm font-semibold text-primary"
            >
              <Sparkles size={19} /> IA Assistente
            </button>
            <button
              type="button"
              onClick={sair}
              className="flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold text-muted-foreground"
            >
              <LogOut size={19} /> Sair
            </button>
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}