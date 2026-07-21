import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiFn } from "@/lib/api-function";
import { Check, Sparkles, ArrowLeft, Pencil, Plus, Trash2, UserPlus, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { obterProduto, pesquisarProdutos } from "@/lib/catalogo.functions";
import { criarCliente, pesquisarClientes } from "@/lib/clientes.functions";
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
type TipoCartao = "CREDITO" | "DEBITO";
type ItemForm = {
  produto_final_id: string;
  quantidade: string;
  preco_unitario: string;
  tipo: TipoVenda;
};

type Cliente = {
  id: string;
  nome: string;
  documento: string;
  email: string;
  telefone: string;
};

type ClienteRapidoForm = Omit<Cliente, "id">;

const clienteRapidoInicial: ClienteRapidoForm = {
  nome: "",
  documento: "",
  email: "",
  telefone: "",
};

const POTES_POR_CAIXA = 6;

const PRECO_POTE_FIXO: Record<string, number> = {
  "Fondant de leite palito": 21.3,
  "Fondant de leite": 20.7,
  "Foundant de leite palito": 21.3,
  "Foundant de leite": 20.7,
  "Foundant palito": 21.3,
  Foundant: 20.7,
  "Fondant palito": 21.3,
  Fondant: 20.7,
  "Fouandant de leite palito": 21.3,
  "Fouandant de leite": 20.7,
  "Fouandant palito": 21.3,
  Fouandant: 20.7,
  "Biriba palito": 19.7,
  Biriba: 19.7,
  "Paçoca Caseira palito": 18.7,
  "Paçoca Caseira": 18.7,
  Paçoca: 18.7,
  Pacoca: 18.7,
};

function RegistrarVenda() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fnRegistrar = useApiFn(registrarVenda);
  const fnCriarCliente = useApiFn(criarCliente);
  const produtoRefs = useRef<Array<HTMLSelectElement | null>>([]);
  const quantidadeRefs = useRef<Array<HTMLInputElement | null>>([]);

  const [itens, setItens] = useState<ItemForm[]>([
    { produto_final_id: "", quantidade: "1", preco_unitario: "", tipo: "pote" },
  ]);
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [tipoCartao, setTipoCartao] = useState<TipoCartao | null>(null);
  const [parcelas, setParcelas] = useState("1");
  const [dataVenda, setDataVenda] = useState(hojeISO());
  const [dataVencimento, setDataVencimento] = useState("");
  const [statusPagamento, setStatusPagamento] = useState<StatusPagamento>("PAGO");
  const [cliente, setCliente] = useState("");
  const [buscaCliente, setBuscaCliente] = useState("");
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [sugestaoAtiva, setSugestaoAtiva] = useState(0);
  const [modalClienteAberto, setModalClienteAberto] = useState(false);
  const [clienteRapido, setClienteRapido] = useState<ClienteRapidoForm>(clienteRapidoInicial);
  const [erroClienteRapido, setErroClienteRapido] = useState<string | null>(null);
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [buscaProduto, setBuscaProduto] = useState("");
  const [buscaProdutoDebounced, setBuscaProdutoDebounced] = useState("");
  const [produtosSelecionados, setProdutosSelecionados] = useState<any[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setBuscaProdutoDebounced(buscaProduto.trim()), 300);
    return () => clearTimeout(t);
  }, [buscaProduto]);
  const { data: paginaProdutos, isFetching: pesquisandoProdutos } = useQuery({
    queryKey: ["produtos", "seletor-venda", buscaProdutoDebounced],
    queryFn: () =>
      pesquisarProdutos({ data: { busca: buscaProdutoDebounced, pagina: 0, tamanho: 20 } }),
    placeholderData: (a) => a,
  });
  const idsProdutosSelecionados = [
    ...new Set(itens.map((item) => item.produto_final_id).filter(Boolean)),
  ];
  const produtosEncontrados = paginaProdutos?.registros ?? [];
  const idsProdutosAusentes = idsProdutosSelecionados.filter(
    (id) =>
      !produtosSelecionados.some((produto) => produto.id === id) &&
      !produtosEncontrados.some((produto: any) => produto.id === id),
  );
  const consultasProdutosSelecionados = useQueries({
    queries: idsProdutosAusentes.map((id) => ({
      queryKey: ["produto", id],
      queryFn: () => obterProduto({ data: { id } }),
      staleTime: 60_000,
    })),
  });
  const produtosFixos = [
    ...produtosSelecionados,
    ...consultasProdutosSelecionados.flatMap((consulta) => (consulta.data ? [consulta.data] : [])),
  ].filter(
    (produto, indice, todos) => todos.findIndex((item) => item.id === produto.id) === indice,
  );
  const produtos = [
    ...produtosFixos,
    ...produtosEncontrados.filter((p: any) => !produtosFixos.some((s) => s.id === p.id)),
  ];

  useEffect(() => {
    const timer = window.setTimeout(() => setBuscaCliente(cliente.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [cliente]);

  const { data: paginaClientes, isFetching: pesquisandoClientes } = useQuery({
    queryKey: ["clientes", "pesquisa", buscaCliente],
    queryFn: () => pesquisarClientes({ data: { busca: buscaCliente, pagina: 0, tamanho: 20 } }),
    enabled: buscaCliente.length >= 2 && !clienteId,
    placeholderData: (anterior) => anterior,
  });
  const clientes = useMemo(
    () => (paginaClientes?.registros ?? []) as Cliente[],
    [paginaClientes?.registros],
  );

  useEffect(() => {
    const pre = consumePrefill<PrefillVenda>("venda");
    if (!pre) return;
    if (pre.forma_pagamento) setForma(pre.forma_pagamento);
    if (pre.comprador) setCliente(pre.comprador);
    const duplicacao = pre as PrefillVenda & { cliente_id?: string; avisos?: string[] };
    if (duplicacao.cliente_id) setClienteId(duplicacao.cliente_id);
    if (duplicacao.avisos?.length) setErro(duplicacao.avisos.join(" "));
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
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setTimeout(() => navigate({ to: "/vendas" }), 800);
    },
    onError: (err: Error) => setErro(err.message),
  });

  const criarClienteMutation = useMutation({
    mutationFn: (data: ClienteRapidoForm) => fnCriarCliente({ data }),
    onSuccess: (novoCliente) => {
      qc.invalidateQueries({ queryKey: ["clientes"] });
      selecionarCliente(novoCliente);
      setClienteRapido(clienteRapidoInicial);
      setErroClienteRapido(null);
      setModalClienteAberto(false);
    },
    onError: (err: Error) => setErroClienteRapido(err.message),
  });

  const itensCalculados = itens.map((i) => {
    const prod = produtos.find((p: any) => p.id === i.produto_final_id);
    const q = Number(i.quantidade) || 0;
    const potes = i.tipo === "caixa" ? q * POTES_POR_CAIXA : q;
    const p = Number(i.preco_unitario.replace(",", ".")) || 0;
    const estoque = Number((prod as any)?.quantidade_estoque) || 0;
    return {
      ...i,
      nome: (prod as any)?.nome ?? "—",
      subtotal: potes * p,
      qtd: q,
      potes,
      preco: p,
      estoque,
      estoqueInsuficiente: Boolean(i.produto_final_id) && potes > estoque,
    };
  });
  const total = itensCalculados.reduce((s, i) => s + i.subtotal, 0);

  const sugestoesCliente = useMemo(() => {
    const termo = cliente.trim().toLowerCase();
    if (termo.length < 2) return [];
    return clientes
      .filter((c: any) => {
        return (
          c.nome?.toLowerCase().includes(termo) ||
          c.email?.toLowerCase().includes(termo) ||
          c.documento?.toLowerCase().includes(termo) ||
          c.telefone?.toLowerCase().includes(termo)
        );
      })
      .slice(0, 6);
  }, [cliente, clientes]);

  function atualizarItem(idx: number, patch: Partial<ItemForm>) {
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function adicionarItem() {
    const novoIndice = itens.length;
    setItens((atuais) => [
      ...atuais,
      { produto_final_id: "", quantidade: "1", preco_unitario: "", tipo: "pote" },
    ]);
    window.setTimeout(() => produtoRefs.current[novoIndice]?.focus(), 0);
  }

  function selecionarProduto(idx: number, id: string) {
    if (id && itens.some((item, itemIdx) => itemIdx !== idx && item.produto_final_id === id)) {
      setErro("Este produto já está na venda. Ajuste a quantidade no item existente.");
      return;
    }
    const p = produtos.find((p: any) => p.id === id) as any;
    const nome: string = p?.nome ?? "";
    const nomeLower = nome.toLowerCase();

    let precoFixo: number | undefined = undefined;

    if (
      nomeLower.includes("fondant") ||
      nomeLower.includes("foundant") ||
      nomeLower.includes("fouandant")
    ) {
      precoFixo = nomeLower.includes("palito") ? 21.3 : 20.7;
    } else if (nomeLower.includes("biriba")) {
      precoFixo = 19.7;
    } else if (nomeLower.includes("paçoca") || nomeLower.includes("pacoca")) {
      precoFixo = 18.7;
    }

    const preco =
      precoFixo !== undefined
        ? precoFixo.toFixed(2).replace(".", ",")
        : p?.preco_venda
          ? Number(p.preco_venda).toFixed(2).replace(".", ",")
          : "";

    atualizarItem(idx, { produto_final_id: id, preco_unitario: preco });
    setErro(null);
    window.setTimeout(() => quantidadeRefs.current[idx]?.focus(), 0);
  }

  function selecionarCliente(c: any) {
    setCliente(c.nome);
    setClienteId(String(c.id));
    setMostrarSugestoes(false);
    setSugestaoAtiva(0);
    setErro(null);
    window.setTimeout(() => produtoRefs.current[0]?.focus(), 0);
  }

  function alterarCliente(valor: string) {
    setCliente(valor);
    setClienteId(null); // digitou algo novo, desassocia até selecionar de novo
    setMostrarSugestoes(true);
    setSugestaoAtiva(0);
  }

  function abrirCadastroCliente() {
    setClienteRapido({ ...clienteRapidoInicial, nome: cliente.trim() });
    setErroClienteRapido(null);
    setMostrarSugestoes(false);
    setModalClienteAberto(true);
  }

  function salvarClienteRapido(e: React.FormEvent) {
    e.preventDefault();
    setErroClienteRapido(null);
    if (!clienteRapido.nome.trim()) {
      setErroClienteRapido("Informe o nome ou a razão social do cliente.");
      return;
    }
    if (!clienteRapido.telefone.trim()) {
      setErroClienteRapido("Informe o telefone do cliente.");
      return;
    }
    if (!clienteRapido.email.trim()) {
      setErroClienteRapido("Informe o e-mail do cliente.");
      return;
    }
    criarClienteMutation.mutate({
      nome: clienteRapido.nome.trim(),
      documento: clienteRapido.documento.trim(),
      email: clienteRapido.email.trim(),
      telefone: clienteRapido.telefone.trim(),
    });
  }

  function navegarSugestoes(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!mostrarSugestoes) return;
    if (e.key === "ArrowDown" && sugestoesCliente.length > 0) {
      e.preventDefault();
      setSugestaoAtiva((atual) => (atual + 1) % sugestoesCliente.length);
    } else if (e.key === "ArrowUp" && sugestoesCliente.length > 0) {
      e.preventDefault();
      setSugestaoAtiva((atual) => (atual - 1 + sugestoesCliente.length) % sugestoesCliente.length);
    } else if (e.key === "Enter" && sugestoesCliente.length > 0) {
      e.preventDefault();
      selecionarCliente(sugestoesCliente[sugestaoAtiva] ?? sugestoesCliente[0]);
    } else if (e.key === "Escape") {
      setMostrarSugestoes(false);
    }
  }

  function abrirConfirmacao(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!clienteId) return setErro("Selecione um cliente na lista para continuar com a venda.");
    if (itens.some((i) => !i.produto_final_id))
      return setErro("Escolha o produto em todos os itens.");
    if (itensCalculados.some((i) => i.qtd <= 0 || i.preco <= 0))
      return setErro("Verifique quantidades e preços.");
    const semEstoque = itensCalculados.find((i) => i.estoqueInsuficiente);
    if (semEstoque)
      return setErro(
        `Estoque insuficiente para ${semEstoque.nome}: disponível ${semEstoque.estoque}, solicitado ${semEstoque.potes}.`,
      );
    if (statusPagamento === "PENDENTE" && !dataVencimento)
      return setErro("Informe a data de vencimento para vendas pendentes.");
    if (forma === "cartao" && !tipoCartao)
      return setErro("Escolha se o pagamento no cartão foi Crédito ou Débito.");
    if (forma === "cartao" && tipoCartao === "CREDITO" && (!parcelas || Number(parcelas) < 1))
      return setErro("Informe a quantidade de parcelas.");
    setConfirmar(true);
  }

  function salvar() {
    mutation.mutate({
      data: {
        comprador: cliente.trim(),
        cliente_id: clienteId!,
        data_venda: dataVenda,
        forma_pagamento: forma,
        status_pagamento: statusPagamento,
        data_vencimento: statusPagamento === "PENDENTE" ? dataVencimento : null,
        tipo_cartao: forma === "cartao" ? tipoCartao : null,
        parcelas: forma === "cartao" && tipoCartao === "CREDITO" ? Number(parcelas) : null,
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
    <div className="max-w-5xl space-y-8">
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

      <form
        onSubmit={abrirConfirmacao}
        className="space-y-6 pb-28 md:grid md:grid-cols-[minmax(0,1fr)_18rem] md:items-start md:gap-6 md:space-y-0 md:pb-0"
      >
        <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-warm-sm md:col-start-1 md:row-start-1">
          <div className="order-2 space-y-3">
            <label className="text-sm font-semibold text-foreground">Itens da venda</label>
            <input
              className="ds-input"
              value={buscaProduto}
              onChange={(e) => setBuscaProduto(e.target.value)}
              placeholder="Buscar produto por nome ou SKU..."
            />
            {pesquisandoProdutos && (
              <div className="text-xs text-muted-foreground">Pesquisando produtos...</div>
            )}
            {itens.map((it, idx) => (
              <div key={idx} className="space-y-2 border border-border rounded-lg p-3">
                <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                  <select
                    ref={(element) => {
                      produtoRefs.current[idx] = element;
                    }}
                    className="ds-input"
                    value={it.produto_final_id}
                    onChange={(e) => {
                      const escolhido = produtos.find((p: any) => p.id === e.target.value);
                      if (escolhido)
                        setProdutosSelecionados((a) =>
                          a.some((p) => p.id === escolhido.id) ? a : [...a, escolhido],
                        );
                      selecionarProduto(idx, e.target.value);
                    }}
                  >
                    <option value="">Escolha o produto...</option>
                    {produtos.map((p: any) => (
                      <option
                        key={p.id}
                        value={p.id}
                        disabled={itens.some(
                          (item, itemIdx) =>
                            itemIdx !== idx && item.produto_final_id === String(p.id),
                        )}
                      >
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
                          ref={(element) => {
                            quantidadeRefs.current[idx] = element;
                          }}
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
                        {itensCalculados[idx]?.estoqueInsuficiente && (
                          <div className="mt-1 text-center text-sm font-semibold text-error">
                            Estoque insuficiente: {itensCalculados[idx].estoque} potes disponíveis.
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
              onClick={adicionarItem}
              className="text-xs font-bold text-primary inline-flex items-center gap-1"
            >
              <Plus size={14} /> Adicionar item
            </button>
          </div>

          <div className="order-3">
            <label className="text-sm font-semibold text-foreground mb-2 block">
              Forma de pagamento
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(["dinheiro", "pix", "cartao", "boleto", "outro"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    setForma(f);
                    if (f !== "cartao") {
                      setTipoCartao(null);
                      setParcelas("1");
                    }
                  }}
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

            {forma === "cartao" && (
              <div className="mt-3 space-y-3 border border-border rounded-lg p-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                    Crédito ou débito?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["CREDITO", "DEBITO"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTipoCartao(t)}
                        className={[
                          "py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-colors",
                          tipoCartao === t
                            ? "bg-primary text-primary-foreground shadow-warm-sm"
                            : "bg-secondary text-brown-mid hover:bg-beige-dark",
                        ].join(" ")}
                      >
                        {t === "CREDITO" ? "Crédito" : "Débito"}
                      </button>
                    ))}
                  </div>
                </div>
                {tipoCartao === "CREDITO" && (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                      Quantas parcelas?
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      className="ds-input"
                      value={parcelas}
                      onChange={(e) => setParcelas(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="order-4 grid gap-4 sm:grid-cols-2">
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
                <option value="NAO_SE_APLICA">Não se aplica</option>
              </select>
            </div>
          </div>

          {statusPagamento === "PENDENTE" && (
            <div className="order-4">
              <label className="text-sm font-semibold text-foreground mb-2 block">
                Data de vencimento *
              </label>
              <input
                type="date"
                required
                className="ds-input"
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Se passar dessa data sem pagamento, a venda aparece como "Em atraso" na tela de
                Vendas.
              </p>
            </div>
          )}

          <div className="relative order-1">
            <label className="text-sm font-semibold text-foreground mb-2 block">Cliente *</label>
            {clienteId ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-secondary/50 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Check size={15} className="shrink-0 text-primary" />
                    <span className="truncate">{cliente}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    Cliente vinculado à venda
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => alterarCliente("")}
                  className="shrink-0 text-xs font-bold text-primary hover:underline"
                >
                  Trocar
                </button>
              </div>
            ) : (
              <input
                className="ds-input"
                value={cliente}
                onChange={(e) => alterarCliente(e.target.value)}
                onFocus={() => setMostrarSugestoes(true)}
                onBlur={() => setTimeout(() => setMostrarSugestoes(false), 150)}
                onKeyDown={navegarSugestoes}
                placeholder="Nome, CPF, CNPJ ou e-mail..."
                autoComplete="off"
                role="combobox"
                aria-expanded={mostrarSugestoes}
                aria-controls="sugestoes-clientes"
                aria-autocomplete="list"
              />
            )}
            {!clienteId && mostrarSugestoes && cliente.trim().length >= 2 && (
              <div
                id="sugestoes-clientes"
                role="listbox"
                className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-warm-sm"
              >
                {sugestoesCliente.map((c, index) => (
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    aria-selected={index === sugestaoAtiva}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selecionarCliente(c)}
                    onMouseEnter={() => setSugestaoAtiva(index)}
                    className={[
                      "w-full px-3 py-2 text-left text-sm",
                      index === sugestaoAtiva ? "bg-secondary" : "hover:bg-secondary",
                    ].join(" ")}
                  >
                    <div className="font-semibold text-foreground">{c.nome}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {[c.documento, c.email, c.telefone].filter(Boolean).join(" · ")}
                    </div>
                  </button>
                ))}
                {pesquisandoClientes && (
                  <div className="px-3 py-3 text-xs text-muted-foreground">
                    Pesquisando clientes...
                  </div>
                )}
                {!pesquisandoClientes && sugestoesCliente.length === 0 && (
                  <>
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      Nenhum cliente encontrado.
                    </div>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={abrirCadastroCliente}
                      className="flex w-full items-center gap-2 border-t border-border px-3 py-3 text-left text-sm font-bold text-primary hover:bg-secondary"
                    >
                      <UserPlus size={16} /> Criar novo cliente
                    </button>
                  </>
                )}
              </div>
            )}
            {!clienteId && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Digite pelo menos 2 caracteres e selecione um cliente da lista.
              </p>
            )}
          </div>

          <div className="order-5">
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

        <div className="vovo-gradient fixed bottom-16 left-4 right-4 z-20 flex items-center justify-between rounded-2xl border border-gold-light/40 p-4 shadow-warm-md md:sticky md:top-6 md:bottom-auto md:left-auto md:right-auto md:col-start-2 md:row-start-1 md:p-5">
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
          <div className="rounded-md border-l-4 border-error bg-error-bg px-4 py-3 text-sm font-medium text-error md:col-start-1">
            {erro}
          </div>
        )}

        <div className="flex gap-3 md:col-start-1">
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
                {forma === "cartao" && tipoCartao && (
                  <>
                    {" "}
                    (<strong>{tipoCartao === "CREDITO" ? "Crédito" : "Débito"}</strong>
                    {tipoCartao === "CREDITO" && ` · ${parcelas}x`})
                  </>
                )}
                {cliente && (
                  <>
                    {" "}
                    · Para <strong>{cliente}</strong>
                  </>
                )}
                {statusPagamento === "PENDENTE" && dataVencimento && (
                  <>
                    {" "}
                    · Vence em <strong>{dataVencimento.split("-").reverse().join("/")}</strong>
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

      {modalClienteAberto && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm md:items-center md:p-4"
          onClick={() => !criarClienteMutation.isPending && setModalClienteAberto(false)}
        >
          <div
            className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-card shadow-warm-lg md:max-w-lg md:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="font-display text-xl font-bold text-primary">Novo cliente</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  O cliente será vinculado automaticamente a esta venda.
                </p>
              </div>
              <button
                type="button"
                disabled={criarClienteMutation.isPending}
                onClick={() => setModalClienteAberto(false)}
                aria-label="Fechar cadastro de cliente"
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-secondary disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={salvarClienteRapido} className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-semibold text-foreground">
                  Nome ou razão social *
                </label>
                <input
                  autoFocus
                  className="ds-input"
                  value={clienteRapido.nome}
                  onChange={(e) => setClienteRapido({ ...clienteRapido, nome: e.target.value })}
                  placeholder="Ex.: Mercado da Maria"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-foreground">
                  CPF ou CNPJ
                </label>
                <input
                  className="ds-input"
                  value={clienteRapido.documento}
                  onChange={(e) =>
                    setClienteRapido({ ...clienteRapido, documento: e.target.value })
                  }
                  placeholder="Somente se disponível"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-foreground">
                    E-mail *
                  </label>
                  <input
                    type="email"
                    required
                    className="ds-input"
                    value={clienteRapido.email}
                    onChange={(e) => setClienteRapido({ ...clienteRapido, email: e.target.value })}
                    placeholder="cliente@email.com"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-foreground">
                    Telefone *
                  </label>
                  <input
                    type="tel"
                    required
                    className="ds-input"
                    value={clienteRapido.telefone}
                    onChange={(e) =>
                      setClienteRapido({ ...clienteRapido, telefone: e.target.value })
                    }
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
              {erroClienteRapido && (
                <div className="rounded-md border-l-4 border-error bg-error-bg px-4 py-3 text-sm font-medium text-error">
                  {erroClienteRapido}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={criarClienteMutation.isPending}
                  onClick={() => setModalClienteAberto(false)}
                  className="rounded-md border border-border bg-card px-5 py-3 text-sm font-semibold text-brown-mid hover:bg-secondary disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={criarClienteMutation.isPending}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-warm-sm hover:bg-primary-dark disabled:opacity-60"
                >
                  {criarClienteMutation.isPending ? (
                    "Salvando..."
                  ) : (
                    <>
                      <Check size={16} /> Salvar e vincular
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
