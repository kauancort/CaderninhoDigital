import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiFn } from "@/lib/api-function";
import { AppShell } from "@/components/AppShell";
import { listarVendas, adicionarContatoVenda } from "@/lib/vendas.functions";
import { fmtBRL, fmtDateTime, type FormaPagamento } from "@/lib/format";
import { ReceiptText, X, Phone, Send } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/vendas")({
  component: () => (
    <AppShell>
      <Vendas />
    </AppShell>
  ),
});

type StatusPagamento = "PAGO" | "PENDENTE" | "ATRASADO" | "NAO_SE_APLICA";

function Vendas() {
  const { data: vendas = [] } = useQuery({ queryKey: ["vendas"], queryFn: () => listarVendas() });
  const [filtro, setFiltro] = useState<"todas" | "hoje" | "semana">("todas");
  const [vendaSelecionada, setVendaSelecionada] = useState<any | null>(null);

  const hoje = new Date().toDateString();
  const sete = Date.now() - 7 * 86400000;

  const filtradas = vendas.filter((v: any) => {
    if (filtro === "hoje") return new Date(v.data_venda).toDateString() === hoje;
    if (filtro === "semana") return +new Date(v.data_venda) >= sete;
    return true;
  });

  const total = filtradas.reduce((s: number, v: any) => s + Number(v.valor_total), 0);
  const totalItens = filtradas.reduce(
    (s: number, v: any) =>
      s + (v.itens_venda ?? []).reduce((a: number, i: any) => a + Number(i.quantidade), 0),
    0,
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-4xl font-display font-bold text-primary">Vendas</h1>
          <p className="font-body text-sm md:text-base text-muted-foreground mt-1">
            Cada docinho que saiu pra rua.
          </p>
        </div>
        <div className="flex items-center gap-1 md:gap-2 bg-card border border-border rounded-full p-1 shadow-warm-sm flex-wrap">
          {(["todas", "hoje", "semana"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={[
                "px-3 md:px-4 py-1.5 rounded-full text-[11px] md:text-xs font-bold uppercase tracking-wider transition",
                filtro === f
                  ? "bg-primary text-primary-foreground shadow-warm-sm"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <Card label="Total" value={fmtBRL(total)} tone="primary" />
        <Card label="Vendas" value={String(filtradas.length)} tone="gold" />
        <Card label="Docinhos" value={String(totalItens)} tone="success" />
      </div>

      {filtradas.length === 0 ? (
        <div className="text-center py-12 px-6 bg-card border border-dashed border-border rounded-2xl">
          <ReceiptText className="mx-auto text-muted-foreground mb-3" size={36} />
          <h3 className="font-display text-xl text-foreground mb-1">Nenhuma venda</h3>
          <p className="font-body text-sm text-muted-foreground">
            Mude o filtro ou registre uma nova.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-warm-sm">
          {filtradas.map((v: any) => {
            const resumo = (v.itens_venda ?? [])
              .map((i: any) => `${Number(i.quantidade)}× ${i.produtos_finais?.nome ?? "item"}`)
              .join(", ");
            const clicavel = v.em_atraso;
            return (
              <div
                key={v.id}
                onClick={() => clicavel && setVendaSelecionada(v)}
                className={[
                  "px-5 py-4 border-t border-border first:border-t-0 flex items-start justify-between gap-3",
                  clicavel ? "cursor-pointer hover:bg-error-bg/40 transition-colors" : "",
                ].join(" ")}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-foreground">{resumo || "—"}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-1">
                    {v.comprador && <>{v.comprador} · </>}
                    {fmtDateTime(v.data_venda)}
                    <PagamentoBadge tipo={v.forma_pagamento} tipoCartao={v.tipo_cartao} parcelas={v.parcelas} />
                    <StatusPagamentoBadge status={v.status_pagamento} emAtraso={v.em_atraso} />
                  </div>
                  {v.em_atraso && (
                    <div className="text-[11px] text-error font-semibold mt-1">
                      Toque para ver/registrar contato com o cliente
                    </div>
                  )}
                </div>
                <div className="text-right font-display font-bold text-primary tabular-nums">
                  {fmtBRL(Number(v.valor_total))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {vendaSelecionada && (
        <ModalContatos venda={vendaSelecionada} onClose={() => setVendaSelecionada(null)} />
      )}
    </div>
  );
}

function ModalContatos({ venda, onClose }: { venda: any; onClose: () => void }) {
  const qc = useQueryClient();
  const fnContato = useApiFn(adicionarContatoVenda);
  const [tipo, setTipo] = useState("Ligação");
  const [resposta, setResposta] = useState("");

  const mutation = useMutation({
    mutationFn: (vars: Parameters<typeof adicionarContatoVenda>[0]) => fnContato(vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendas"] });
      setResposta("");
    },
  });

  function registrar(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({
      data: { venda_id: venda.id, tipo, resposta: resposta.trim() || null },
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-brown/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl shadow-warm-lg max-w-md w-full overflow-hidden max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border flex items-start justify-between gap-3 bg-error-bg/40">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-error">
              Em atraso
            </div>
            <h2 className="font-display text-xl font-bold text-foreground mt-0.5">
              {venda.comprador}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {fmtBRL(Number(venda.valor_total))} · venceu em{" "}
              {venda.data_vencimento?.split("-").reverse().join("/")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Histórico de contatos
            </h3>
            {(!venda.contatos || venda.contatos.length === 0) ? (
              <p className="text-sm text-muted-foreground">Nenhum contato registrado ainda.</p>
            ) : (
              <ul className="space-y-2">
                {venda.contatos
                  .slice()
                  .reverse()
                  .map((c: any, idx: number) => (
                    <li key={idx} className="bg-secondary/50 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground inline-flex items-center gap-1">
                          <Phone size={12} /> {c.tipo}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {fmtDateTime(c.data)}
                        </span>
                      </div>
                      {c.resposta && (
                        <p className="text-sm text-brown-mid mt-1">{c.resposta}</p>
                      )}
                    </li>
                  ))}
              </ul>
            )}
          </div>

          <form onSubmit={registrar} className="space-y-3 border-t border-border pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Registrar novo contato
            </h3>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Tipo de contato
              </label>
              <select className="ds-input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                <option value="Ligação">Ligação</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Mensagem/SMS">Mensagem/SMS</option>
                <option value="Presencial">Presencial</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Resposta do cliente (opcional)
              </label>
              <textarea
                className="ds-input"
                rows={2}
                value={resposta}
                onChange={(e) => setResposta(e.target.value)}
                placeholder="Ex.: Disse que paga até sexta"
              />
            </div>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full px-4 py-2.5 rounded-md bg-primary text-primary-foreground font-bold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Send size={14} /> {mutation.isPending ? "Salvando..." : "Registrar contato"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "gold" | "success";
}) {
  const accent =
    tone === "primary" ? "text-primary" : tone === "gold" ? "text-gold-dark" : "text-success";
  return (
    <div className="bg-card border border-border rounded-2xl p-3 md:p-4 shadow-warm-sm min-w-0">
      <div className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 truncate">
        {label}
      </div>
      <div
        className={`font-display text-base md:text-2xl font-bold ${accent} tabular-nums break-words leading-tight`}
      >
        {value}
      </div>
    </div>
  );
}

function PagamentoBadge({
  tipo,
  tipoCartao,
  parcelas,
}: {
  tipo: FormaPagamento;
  tipoCartao?: string | null;
  parcelas?: number | null;
}) {
  const map: Record<FormaPagamento, { label: string; cls: string }> = {
    dinheiro: { label: "Dinheiro", cls: "bg-success-bg text-success" },
    pix: { label: "Pix", cls: "bg-info-bg text-info" },
    cartao: { label: "Cartão", cls: "bg-gold-bg text-gold-dark" },
    boleto: { label: "Boleto", cls: "bg-warning-bg text-warning" },
    outro: { label: "Outro", cls: "bg-secondary text-brown-mid" },
  };
  const { label, cls } = map[tipo];
  const extra =
    tipo === "cartao" && tipoCartao
      ? ` ${tipoCartao === "CREDITO" ? "Créd." : "Déb."}${
          tipoCartao === "CREDITO" && parcelas ? ` ${parcelas}x` : ""
        }`
      : "";
  return (
    <span
      className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${cls}`}
    >
      {label}
      {extra}
    </span>
  );
}

function StatusPagamentoBadge({
  status,
  emAtraso,
}: {
  status: StatusPagamento;
  emAtraso?: boolean;
}) {
  if (emAtraso) {
    return (
      <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-error-bg text-error animate-pulse">
        Em atraso
      </span>
    );
  }
  const map: Record<StatusPagamento, { label: string; cls: string }> = {
    PAGO: { label: "Pago", cls: "bg-success-bg text-success" },
    PENDENTE: { label: "Pendente", cls: "bg-warning-bg text-warning" },
    ATRASADO: { label: "Atrasado", cls: "bg-error-bg text-error" },
    NAO_SE_APLICA: { label: "N/A", cls: "bg-secondary text-brown-mid" },
  };
  const { label, cls } = map[status] ?? map.NAO_SE_APLICA;
  return (
    <span
      className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${cls}`}
    >
      {label}
    </span>
  );
}