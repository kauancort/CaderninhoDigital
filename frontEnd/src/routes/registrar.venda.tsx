import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiFn } from "@/lib/api-function";
import { Check, Sparkles, ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { listarProdutos } from "@/lib/catalogo.functions";
import { registrarVenda } from "@/lib/vendas.functions";
import { fmtBRL, hojeISO, type FormaPagamento, type StatusPagamento } from "@/lib/format";
import { consumePrefill, type PrefillVenda } from "@/lib/voz-prefill";

export const Route = createFileRoute("/registrar/venda")({
  component: () => (
    <AppShell>
      <RegistrarVenda />
    </AppShell>
  ),
});

type TipoVenda = "pote" | "caixa";
type ItemForm = {
  produto_final_id: string;
  quantidade: string;
  preco_unitario: string;
  tipo: TipoVenda;
};

const POTES_POR_CAIXA = 6;

const PRECO_POTE_FIXO: Record<string, number> = {
  "Fondant de leite palito": 21.3,
  "Fondant de leite": 20.7,
  "Biriba palito": 19.7,
  Biriba: 19.7,
  "Paçoca Caseira palito": 18.7,
  "Paçoca Caseira": 18.7,
};

function RegistrarVenda() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fnRegistrar = useApiFn(registrarVenda);

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos"],
    queryFn: () => listarProdutos(),
  });

  const [itens, setItens] = useState<ItemForm[]>([
    { produto_final_id: "", quantidade: "1", preco_unitario: "", tipo: "pote" },
  ]);
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [dataVenda, setDataVenda] = useState(hojeISO());
  const [statusPagamento, setStatusPagamento] = useState<StatusPagamento>("PAGO");
  const [cliente, setCliente] = useState("");
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);

  useEffect(() => {
    const pre = consumePrefill<PrefillVenda>("venda");
    if (!pre) return;
    if (pre.forma_pagamento) setForma(pre.forma_pagamento);
    if (pre.comprador) setCliente(pre.comprador);
    if (Array.isArray(pre.itens) && pre.itens.length > 0) {
      setItens(
        pre.itens.map((i) => ({
          produto_final_id: i.produto_final_id ?? "",
          quantidade: String(i.quantidade ?? 1),
          preco_unitario:
            i.preco_unitario != null ? String(i.preco_unitario).replace(".", ",") : "",
          tipo: i.tipo === "caixa" ? "caixa" : "pote",
        })),
      );
    }
  }, []);

  const mutation = useMutation({
    mutationFn: (vars: Parameters<typeof registrarVenda>[0]) => fnRegistrar(vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendas"] });
      qc.invalidateQueries({ queryKey: ["produtos"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setTimeout(() => navigate({ to: "/vendas" }), 800);
    },
    onError: (err: Error) => setErro(err.message),
  });

  const itensCalculados = itens.map((i) => {
    const prod = produtos.find((p: any) => p.id === i.produto_final_id);
    const q = Number(i.quantidade) || 0;
    const potes = i.tipo === "caixa" ? q * POTES_POR_CAIXA : q;
    const p = Number(i.preco_unitario.replace(",", ".")) || 0;
    return { ...i, nome: (prod as any)?.nome ?? "—", subtotal: potes * p, qtd: q, potes, preco: p };
  });
  const total = itensCalculados.reduce((s, i) => s + i.subtotal, 0);

  function atualizarItem(idx: number, patch: Partial<ItemForm>) {
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function selecionarProduto(idx: number, id: string) {
    const p = produtos.find((p: any) => p.id === id) as any;
    const nome: string = p?.nome ?? "";
    const nomeBase = nome.split("(")[0].trim();
    const chave = Object.keys(PRECO_POTE_FIXO).find(
      (k) => k.toLowerCase() === nomeBase.toLowerCase(),
    );
    const precoFixo = chave ? PRECO_POTE_FIXO[chave] : undefined;
    const preco = precoFixo !== undefined ? precoFixo.toFixed(2).replace(".", ",") : "";
    atualizarItem(idx, { produto_final_id: id, preco_unitario: preco });
  }

  function abrirConfirmacao(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (itens.some((i) => !i.produto_final_id))
      return setErro("Escolha o produto em todos os itens.");
    if (itensCalculados.some((i) => i.qtd <= 0 || i.preco <= 0))
      return setErro("Verifique quantidades e preços.");
    setConfirmar(true);
  }

  function salvar() {
    mutation.mutate({
      data: {
        comprador: cliente.trim() || null,
        data_venda: dataVenda,
        forma_pagamento: forma,
        status_pagamento: statusPagamento,
        observacao: observacao.trim() || null,
        itens: itensCalculados.map((i) => ({
          produto_final_id: i.produto_final_id,
          quantidade: i.potes,
          preco_unitario: i.preco,
        })),
      },
    });
  }

  const formaLabel: Record<FormaPagamento, string> = {
    dinheiro: "Dinheiro",
    pix: "Pix",
    cartao: "Cartão",
    boleto: "Boleto",
    outro: "Outro",
  };
  const ok = mutation.isSuccess;

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
            Registrar venda
          </h1>
        </div>
      </header>

      {produtos.length === 0 && (
        <div className="bg-warning-bg border-l-4 border-warning text-foreground rounded-md px-4 py-3 text-sm">
          Cadastre produtos finais primeiro na tela de <strong>Estoque</strong>.
        </div>
      )}

      <form onSubmit={abrirConfirmacao} className="space-y-6">
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5 shadow-warm-sm">
          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground">Itens da venda</label>
            {itens.map((it, idx) => (
              <div key={idx} className="space-y-2 border border-border rounded-lg p-3">
                <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                  <select
                    className="ds-input"
                    value={it.produto_final_id}
                    onChange={(e) => selecionarProduto(idx, e.target.value)}
                  >
                    <option value="">Escolha o produto...</option>
                    {produtos.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} (estoque: {Number(p.quantidade_estoque)})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setItens((p) => p.filter((_, i) => i !== idx))}
                    disabled={itens.length === 1}
                    className="w-10 h-10 rounded-md text-error hover:bg-error-bg disabled:opacity-30"
                    aria-label={`Remover item ${idx + 1}`}
                  >
                    <Trash2 size={16} className="mx-auto" />
                  </button>
                </div>
                {it.produto_final_id && (
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                        Tipo de Venda
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {(["pote", "caixa"] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => atualizarItem(idx, { tipo: t })}
                            className={[
                              "py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-colors",
                              it.tipo === t
                                ? "bg-primary text-primary-foreground shadow-warm-sm"
                                : "bg-secondary text-brown-mid hover:bg-beige-dark",
                            ].join(" ")}
                          >
                            {t === "pote" ? "Pote" : "Caixa (6 potes)"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                          {it.tipo === "caixa" ? "Quant. de Caixas" : "Quant. de Potes"}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          className="ds-input"
                          value={it.quantidade}
                          onChange={(e) => atualizarItem(idx, { quantidade: e.target.value })}
                        />
                        {it.tipo === "caixa" && Number(it.quantidade) > 0 && (
                          <div className="text-[11px] text-muted-foreground mt-1">
                            Equivale a {Number(it.quantidade) * POTES_POR_CAIXA} potes
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                          Preço por pote (R$)
                        </label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                            R$
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            className="ds-input"
                            style={{ paddingLeft: "2.25rem" }}
                            value={it.preco_unitario}
                            onChange={(e) => atualizarItem(idx, { preco_unitario: e.target.value })}
                            placeholder="0,00"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setItens((p) => [
                  ...p,
                  { produto_final_id: "", quantidade: "1", preco_unitario: "", tipo: "pote" },
                ])
              }
              className="text-xs font-bold text-primary inline-flex items-center gap-1"
            >
              <Plus size={14} /> Adicionar item
            </button>
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground mb-2 block">
              Forma de pagamento
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(["dinheiro", "pix", "cartao", "boleto", "outro"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setForma(f)}
                  className={[
                    "py-2.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors",
                    forma === f
                      ? "bg-primary text-primary-foreground shadow-warm-sm"
                      : "bg-secondary text-brown-mid hover:bg-beige-dark",
                  ].join(" ")}
                >
                  {formaLabel[f]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">
                Data da venda *
              </label>
              <input
                type="date"
                required
                className="ds-input"
                value={dataVenda}
                onChange={(e) => setDataVenda(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Status *</label>
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
            <label className="text-sm font-semibold text-foreground mb-2 block">
              Comprador (opcional)
            </label>
            <input
              className="ds-input"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Ex.: Dona Maria"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground mb-2 block">
              Observação (opcional)
            </label>
            <textarea
              className="ds-input"
              rows={3}
              maxLength={1000}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex.: Venda no balcão"
            />
          </div>
        </div>

        <div className="vovo-gradient border border-gold-light/40 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Total da venda
            </div>
            <div className="font-display text-3xl font-bold text-primary leading-none mt-1">
              {fmtBRL(total)}
            </div>
          </div>
          <div className="text-right text-xs text-brown-mid font-body">
            {itens.length} {itens.length === 1 ? "item" : "itens"}
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
            disabled={produtos.length === 0}
            className="flex-1 px-6 py-3 rounded-md font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary-dark shadow-warm-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Sparkles size={16} /> Conferir com a Vovó
          </button>
        </div>
      </form>

      {confirmar && (
        <div
          className="fixed inset-0 z-50 bg-brown/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !mutation.isPending && setConfirmar(false)}
        >
          <div
            className="bg-card rounded-2xl shadow-warm-lg max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center pt-7 pb-3 vovo-gradient">
              <div className="w-14 h-14 mx-auto rounded-full bg-primary text-primary-foreground flex items-center justify-center border-2 border-gold shadow-warm-sm">
                <Sparkles size={22} />
              </div>
              <h2 className="font-display text-2xl font-bold text-primary mt-3">
                Fale com a IA Assistente
              </h2>
              <p className="text-sm text-brown-mid font-body">Confirme os detalhes</p>
            </div>
            <div className="p-6 space-y-3">
              <ul className="text-sm space-y-2">
                {itensCalculados.map((i, idx) => (
                  <li
                    key={idx}
                    className="flex justify-between bg-secondary/50 rounded-lg px-3 py-2"
                  >
                    <span>
                      <strong>{i.potes}×</strong> {i.nome}
                      {i.tipo === "caixa" ? ` (${i.qtd} caixa${i.qtd > 1 ? "s" : ""})` : ""}
                    </span>
                    <span className="font-display font-bold text-primary">
                      {fmtBRL(i.subtotal)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="text-xs text-muted-foreground">
                Pagamento: <strong>{formaLabel[forma]}</strong>
                {cliente && (
                  <>
                    {" "}
                    · Para <strong>{cliente}</strong>
                  </>
                )}
              </div>
              <div className="bg-gold-bg rounded-lg px-3 py-2 text-right font-display text-xl font-bold text-primary">
                {fmtBRL(total)}
              </div>
              {mutation.isError && <div className="text-xs text-error">{erro}</div>}
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setConfirmar(false)}
                disabled={mutation.isPending || ok}
                className="flex-1 px-4 py-3 rounded-full border-2 border-primary text-primary font-bold text-sm inline-flex items-center justify-center gap-2"
              >
                <Pencil size={14} /> Corrigir
              </button>
              <button
                onClick={salvar}
                disabled={mutation.isPending || ok}
                className="flex-1 px-4 py-3 rounded-full bg-foreground text-card font-bold text-sm inline-flex items-center justify-center gap-2"
              >
                {ok ? (
                  <>
                    <Check size={16} /> Salvo!
                  </>
                ) : mutation.isPending ? (
                  "Salvando..."
                ) : (
                  <>
                    <Check size={14} /> Confirmar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
