import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiFn } from "@/lib/api-function";
import { ArrowLeft, Check, Cookie, Plus, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppShell } from "@/components/AppShell";
import {
  obterMateriaPrima,
  obterProduto,
  pesquisarMateriasPrimas,
  pesquisarProdutos,
} from "@/lib/catalogo.functions";
import { registrarProducao, proximoLote } from "@/lib/producoes.functions";
import { consumePrefill, type PrefillProducao } from "@/lib/voz-prefill";
import { hojeISO } from "@/lib/format";

export const Route = createFileRoute("/registrar/producao")({
  component: () => (
    <AppShell>
      <RegistrarProducao />
    </AppShell>
  ),
});

type IngForm = { materia_prima_id: string; quantidade_utilizada: string };

function RegistrarProducao() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fn = useApiFn(registrarProducao);

  const [buscaProduto, setBuscaProduto] = useState("");
  const [buscaMateria, setBuscaMateria] = useState("");
  const [buscaProdutoDebounced, setBuscaProdutoDebounced] = useState("");
  const [buscaMateriaDebounced, setBuscaMateriaDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setBuscaProdutoDebounced(buscaProduto), 300);
    return () => clearTimeout(t);
  }, [buscaProduto]);
  useEffect(() => {
    const t = setTimeout(() => setBuscaMateriaDebounced(buscaMateria), 300);
    return () => clearTimeout(t);
  }, [buscaMateria]);
  const { data: paginaProdutos, isFetching: buscandoProdutos } = useQuery({
    queryKey: ["produtos", "pesquisa", buscaProdutoDebounced],
    queryFn: () =>
      pesquisarProdutos({ data: { busca: buscaProdutoDebounced, pagina: 0, tamanho: 20 } }),
    placeholderData: (a) => a,
  });
  const { data: paginaMps, isFetching: buscandoMps } = useQuery({
    queryKey: ["materia_prima", "pesquisa", buscaMateriaDebounced],
    queryFn: () =>
      pesquisarMateriasPrimas({ data: { busca: buscaMateriaDebounced, pagina: 0, tamanho: 20 } }),
    placeholderData: (a) => a,
  });
  const { data: lote = 480 } = useQuery({
    queryKey: ["proximo_lote"],
    queryFn: () => proximoLote(),
  });

  const [produtoId, setProdutoId] = useState("");
  const [dataProducao, setDataProducao] = useState(hojeISO());
  const [potes, setPotes] = useState("");
  const [unidade, setUnidade] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [ingredientes, setIngredientes] = useState<IngForm[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const produtosEncontrados = paginaProdutos?.registros ?? [];
  const produtoJaCarregado = produtosEncontrados.some((item: any) => item.id === produtoId);
  const { data: produtoSelecionado } = useQuery({
    queryKey: ["produto", produtoId],
    queryFn: () => obterProduto({ data: { id: produtoId } }),
    enabled: Boolean(produtoId) && !produtoJaCarregado,
  });
  const idsMateriasSelecionadas = [
    ...new Set(ingredientes.map((item) => item.materia_prima_id).filter(Boolean)),
  ];
  const materiasEncontradas = paginaMps?.registros ?? [];
  const idsMateriasAusentes = idsMateriasSelecionadas.filter(
    (id) => !materiasEncontradas.some((item: any) => item.id === id),
  );
  const consultasMateriasSelecionadas = useQueries({
    queries: idsMateriasAusentes.map((id) => ({
      queryKey: ["materia_prima", id],
      queryFn: () => obterMateriaPrima({ data: { id } }),
      staleTime: 60_000,
    })),
  });
  const produtos = unirPorId(produtoSelecionado ? [produtoSelecionado] : [], produtosEncontrados);
  const mps = unirPorId(
    consultasMateriasSelecionadas.flatMap((consulta) => (consulta.data ? [consulta.data] : [])),
    materiasEncontradas,
  );

  useEffect(() => {
    const pre = consumePrefill<PrefillProducao>("producao");
    if (!pre) return;
    if (pre.produto_final_id) setProdutoId(pre.produto_final_id);
    if (pre.potes != null) setPotes(String(pre.potes));
    if (pre.unidade != null) setUnidade(String(pre.unidade));
    if (pre.observacoes) setObservacoes(pre.observacoes);
  }, []);

  const qtd = Number(potes) || 0;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!produtoId) return setErro("Escolha o produto produzido.");
    if (!potes || Number(potes) <= 0) return setErro("Informe a quantidade produzida.");
    if (!unidade) return setErro("Escolha o tamanho do pote.");
    if (qtd <= 0) return setErro("Quantidade deve ser maior que zero.");
    const ings = ingredientes
      .filter((i) => i.materia_prima_id && Number(i.quantidade_utilizada) > 0)
      .map((i) => ({
        materia_prima_id: i.materia_prima_id,
        quantidade_utilizada: Number(i.quantidade_utilizada.replace(",", ".")),
      }));

    try {
      await fn({
        data: {
          produto_final_id: produtoId,
          quantidade_produzida: qtd,
          data_producao: dataProducao,
          potes: Number(potes),
          unidade: unidade ? Number(unidade) : undefined,
          observacoes: observacoes || null,
          ingredientes: ings,
        },
      });
      qc.invalidateQueries({ queryKey: ["producoes"] });
      qc.invalidateQueries({ queryKey: ["produtos"] });
      qc.invalidateQueries({ queryKey: ["materia_prima"] });
      qc.invalidateQueries({ queryKey: ["proximo_lote"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOk(true);
      setTimeout(() => navigate({ to: "/producao" }), 800);
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
            Registrar produção
          </h1>
          <div className="text-xs text-muted-foreground font-body">Próximo lote: #{lote}</div>
        </div>
      </header>

      <form onSubmit={salvar} className="space-y-6">
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5 shadow-warm-sm">
          <div>
            <label className="text-sm font-semibold text-foreground mb-2 block">Produto *</label>
            <input
              className="ds-input mb-2"
              value={buscaProduto}
              onChange={(e) => setBuscaProduto(e.target.value)}
              placeholder="Buscar por nome ou SKU..."
            />
            <select
              className="ds-input"
              value={produtoId}
              onChange={(e) => setProdutoId(e.target.value)}
            >
              <option value="">Escolha...</option>
              {buscandoProdutos && <option disabled>Pesquisando...</option>}
              {produtos.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground mb-2 block">
              Data da produção *
            </label>
            <input
              type="date"
              required
              className="ds-input"
              value={dataProducao}
              onChange={(e) => setDataProducao(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">
                Quantidade de potes produzidos *
              </label>
              <select className="ds-input" value={potes} onChange={(e) => setPotes(e.target.value)}>
                <option value="">Selecione...</option>
                {Array.from({ length: 100 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">
                Tamanho do pote *
              </label>
              <Select required value={unidade} onValueChange={setUnidade}>
                <SelectTrigger className="w-full min-h-[48px] text-base">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent side="bottom">
                  <SelectItem value="44">44 uni.</SelectItem>
                  <SelectItem value="22">22 uni.</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-foreground">
                Ingredientes utilizados
              </label>
              <button
                type="button"
                onClick={() =>
                  setIngredientes((p) => [...p, { materia_prima_id: "", quantidade_utilizada: "" }])
                }
                className="text-xs font-bold text-primary inline-flex items-center gap-1"
              >
                <Plus size={14} /> Adicionar
              </button>
            </div>
            {ingredientes.length === 0 ? (
              <div className="text-xs text-muted-foreground bg-secondary/60 rounded-md p-3">
                Opcional. Adicione ingredientes para baixar do estoque automaticamente.
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  className="ds-input"
                  value={buscaMateria}
                  onChange={(e) => setBuscaMateria(e.target.value)}
                  placeholder="Buscar matéria-prima..."
                />
                {buscandoMps && (
                  <div className="text-xs text-muted-foreground">
                    Pesquisando matérias-primas...
                  </div>
                )}
                {ingredientes.map((ing, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_90px_auto] gap-2">
                    <select
                      className="ds-input"
                      value={ing.materia_prima_id}
                      onChange={(e) =>
                        setIngredientes((p) =>
                          p.map((it, i) =>
                            i === idx ? { ...it, materia_prima_id: e.target.value } : it,
                          ),
                        )
                      }
                    >
                      <option value="">Ingrediente...</option>
                      {mps.map((m: any) => (
                        <option key={m.id} value={m.id}>
                          {m.nome} ({m.unidade})
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="ds-input"
                      placeholder="Qtd"
                      value={ing.quantidade_utilizada}
                      onChange={(e) =>
                        setIngredientes((p) =>
                          p.map((it, i) =>
                            i === idx ? { ...it, quantidade_utilizada: e.target.value } : it,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setIngredientes((p) => p.filter((_, i) => i !== idx))}
                      className="w-10 h-10 rounded-md text-error hover:bg-error-bg"
                      aria-label={`Remover ingrediente ${idx + 1}`}
                    >
                      <Trash2 size={16} className="mx-auto" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground mb-2 block">Observações</label>
            <textarea
              rows={3}
              className="ds-input"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ponto, sabor, alguma curiosidade..."
            />
          </div>
        </div>

        <div className="vovo-gradient border border-gold-light/40 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Lote #{lote}
            </div>
            <div className="font-display text-3xl font-bold text-primary leading-none mt-1">
              {qtd > 0 ? `${qtd} un` : "—"}
            </div>
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
                <Cookie size={16} /> Confirmar produção
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function unirPorId<T extends { id: string }>(fixos: T[], resultados: T[]): T[] {
  return [...fixos, ...resultados.filter((item) => !fixos.some((fixo) => fixo.id === item.id))];
}
