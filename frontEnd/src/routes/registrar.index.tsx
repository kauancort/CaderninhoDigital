import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Mic, Camera, Keyboard, ShoppingCart, Cookie, Receipt, Wallet } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AssistenteVoz } from "@/components/AssistenteVoz";

export const Route = createFileRoute("/registrar/")({
  component: () => (
    <AppShell>
      <RegistrarHub />
    </AppShell>
  ),
});

const tipos = [
  {
    to: "/registrar/venda" as const,
    icon: <Receipt size={28} />,
    label: "Venda",
    desc: "Registrar doces vendidos hoje",
    highlight: true,
  },
  {
    to: "/registrar/compra" as const,
    icon: <ShoppingCart size={28} />,
    label: "Compra de Produto",
    desc: "Ingredientes, embalagens, etc.",
  },
  {
    to: "/registrar/producao" as const,
    icon: <Cookie size={28} />,
    label: "Produção",
    desc: "Lotes de doces finalizados",
  },
  {
    to: "/registrar/gastos" as const,
    icon: <Wallet size={28} />,
    label: "Gastos Gerais",
    desc: "Luz, água, transporte, etc.",
  },
];

function RegistrarHub() {
  const [vozAberta, setVozAberta] = useState(false);
  const [avisoFoto, setAvisoFoto] = useState(false);

  return (
    <div className="space-y-10">
      <header className="text-center">
        <h1 className="text-3xl md:text-4xl font-display font-bold text-primary">
          O que você quer registrar agora?
        </h1>
        <p className="font-body text-muted-foreground mt-2">
          Selecione o tipo de atividade para manter tudo organizado.
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto">
        {tipos.map((t, idx) => (
          <Link
            key={idx}
            to={t.to}
            className="group bg-card border border-border rounded-2xl p-8 text-center hover:border-primary hover:shadow-warm-md transition-all"
          >
            <div
              className={[
                "w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center transition-transform group-hover:scale-110",
                t.highlight ? "bg-primary-bg text-primary" : "bg-secondary text-brown-mid",
              ].join(" ")}
            >
              {t.icon}
            </div>
            <div className="font-display text-xl font-bold text-foreground mb-1">{t.label}</div>
            <div className="text-sm text-muted-foreground font-body">{t.desc}</div>
          </Link>
        ))}
      </section>

      <section className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            ou registre rapidamente por
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <div className="flex justify-center gap-6">
          <button
            onClick={() => setVozAberta(true)}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-14 h-14 rounded-full flex items-center justify-center border-2 border-primary bg-primary-bg text-primary hover:bg-primary hover:text-primary-foreground transition-all">
              <Mic size={22} />
            </div>
            <div className="text-xs font-bold text-foreground">Voz</div>
          </button>
          <button
            type="button"
            onClick={() => setAvisoFoto(true)}
            className="flex flex-col items-center gap-2 group"
            aria-describedby="aviso-foto"
          >
            <div className="relative w-14 h-14 rounded-full flex items-center justify-center border-2 border-border bg-muted text-muted-foreground transition-all">
              <Camera size={22} />
              <span className="absolute -right-3 -top-2 rounded-full bg-gold-bg px-1.5 py-0.5 text-[10px] font-bold text-gold-dark">
                Em breve
              </span>
            </div>
            <div className="text-xs font-bold text-foreground">Foto</div>
          </button>
          <Link to="/registrar/venda" className="flex flex-col items-center gap-2 group">
            <div className="w-14 h-14 rounded-full flex items-center justify-center border-2 border-border bg-card text-brown-mid hover:border-primary hover:text-primary transition-all">
              <Keyboard size={22} />
            </div>
            <div className="text-xs font-bold text-foreground">Formulário de venda</div>
          </Link>
        </div>
        <div id="aviso-foto" aria-live="polite" className="min-h-6">
          {avisoFoto && (
            <p className="mt-4 text-center text-sm font-medium text-gold-dark">
              O registro por foto estará disponível em breve.
            </p>
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-4 font-body italic">
          ✨ Diga uma venda, compra, produção ou gasto e a Vovó preenche pra você.
        </p>
      </section>

      <AssistenteVoz open={vozAberta} onClose={() => setVozAberta(false)} />
    </div>
  );
}
