import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiFn } from "@/lib/api-function";
import { ArrowLeft, Check, Sparkles, Package, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { listarMateriaPrima, criarMateriaPrima } from "@/lib/catalogo.functions";
import { registrarCompra } from "@/lib/compras.functions";
import { fmtBRL, hojeISO, type CategoriaGasto, type StatusPagamento } from "@/lib/format";
import { consumePrefill, type PrefillCompra } from "@/lib/voz-prefill";

export const Route = createFileRoute("/registrar/compra")({
  component: () => (
    <AppShell>
      <RegistrarCompra />
    </AppShell>
  ),
});

function RegistrarCompra() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fnCompra = useApiFn(registrarCompra);
  const fnCriarMP = useApiFn(criarMateriaPrima);

  const { data: mps = [] } = useQuery({
    queryKey: ["materia_prima"],
    queryFn: () => listarMateriaPrima(),
  });

  const [modo, setModo] = useState<"existente" | "novo">("existente");
  const [materiaPrimaId, setMateriaPrimaId] = useState("");
  const [nome, setNome] = useState("");
  const [unidade, setUnidade] = useState("kg");
  const [estoqueMinimo, setEstoqueMinimo] = useState("0");
  const [quantidade, setQuantidade] = useState("1");
  const [valorTotal, setValorTotal] = useState("");
  const [categoria, setCategoria] = useState<CategoriaGasto>("materia-prima");
  const [fornecedor, setFornecedor] = useState("");
  const [dataCompra, setDataCompra] = useState(hojeISO());
  const [formaPagamento, setFormaPagamento] = useState("PIX");
  const [statusPagamento, setStatusPagamento] = useState<StatusPagamento>("PAGO");
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const pre = consumePrefill<PrefillCompra>("compra");
    if (!pre) return;
    if (pre.materia_prima_id) {
      setModo("existente");
      setMateriaPrimaId(pre.materia_prima_id);
    } else if (pre.produto_nome) {
      setModo("novo");
      setNome(pre.produto_nome);
    }
    if (pre.unidade) setUnidade(pre.unidade);
    if (pre.quantidade) setQuantidade(String(pre.quantidade));
    if (pre.valor_total != null) setValorTotal(String(pre.valor_total).replace(".", ","));
    if (pre.categoria) setCategoria(pre.categoria);
    if (pre.fornecedor) setFornecedor(pre.fornecedor);
  }, []);

  const qtd = Number(quantidade.replace(",", ".")) || 0;
  const valor = Number(valorTotal.replace(",", ".")) || 0;
  const custoUnit = qtd > 0 ? valor / qtd : 0;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (qtd <= 0) return setErro("Informe a quantidade comprada.");
    if (valor <= 0) return setErro("Informe o valor total pago.");

    try {
      let mpId = materiaPrimaId;
      if (modo === "novo") {
        if (!nome.trim()) return setErro("Dê um nome ao novo produto.");
        const nova = await fnCriarMP({
          data: { nome: nome.trim(), unidade, estoque_minimo: Number(estoqueMinimo) || 0 },
        });
        mpId = (nova as any).id;
      } else {
        if (!mpId) return setErro("Escolha um ingrediente.");
      }

      await fnCompra({
        data: {
          materia_prima_id: mpId,
          quantidade: qtd,
          valor_total: valor,
          data_compra: dataCompra,
          forma_pagamento: formaPagamento,
          status_pagamento: statusPagamento,
          observacao: observacao.trim() || null,
          fornecedor: fornecedor || null,
          categoria,
        },
      });

      qc.invalidateQueries({ queryKey: ["materia_prima"] });
      qc.invalidateQueries({ queryKey: ["gastos"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOk(true);
      setTimeout(() => navigate({ to: "/estoque" }), 800);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar");
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
            Registrar compra
          </h1>
          <div className="text-xs text-muted-foreground font-body">
            Adicionar ao estoque e contabilizar o gasto
          </div>
        </div>
      </header>

      <form onSubmit={salvar} className="space-y-6">
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5 shadow-warm-sm">
          <div>
            <label className="text-sm font-semibold text-foreground mb-2 block">
              O que foi comprado?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["existente", "novo"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModo(m)}
                  className={[
                    "py-2.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors",
                    modo === m
                      ? "bg-primary text-primary-foreground shadow-warm-sm"
                      : "bg-secondary text-brown-mid hover:bg-beige-dark",
                  ].join(" ")}
                >
                  {m === "existente" ? "Reposição" : "Novo item"}
                </button>
              ))}
            </div>
          </div>

          {modo === "existente" ? (
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">
                Ingrediente do estoque *
              </label>
              {mps.length === 0 ? (
                <div className="text-xs text-muted-foreground bg-secondary/60 rounded-md p-3">
                  Nenhuma matéria-prima cadastrada. Use "Novo item" para começar.
                </div>
              ) : (
                <select
                  value={materiaPrimaId}
                  onChange={(e) => setMateriaPrimaId(e.target.value)}
                  className="ds-input"
                >
                  <option value="">Escolha...</option>
                  {mps.map((i: any) => (
                    <option key={i.id} value={i.id}>
                      {i.nome} — atual: {Number(i.quantidade_estoque)} {i.unidade}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-foreground mb-2 block">Nome *</label>
                <input
                  className="ds-input"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Castanha-do-pará"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">Unidade</label>
                <select
                  className="ds-input"
                  value={unidade}
                  onChange={(e) => setUnidade(e.target.value)}
                >
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="un">un</option>
                  <option value="lata">lata</option>
                  <option value="L">L</option>
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="text-sm font-semibold text-foreground mb-2 block">
                  Estoque mínimo
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  className="ds-input"
                  value={estoqueMinimo}
                  onChange={(e) => setEstoqueMinimo(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">
                Quantidade *
              </label>
              <input
                type="text"
                inputMode="decimal"
                className="ds-input"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">
                Valor total pago *
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                  R$
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={valorTotal}
                  onChange={(e) => setValorTotal(e.target.value)}
                  placeholder="50,00"
                  className="ds-input"
                  style={{ paddingLeft: "3rem" }}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground mb-2 block">Categoria</label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["materia-prima", "Matéria-prima"],
                  ["embalagens", "Embalagens"],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setCategoria(v)}
                  className={[
                    "py-2.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors",
                    categoria === v
                      ? "bg-primary text-primary-foreground shadow-warm-sm"
                      : "bg-secondary text-brown-mid hover:bg-beige-dark",
                  ].join(" ")}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground mb-2 block">
              Fornecedor (opcional)
            </label>
            <input
              className="ds-input"
              value={fornecedor}
              onChange={(e) => setFornecedor(e.target.value)}
              placeholder="Ex.: Mercado do João"
            />
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Data *</label>
              <input
                type="date"
                required
                className="ds-input"
                value={dataCompra}
                onChange={(e) => setDataCompra(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Pagamento</label>
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
              placeholder="Ex.: Compra mensal"
            />
          </div>
        </div>

        <div className="vovo-gradient border border-gold-light/40 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Custo por unidade
            </div>
            <div className="font-display text-3xl font-bold text-primary leading-none mt-1">
              {qtd > 0 && valor > 0 ? fmtBRL(custoUnit) : "—"}
            </div>
          </div>
          <div className="text-right text-xs text-brown-mid font-body flex items-center gap-2">
            <Package size={16} /> {qtd > 0 ? `+${qtd}` : "—"} ao estoque
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
                <Sparkles size={16} /> Confirmar compra
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
