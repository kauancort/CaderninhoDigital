import { ChevronDown, ChevronUp, Filter, RotateCcw } from "lucide-react";
import { useId, useState } from "react";

export function FiltrosRecolhiveis({
  titulo,
  ativos = false,
  onLimpar,
  children,
  className = "",
}: {
  titulo: string;
  ativos?: boolean;
  onLimpar?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [aberto, setAberto] = useState(true);
  const conteudoId = useId();

  return (
    <section
      className={`rounded-2xl border border-border bg-card p-4 shadow-warm-sm md:p-5 ${className}`}
    >
      <div className={`flex flex-wrap items-center justify-between gap-3 ${aberto ? "mb-4" : ""}`}>
        <h2 className="inline-flex items-center gap-2 font-display text-sm font-bold text-foreground">
          <Filter size={16} className="text-primary" aria-hidden="true" />
          {titulo}
          {ativos && (
            <span className="rounded-full bg-info-bg px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-info">
              Ativos
            </span>
          )}
        </h2>

        <div className="flex flex-wrap items-center justify-end gap-1">
          {onLimpar && (
            <button
              type="button"
              disabled={!ativos}
              onClick={onLimpar}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-xs font-bold text-primary hover:bg-secondary disabled:opacity-40"
            >
              <RotateCcw size={13} aria-hidden="true" /> Limpar
            </button>
          )}
          <button
            type="button"
            aria-expanded={aberto}
            aria-controls={conteudoId}
            onClick={() => setAberto((atual) => !atual)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-bold text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {aberto ? (
              <>
                <ChevronUp size={14} aria-hidden="true" /> Minimizar filtros
              </>
            ) : (
              <>
                <ChevronDown size={14} aria-hidden="true" /> Mostrar filtros
              </>
            )}
          </button>
        </div>
      </div>

      <div id={conteudoId} hidden={!aberto}>
        {children}
      </div>
    </section>
  );
}
