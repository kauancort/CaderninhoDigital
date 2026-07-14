import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useApiFn } from "@/lib/api-function";
import { ArrowLeft, Check, Wallet } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { registrarGasto } from "@/lib/gastos.functions";
import {
  fmtBRL,
  categoriaLabel,
  hojeISO,
  type CategoriaGasto,
  type StatusPagamento,
} from "@/lib/format";
import { consumePrefill, type PrefillGasto } from "@/lib/voz-prefill";

export const Route = createFileRoute("/registrar/gastos")({
  component: () => (
    <AppShell>
      <RegistrarGasto />
    </AppShell>
  ),
});

const categorias: CategoriaGasto[] = [
  "materia-prima",
  "embalagens",
  "energia",
  "aluguel",
  "transporte",
  "outros",
];

function RegistrarGasto() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fn = useApiFn(registrarGasto);

  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState<CategoriaGasto>("energia");
  const [valor, setValor] = useState("");
  const [dataLancamento, setDataLancamento] = useState(hojeISO());
  const [dataVencimento, setDataVencimento] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("PIX");
  const [statusPagamento, setStatusPagamento] = useState<StatusPagamento>("PAGO");
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const pre = consumePrefill<PrefillGasto>("gasto");
    if (!pre) return;
    if (pre.descricao) setDescricao(pre.descricao);
    if (pre.categoria) setCategoria(pre.categoria as CategoriaGasto);
    if (pre.valor != null) setValor(String(pre.valor).replace(".", ","));
  }, []);

  const total = Number(valor.replace(",", ".")) || 0;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!descricao.trim()) return setErro("Descreva o gasto.");
    if (total <= 0) return setErro("Informe um valor maior que zero.");
    try {
      await fn({
        data: {
          descricao: descricao.trim(),
          categoria,
          valor: total,
          data_lancamento: dataLancamento,
          data_vencimento: dataVencimento || null,
          forma_pagamento: formaPagamento,
          status_pagamento: statusPagamento,
          observacao: observacao.trim() || null,
        },
      });
      qc.invalidateQueries({ queryKey: ["gastos"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOk(true);
      setTimeout(() => navigate({ to: "/gastos" }), 800);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro");
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <header className="flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/registrar" })}
          className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center hover:bg-secondary"
          aria-label="Voltar para registrar"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <div className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Caderninho
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-primary">
            Registrar gasto
          </h1>
          <div className="text-xs text-muted-foreground font-body">
            Conta de luz, transporte, aluguel...
          </div>
        </div>
      </header>

      <form onSubmit={salvar} className="space-y-6">
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5 shadow-warm-sm">
          <div>
            <label className="text-sm font-semibold text-foreground mb-2 block">Descrição *</label>
            <input
              autoFocus
              className="ds-input"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Conta de luz"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">
                Data do lançamento *
              </label>
              <input
                type="date"
                required
                className="ds-input"
                value={dataLancamento}
                onChange={(e) => setDataLancamento(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">
                Data de vencimento
              </label>
              <input
                type="date"
                className="ds-input"
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">
                Forma de pagamento
              </label>
              <select
                className="ds-input"
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value)}
              >
                <option value="DINHEIRO">Dinheiro</option>
                <option value="PIX">Pix</option>
                <option value="CARTAO">Cartão</option>
                <option value="BOLETO">Boleto</option>
                <option value="OUTRO">Outro</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Status</label>
              <select
                className="ds-input"
                value={statusPagamento}
                onChange={(e) => setStatusPagamento(e.target.value as StatusPagamento)}
              >
                <option value="PAGO">Pago</option>
                <option value="PENDENTE">Pendente</option>
                <option value="ATRASADO">Atrasado</option>
                <option value="NAO_SE_APLICA">Não se aplica</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground mb-2 block">Observação</label>
            <textarea
              className="ds-input"
              rows={3}
              maxLength={1000}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Detalhes adicionais do gasto"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground mb-2 block">Categoria</label>
            <div className="grid grid-cols-3 gap-2">
              {categorias.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategoria(c)}
                  className={[
                    "py-2.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors",
                    categoria === c
                      ? "bg-primary text-primary-foreground shadow-warm-sm"
                      : "bg-secondary text-brown-mid hover:bg-beige-dark",
                  ].join(" ")}
                >
                  {categoriaLabel[c]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground mb-2 block">Valor *</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                R$
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="120,00"
                className="ds-input"
                style={{ paddingLeft: "3rem" }}
              />
            </div>
          </div>
        </div>

        <div className="vovo-gradient border border-gold-light/40 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Total
            </div>
            <div className="font-display text-3xl font-bold text-primary leading-none mt-1">
              {fmtBRL(total)}
            </div>
          </div>
          <div className="text-right text-xs text-brown-mid font-body">
            {categoriaLabel[categoria]}
          </div>
        </div>

        {erro && (
          <div className="bg-error-bg border-l-4 border-error text-error rounded-md px-4 py-3 text-sm font-medium">
            {erro}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate({ to: "/registrar" })}
            className="px-6 py-3 rounded-md font-semibold text-sm border border-border bg-card text-brown-mid hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={ok}
            className="flex-1 px-6 py-3 rounded-md font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary-dark shadow-warm-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {ok ? (
              <>
                <Check size={16} /> Salvo!
              </>
            ) : (
              <>
                <Wallet size={16} /> Confirmar gasto
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
