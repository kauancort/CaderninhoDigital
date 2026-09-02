import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiFn } from "@/lib/api-function";
import { AlertTriangle, ArrowLeft, Plus, Trash2, UserPlus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { obterProduto, pesquisarProdutos } from "@/lib/catalogo.functions";
import {
  criarCliente,
  pesquisarClientes,
  buscarTransportadoraCliente,
} from "@/lib/clientes.functions";
import { registrarVenda, listarVendasAguardandoEstoque } from "@/lib/vendas.functions";
import { fmtBRL, hojeISO, type FormaPagamento, type StatusPagamento } from "@/lib/format";
import { consumePrefill, type PrefillVenda } from "@/lib/voz-prefill";
import { ClienteFormModal } from "@/components/clientes/ClienteFormModal";
import { clienteFormVazio, type ClienteFormData } from "@/lib/cliente-form";
import { toast } from "sonner";

export const Route = createFileRoute("/registrar/venda")({
  component: () => (
    <AppShell>
      <RegistrarVenda />
    </AppShell>
  ),
});

type TipoVenda = "pote" | "caixa";
type TamanhoPote = "22" | "44";
type TipoCartao = "CREDITO" | "DEBITO";

type ItemForm = {
  produto_final_id: string;
  is_avulso?: boolean;
  nome_avulso?: string;
  quantidade: string;
  preco_unitario: string;
  tipo: TipoVenda;
  tamanho_pote: TamanhoPote;
};

type Cliente = {
  id: string;
  nome: string;
  documento: string;
  email: string;
  telefone: string;
  endereco: string;
  numero: string;
  complemento: string;
  cep: string;
  bairro: string;
  cidade: string;
  estado: string;
};

type ClienteRapidoForm = ClienteFormData;
const clienteRapidoInicial = clienteFormVazio;

const POTES_POR_CAIXA = 6;

// Tabela de preços dinâmicos com base na variação e tamanho
function obterPrecoPote(nomeProduto: string, tamanho: TamanhoPote): number | undefined {
  const nomeLower = nomeProduto.toLowerCase();

  if (
    nomeLower.includes("fondant") ||
    nomeLower.includes("foundant") ||
    nomeLower.includes("fouandant")
  ) {
    return tamanho === "22" ? 20.7 : 21.3;
  }
  if (nomeLower.includes("biriba")) {
    return 19.7;
  }
  if (nomeLower.includes("paçoca") || nomeLower.includes("pacoca")) {
    return 18.7;
  }

  return undefined;
}

function RegistrarVenda() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fnRegistrar = useApiFn(registrarVenda);
  const fnCriarCliente = useApiFn(criarCliente);
  const produtoRefs = useRef<Array<HTMLSelectElement | null>>([]);
  const quantidadeRefs = useRef<Array<HTMLInputElement | null>>([]);

  const [itens, setItens] = useState<ItemForm[]>([
    {
      produto_final_id: "",
      quantidade: "1",
      preco_unitario: "",
      tipo: "pote",
      tamanho_pote: "44",
      is_avulso: false,
      nome_avulso: "",
    },
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
  const [formaEnvio, setFormaEnvio] = useState<"RETIRADA" | "PROPRIO" | "TRANSPORTADORA">(
    "RETIRADA",
  );
  const [quilometragemManual, setQuilometragemManual] = useState("");
  const [custoEnvio, setCustoEnvio] = useState("");
  const [responsavelEntrega, setResponsavelEntrega] = useState("");
  const [dataEnvio, setDataEnvio] = useState("");
  const [previsaoEntrega, setPrevisaoEntrega] = useState("");
  const [codigoRastreamento, setCodigoRastreamento] = useState("");
  const [transportadora, setTransportadora] = useState({
    nome: "",
    cnpj: "",
    telefone: "",
    email: "",
    cep: "",
    endereco: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    observacao: "",
  });
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

  const { data: paginaClientes } = useQuery({
    queryKey: ["clientes", "pesquisa", buscaCliente],
    queryFn: () => pesquisarClientes({ data: { busca: buscaCliente, pagina: 0, tamanho: 20 } }),
    enabled: buscaCliente.length >= 2 && !clienteId,
    placeholderData: (anterior) => anterior,
  });

  const clientes = useMemo(
    () => (paginaClientes?.registros ?? []) as Cliente[],
    [paginaClientes?.registros],
  );

  const clienteSelecionado = useMemo(
    () => clientes.find((c) => String(c.id) === String(clienteId)) ?? null,
    [clientes, clienteId],
  );

  const transportadoraQuery = useQuery({
    queryKey: ["clientes", "transportadora", clienteId],
    queryFn: () => buscarTransportadoraCliente(clienteId!),
    enabled: Boolean(clienteId && formaEnvio === "TRANSPORTADORA"),
  });

  const [distanciaAutomatica, setDistanciaAutomatica] = useState<number | null>(null);
  const [calculandoDistancia, setCalculandoDistancia] = useState(false);
  const [erroDistancia, setErroDistancia] = useState<string | null>(null);
  const enderecoFabrica = String(import.meta.env.VITE_FABRICA_ENDERECO ?? "").trim();
  const custoPorKm = Number(import.meta.env.VITE_CUSTO_KM_ENTREGA_PROPRIA ?? 2);
  const limiteCustoEntrega = Number(import.meta.env.VITE_LIMITE_CUSTO_ENTREGA_PROPRIA ?? 50);
  const distanciaManualNumero = Number(quilometragemManual.replace(",", "."));
  const distanciaEntrega =
    Number.isFinite(distanciaManualNumero) && distanciaManualNumero > 0
      ? distanciaManualNumero
      : distanciaAutomatica;
  const custoEstimadoEntrega = distanciaEntrega != null ? distanciaEntrega * custoPorKm : null;
  const entregaViavel =
    custoEstimadoEntrega != null ? custoEstimadoEntrega <= limiteCustoEntrega : null;

  useEffect(() => {
    if (formaEnvio !== "PROPRIO" || !clienteSelecionado || !enderecoFabrica) {
      setDistanciaAutomatica(null);
      setErroDistancia(null);
      return;
    }

    let cancelado = false;
    setCalculandoDistancia(true);
    setErroDistancia(null);

    async function geocodificar(endereco: string) {
      const params = new URLSearchParams({ format: "jsonv2", limit: "1", q: endereco });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
      if (!response.ok) throw new Error("Não foi possível consultar a localização.");
      const dados = await response.json();
      if (!dados[0]) throw new Error("Endereço não localizado.");
      return { lat: Number(dados[0].lat), lon: Number(dados[0].lon) };
    }

    const enderecoCliente = [
      clienteSelecionado.endereco,
      clienteSelecionado.numero,
      clienteSelecionado.bairro,
      clienteSelecionado.cidade,
      clienteSelecionado.estado,
      clienteSelecionado.cep,
      "Brasil",
    ]
      .filter(Boolean)
      .join(", ");

    Promise.all([geocodificar(enderecoFabrica), geocodificar(enderecoCliente)])
      .then(([origem, destino]) => {
        if (cancelado) return;
        const toRad = (value: number) => (value * Math.PI) / 180;
        const dLat = toRad(destino.lat - origem.lat);
        const dLon = toRad(destino.lon - origem.lon);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(origem.lat)) * Math.cos(toRad(destino.lat)) * Math.sin(dLon / 2) ** 2;
        const distancia = 2 * 6371 * Math.asin(Math.sqrt(a));
        setDistanciaAutomatica(Number(distancia.toFixed(1)));
      })
      .catch((error) => {
        if (!cancelado)
          setErroDistancia(
            error instanceof Error ? error.message : "Não foi possível calcular a distância.",
          );
      })
      .finally(() => {
        if (!cancelado) setCalculandoDistancia(false);
      });

    return () => {
      cancelado = true;
    };
  }, [formaEnvio, clienteSelecionado, enderecoFabrica]);

  // Vendas já salvas que ficaram aguardando produção (cards amarelos persistentes)
  const { data: vendasAguardandoEstoque = [] } = useQuery({
    queryKey: ["vendas", "aguardando-estoque"],
    queryFn: () => listarVendasAguardandoEstoque(),
  });

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
          tamanho_pote: "44",
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
      toast.success("Cliente cadastrado e vinculado à venda.");
    },
    onError: (err: Error) => setErroClienteRapido(err.message),
  });

  const itensCalculados = itens.map((i) => {
    if (i.is_avulso) {
      const q = Number(i.quantidade) || 0;
      const p = Number(i.preco_unitario.replace(",", ".")) || 0;
      return {
        ...i,
        nome: i.nome_avulso || "Item Avulso",
        subtotal: q * p,
        qtd: q,
        potes: q,
        preco: p,
        estoque: Infinity,
        estoqueInsuficiente: false,
      };
    }

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

  // Verifica se há algum produto com estoque insuficiente
  const temItemPendente = itensCalculados.some((i) => i.estoqueInsuficiente);

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
    setItens((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const itemAtualizado = { ...it, ...patch };

        // Se mudou o tamanho do pote ou o produto, recalcular preço automaticamente
        if (patch.tamanho_pote !== undefined || patch.produto_final_id !== undefined) {
          const p = produtos.find(
            (prod: any) => prod.id === itemAtualizado.produto_final_id,
          ) as any;
          if (p?.nome) {
            const precoCalculado = obterPrecoPote(p.nome, itemAtualizado.tamanho_pote);
            if (precoCalculado !== undefined) {
              itemAtualizado.preco_unitario = precoCalculado.toFixed(2).replace(".", ",");
            }
          }
        }
        return itemAtualizado;
      }),
    );
  }

  function adicionarItem() {
    const novoIndice = itens.length;
    setItens((atuais) => [
      ...atuais,
      {
        produto_final_id: "",
        quantidade: "1",
        preco_unitario: "",
        tipo: "pote",
        tamanho_pote: "44",
        is_avulso: false,
        nome_avulso: "",
      },
    ]);
    window.setTimeout(() => produtoRefs.current[novoIndice]?.focus(), 0);
  }

  function selecionarProduto(idx: number, id: string) {
    if (id && itens.some((item, itemIdx) => itemIdx !== idx && item.produto_final_id === id)) {
      setErro("Este produto já está na venda. Ajuste a quantidade no item existente.");
      return;
    }
    const p = produtos.find((prod: any) => prod.id === id) as any;
    const itemAtual = itens[idx];
    const tamanho = itemAtual?.tamanho_pote ?? "44";

    let precoStr = "";
    if (p?.nome) {
      const precoFixo = obterPrecoPote(p.nome, tamanho);
      precoStr =
        precoFixo !== undefined
          ? precoFixo.toFixed(2).replace(".", ",")
          : p?.preco_venda
            ? Number(p.preco_venda).toFixed(2).replace(".", ",")
            : "";
    }

    atualizarItem(idx, { produto_final_id: id, preco_unitario: precoStr });
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
    setClienteId(null);
    setMostrarSugestoes(true);
    setSugestaoAtiva(0);
  }

  function abrirCadastroCliente() {
    setClienteRapido({ ...clienteRapidoInicial, nome: cliente.trim() });
    setErroClienteRapido(null);
    setMostrarSugestoes(false);
    setModalClienteAberto(true);
  }

  function salvarClienteRapido(clienteCompleto: ClienteRapidoForm) {
    setErroClienteRapido(null);
    criarClienteMutation.mutate(clienteCompleto);
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

    for (let idx = 0; idx < itens.length; idx++) {
      const it = itens[idx];
      if (it.is_avulso) {
        if (!it.nome_avulso?.trim()) {
          return setErro(`Digite a descrição/nome do item avulso ${idx + 1}.`);
        }
      } else {
        if (!it.produto_final_id) {
          return setErro(`Escolha o produto no item ${idx + 1}.`);
        }
      }

      if (!it.quantidade || Number(it.quantidade) <= 0) {
        return setErro(`A quantidade no item ${idx + 1} é obrigatória e deve ser maior que zero.`);
      }

      const preco = Number(it.preco_unitario.replace(",", "."));
      if (isNaN(preco) || preco <= 0) {
        return setErro(`O preço no item ${idx + 1} deve ser válido e maior que zero.`);
      }
    }

    if (statusPagamento === "PENDENTE" && !dataVencimento)
      return setErro("Informe a data de vencimento para vendas pendentes.");
    if (forma === "cartao" && !tipoCartao)
      return setErro("Escolha se o pagamento no cartão foi Crédito ou Débito.");
    if (forma === "cartao" && tipoCartao === "CREDITO" && (!parcelas || Number(parcelas) < 1))
      return setErro("Informe a quantidade de parcelas.");
    if (formaEnvio === "PROPRIO" && !distanciaEntrega)
      return setErro(
        "Informe a quilometragem da entrega ou configure o endereço da fábrica para o cálculo automático.",
      );
    if (
      formaEnvio === "TRANSPORTADORA" &&
      !(transportadoraQuery.data?.nome || transportadora.nome).trim()
    )
      return setErro("Informe o nome da transportadora para continuar.");
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
        forma_envio: formaEnvio,
        custo_envio:
          formaEnvio === "PROPRIO"
            ? custoEstimadoEntrega
            : formaEnvio !== "RETIRADA" && custoEnvio.trim()
              ? Number(custoEnvio.replace(",", "."))
              : null,
        responsavel_entrega: formaEnvio === "PROPRIO" ? responsavelEntrega.trim() || null : null,
        data_envio: dataEnvio || null,
        previsao_entrega: previsaoEntrega || null,
        codigo_rastreamento:
          formaEnvio === "TRANSPORTADORA" ? codigoRastreamento.trim() || null : null,
        transportadora:
          formaEnvio === "TRANSPORTADORA" ? (transportadoraQuery.data ?? transportadora) : null,
        itens: itensCalculados.map((i) => ({
          produto_final_id: i.is_avulso ? null : i.produto_final_id,
          nome_avulso: i.is_avulso ? i.nome_avulso : null,
          quantidade: i.potes,
          preco_unitario: i.preco,
          modalidade_venda: i.tipo === "caixa" ? "CAIXA" : "POTE",
          quantidade_modalidade: i.qtd,
          unidades_por_modalidade: i.tipo === "caixa" ? POTES_POR_CAIXA : 1,
        })),
      },
    });
  }

  const formaLabel: Record<FormaPagamento, string> = {
    dinheiro: "Dinheiro",
    pix: "Pix",
    cheque: "Cheque",
    cartao: "Cartão",
    boleto: "Boleto",
    outro: "Outro",
  };

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

      {erro && (
        <div className="bg-error-bg border-l-4 border-error text-error rounded-md px-4 py-3 text-sm">
          {erro}
        </div>
      )}

      <form
        onSubmit={abrirConfirmacao}
        className="space-y-6 pb-28 md:grid md:grid-cols-[minmax(0,1fr)_18rem] md:items-start md:gap-6 md:space-y-0 md:pb-0"
      >
        <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-warm-sm md:col-start-1 md:row-start-1">
          {/* CLIENTE */}
          <div className="space-y-2 relative">
            <label className="text-sm font-semibold text-foreground">Cliente / Comprador *</label>
            <div className="flex gap-2">
              <input
                className="ds-input flex-1"
                value={cliente}
                onChange={(e) => alterarCliente(e.target.value)}
                onFocus={() => setMostrarSugestoes(true)}
                onKeyDown={navegarSugestoes}
                placeholder="Busque por nome ou telefone..."
                required
              />
              <button
                type="button"
                onClick={abrirCadastroCliente}
                className="ds-button-secondary shrink-0 px-3 flex items-center gap-1.5 text-xs"
              >
                <UserPlus size={16} /> Novo
              </button>
            </div>

            {/* Sugestões de Clientes */}
            {mostrarSugestoes && sugestoesCliente.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-warm-lg z-50 overflow-hidden max-h-56 overflow-y-auto">
                {sugestoesCliente.map((c, idx) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selecionarCliente(c)}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors ${
                      idx === sugestaoAtiva
                        ? "bg-primary/10 text-primary font-semibold"
                        : "hover:bg-secondary"
                    }`}
                  >
                    <div>
                      <div className="font-medium text-foreground">{c.nome}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.telefone || c.email || c.documento}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ITENS DA VENDA */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground">Itens da venda</label>
            <input
              className="ds-input"
              value={buscaProduto}
              onChange={(e) => setBuscaProduto(e.target.value)}
              placeholder="Buscar produto por nome..."
            />
            {pesquisandoProdutos && (
              <div className="text-xs text-muted-foreground">Pesquisando produtos...</div>
            )}

            {itens.map((it, idx) => (
              <div
                key={idx}
                className="space-y-3 border border-border rounded-xl p-4 bg-secondary/30"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase">
                    Item {idx + 1}
                  </span>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(it.is_avulso)}
                      onChange={(e) => {
                        atualizarItem(idx, {
                          is_avulso: e.target.checked,
                          produto_final_id: "",
                          nome_avulso: "",
                          preco_unitario: "",
                          quantidade: "1",
                        });
                      }}
                      className="rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                    <span>Venda Avulsa</span>
                  </label>
                </div>

                {it.is_avulso ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                      <div className="flex-1">
                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                          Descrição / Nome do Item *
                        </label>
                        <input
                          required
                          className="ds-input"
                          value={it.nome_avulso || ""}
                          onChange={(e) => atualizarItem(idx, { nome_avulso: e.target.value })}
                          placeholder="Ex: Doce customizado, taxa de entrega, bolo personalizado..."
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setItens((p) => p.filter((_, i) => i !== idx))}
                        disabled={itens.length === 1}
                        className="w-10 h-10 rounded-md text-error hover:bg-error-bg disabled:opacity-30 flex items-center justify-center shrink-0"
                        aria-label={`Remover item ${idx + 1}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      {/* Quantidade */}
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                          Quantidade *
                        </label>
                        <input
                          ref={(element) => {
                            quantidadeRefs.current[idx] = element;
                          }}
                          type="number"
                          min="1"
                          required
                          className="ds-input"
                          value={it.quantidade}
                          onChange={(e) => atualizarItem(idx, { quantidade: e.target.value })}
                        />
                      </div>

                      {/* Preço */}
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                          Preço Unitário *
                        </label>
                        <input
                          required
                          className="ds-input"
                          value={it.preco_unitario}
                          onChange={(e) => atualizarItem(idx, { preco_unitario: e.target.value })}
                          placeholder="R$ 0,00"
                        />
                      </div>
                    </div>

                    <div className="text-right text-xs text-muted-foreground">
                      Subtotal item:{" "}
                      <strong className="text-foreground">
                        {fmtBRL(itensCalculados[idx]?.subtotal ?? 0)}
                      </strong>
                    </div>
                  </div>
                ) : (
                  <>
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
                            {p.nome} (estoque: {Number(p.quantidade_estoque)} un)
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setItens((p) => p.filter((_, i) => i !== idx))}
                        disabled={itens.length === 1}
                        className="w-10 h-10 rounded-md text-error hover:bg-error-bg disabled:opacity-30 flex items-center justify-center shrink-0"
                        aria-label={`Remover item ${idx + 1}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {it.produto_final_id && (
                      <div className="space-y-3 pt-1">
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
                                    : "bg-card border border-border text-foreground hover:bg-secondary",
                                ].join(" ")}
                              >
                                {t === "pote" ? "Pote" : "Caixa (6 potes)"}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          {/* Quantidade de Potes (Obrigatório) */}
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                              {it.tipo === "caixa" ? "Quant. Caixas *" : "Quant. Potes *"}
                            </label>
                            <input
                              ref={(element) => {
                                quantidadeRefs.current[idx] = element;
                              }}
                              type="number"
                              min="1"
                              required
                              className="ds-input"
                              value={it.quantidade}
                              onChange={(e) => atualizarItem(idx, { quantidade: e.target.value })}
                            />
                          </div>

                          {/* Tamanho do Pote */}
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                              Tamanho Pote
                            </label>
                            <select
                              className="ds-input"
                              value={it.tamanho_pote}
                              onChange={(e) =>
                                atualizarItem(idx, { tamanho_pote: e.target.value as TamanhoPote })
                              }
                            >
                              <option value="44">44 uni.</option>
                              <option value="22">22 uni.</option>
                            </select>
                          </div>

                          {/* Preço por pote */}
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                              Preço por pote
                            </label>
                            <input
                              className="ds-input"
                              value={it.preco_unitario}
                              onChange={(e) =>
                                atualizarItem(idx, { preco_unitario: e.target.value })
                              }
                              placeholder="R$ 0,00"
                            />
                          </div>
                        </div>

                        <div className="text-right text-xs text-muted-foreground">
                          Subtotal item:{" "}
                          <strong className="text-foreground">
                            {fmtBRL(itensCalculados[idx]?.subtotal ?? 0)}
                          </strong>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={adicionarItem}
              className="ds-button-secondary w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold uppercase tracking-wider"
            >
              <Plus size={16} /> Adicionar outro item
            </button>
          </div>

          {/* DADOS DE PAGAMENTO */}
          <div className="space-y-4 pt-2 border-t border-border">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Data da venda
                </label>
                <input
                  type="date"
                  className="ds-input"
                  value={dataVenda}
                  onChange={(e) => setDataVenda(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Status
                </label>
                <select
                  className="ds-input"
                  value={statusPagamento}
                  onChange={(e) => setStatusPagamento(e.target.value as StatusPagamento)}
                >
                  <option value="PAGO">Pago</option>
                  <option value="PENDENTE">Pendente</option>
                </select>
              </div>
            </div>

            {statusPagamento === "PENDENTE" && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Data de Vencimento *
                </label>
                <input
                  type="date"
                  className="ds-input"
                  value={dataVencimento}
                  onChange={(e) => setDataVencimento(e.target.value)}
                  required
                />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Forma de pagamento
              </label>
              <select
                className="ds-input"
                value={forma}
                onChange={(e) => setForma(e.target.value as FormaPagamento)}
              >
                <option value="pix">PIX</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao">Cartão</option>
                <option value="cheque">Cheque</option>
                <option value="boleto">Boleto</option>
                <option value="outro">Outro</option>
              </select>
            </div>

            {forma === "cartao" && (
              <div className="grid grid-cols-2 gap-3 bg-secondary/50 p-3 rounded-xl border border-border">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                    Tipo Cartão
                  </label>
                  <select
                    className="ds-input"
                    value={tipoCartao ?? ""}
                    onChange={(e) => setTipoCartao((e.target.value as TipoCartao) || null)}
                  >
                    <option value="">Selecione...</option>
                    <option value="CREDITO">Crédito</option>
                    <option value="DEBITO">Débito</option>
                  </select>
                </div>
                {tipoCartao === "CREDITO" && (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                      Parcelas
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="ds-input"
                      value={parcelas}
                      onChange={(e) => setParcelas(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* DADOS DE TRANSPORTE */}
            <div className="space-y-4 pt-2 border-t border-border">
              <div>
                <label className="text-sm font-semibold text-foreground">Forma de envio</label>
                <select
                  className="ds-input mt-1"
                  value={formaEnvio}
                  onChange={(e) => setFormaEnvio(e.target.value as typeof formaEnvio)}
                >
                  <option value="RETIRADA">Retirada pelo cliente</option>
                  <option value="PROPRIO">Entrega própria</option>
                  <option value="TRANSPORTADORA">Transportadora</option>
                </select>
              </div>

              {formaEnvio === "PROPRIO" && (
                <div className="space-y-4 rounded-xl border border-border bg-secondary/30 p-4">
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">
                      Cálculo da entrega própria
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      O endereço cadastrado do cliente é usado para estimar a distância. Se o
                      cálculo automático não estiver disponível, informe a quilometragem.
                    </p>
                  </div>

                  {clienteSelecionado ? (
                    <div className="rounded-lg border border-border bg-card p-3 text-xs">
                      <strong className="block text-foreground">Endereço de entrega</strong>
                      <span className="text-muted-foreground">
                        {[
                          clienteSelecionado.endereco,
                          clienteSelecionado.numero,
                          clienteSelecionado.bairro,
                          clienteSelecionado.cidade,
                          clienteSelecionado.estado,
                        ]
                          .filter(Boolean)
                          .join(", ") || "Endereço não cadastrado"}
                      </span>
                    </div>
                  ) : null}

                  {!enderecoFabrica && (
                    <div className="rounded-lg border border-warning/30 bg-warning-bg p-3 text-xs text-warning">
                      O cálculo automático precisa da variável{" "}
                      <strong>VITE_FABRICA_ENDERECO</strong>. Enquanto ela não estiver configurada,
                      informe a quilometragem manualmente.
                    </div>
                  )}

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                        Quilometragem manual
                      </label>
                      <input
                        className="ds-input"
                        inputMode="decimal"
                        value={quilometragemManual}
                        onChange={(e) => setQuilometragemManual(e.target.value)}
                        placeholder="Ex.: 18,5 km"
                      />
                    </div>
                    <div className="rounded-lg bg-card border border-border p-3">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Distância aproximada
                      </span>
                      <strong className="mt-1 block text-lg text-primary">
                        {calculandoDistancia
                          ? "Calculando..."
                          : distanciaEntrega != null
                            ? `${distanciaEntrega.toFixed(1)} km`
                            : "Informe a quilometragem"}
                      </strong>
                    </div>
                  </div>

                  {erroDistancia && !quilometragemManual && (
                    <p className="text-xs text-warning">
                      {erroDistancia} Você pode informar a quilometragem manualmente.
                    </p>
                  )}

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg bg-card border border-border p-3">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Custo estimado
                      </span>
                      <strong className="mt-1 block text-lg text-primary">
                        {custoEstimadoEntrega != null ? fmtBRL(custoEstimadoEntrega) : "—"}
                      </strong>
                      <span className="text-[11px] text-muted-foreground">
                        Base: R$ {custoPorKm.toFixed(2).replace(".", ",")} por km
                      </span>
                    </div>
                    <div
                      className={`rounded-lg border p-3 ${
                        entregaViavel === null
                          ? "border-border bg-card"
                          : entregaViavel
                            ? "border-success/30 bg-success-bg"
                            : "border-error/30 bg-error-bg"
                      }`}
                    >
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Viabilidade
                      </span>
                      <strong className="mt-1 block text-lg">
                        {entregaViavel === null
                          ? "Aguardando distância"
                          : entregaViavel
                            ? "Entrega viável"
                            : "Custo acima do limite"}
                      </strong>
                      <span className="text-[11px] text-muted-foreground">
                        Limite configurado: {fmtBRL(limiteCustoEntrega)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                      Responsável pela entrega
                    </label>
                    <input
                      className="ds-input"
                      value={responsavelEntrega}
                      onChange={(e) => setResponsavelEntrega(e.target.value)}
                      placeholder="Nome do responsável"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A data de entrega não é obrigatória no cadastro da venda. A saída e a conclusão
                    da entrega são registradas posteriormente na aba Transporte.
                  </p>
                </div>
              )}

              {formaEnvio === "TRANSPORTADORA" && (
                <div className="space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
                  <h3 className="font-semibold text-sm text-foreground">
                    Transportadora do cliente
                  </h3>
                  {transportadoraQuery.isLoading ? (
                    <p className="text-sm text-muted-foreground">
                      Buscando transportadora cadastrada...
                    </p>
                  ) : transportadoraQuery.data ? (
                    <div className="rounded-lg border border-border bg-card p-3 text-sm">
                      <strong className="block text-foreground">
                        {transportadoraQuery.data.nome}
                      </strong>
                      <span className="text-xs text-muted-foreground">
                        {[transportadoraQuery.data.cidade, transportadoraQuery.data.estado]
                          .filter(Boolean)
                          .join(" / ") || "Localização não informada"}
                      </span>
                      {transportadoraQuery.data.telefone && (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          Telefone: {transportadoraQuery.data.telefone}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-muted-foreground">
                        Nome da transportadora
                      </label>
                      <input
                        className="ds-input"
                        value={transportadora.nome}
                        onChange={(e) =>
                          setTransportadora((atual) => ({
                            ...atual,
                            nome: e.target.value,
                          }))
                        }
                        placeholder="Ex.: Jadlog, Correios ou transportadora local"
                      />
                      <p className="text-xs text-muted-foreground">
                        Esse nome será registrado nos dados do envio desta venda.
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    O código de rastreamento não é informado nesta etapa. Ele deve ser registrado
                    quando a venda for marcada como <strong>Despachada</strong> na aba Transporte.
                  </p>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                      Código de rastreamento
                    </label>
                    <input
                      className="ds-input"
                      value={codigoRastreamento}
                      onChange={(e) => setCodigoRastreamento(e.target.value)}
                      placeholder="Código fornecido pela transportadora"
                    />
                  </div>
                </div>
              )}

              {formaEnvio !== "RETIRADA" && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                      Custo do envio
                    </label>
                    <input
                      className="ds-input"
                      inputMode="decimal"
                      value={custoEnvio}
                      onChange={(e) => setCustoEnvio(e.target.value)}
                      placeholder="R$ 0,00"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                      Data do envio
                    </label>
                    <input
                      type="date"
                      className="ds-input"
                      value={dataEnvio}
                      onChange={(e) => setDataEnvio(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                      Previsão de entrega
                    </label>
                    <input
                      type="date"
                      className="ds-input"
                      value={previsaoEntrega}
                      onChange={(e) => setPrevisaoEntrega(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Observação
              </label>
              <textarea
                className="ds-input min-h-[60px]"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Anotações opcionais sobre a venda..."
              />
            </div>
          </div>
        </div>

        {/* RESUMO LATERAL E CARDS */}
        <div className="space-y-4 md:col-start-2 md:row-start-1 md:sticky md:top-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-warm-sm space-y-4">
            <h2 className="font-display text-lg font-bold text-foreground border-b border-border pb-2">
              Resumo da Venda
            </h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Total de itens:</span>
                <strong className="text-foreground">
                  {itensCalculados.reduce((s, i) => s + i.potes, 0)} potes
                </strong>
              </div>
              <div className="flex justify-between text-base pt-2 border-t border-border">
                <span className="font-bold">Total Venda:</span>
                <strong className="font-display text-xl text-primary">{fmtBRL(total)}</strong>
              </div>
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="ds-button-primary w-full py-3 text-sm font-bold uppercase tracking-wider"
            >
              {mutation.isPending ? "Registrando..." : "Finalizar Venda"}
            </button>
          </div>

          {/* CARD AMARELO DE VENDA PENDENTE (formulário sendo preenchido agora) */}
          {temItemPendente && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 p-4 shadow-warm-sm space-y-1 text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-2 font-bold text-sm">
                <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Venda de produto pendente</span>
              </div>
              <p className="text-xs opacity-90 leading-relaxed pl-6">
                Assim que o produto estiver no estoque, a venda será concluída.
              </p>
            </div>
          )}

          {/* CARDS AMARELOS DE VENDAS JÁ SALVAS AGUARDANDO ESTOQUE */}
          {vendasAguardandoEstoque.map((v: any) => (
            <div
              key={v.id}
              className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 p-4 shadow-warm-sm space-y-1 text-amber-900 dark:text-amber-200"
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <span>{v.comprador}</span>
              </div>
              <div className="text-xs opacity-90 pl-6">
                {v.itens_venda.map((i: any) => `${i.nome} (${i.quantidade})`).join(", ")}
                {" · "}
                {fmtBRL(v.valor_total)}
              </div>
              <p className="text-xs opacity-90 leading-relaxed pl-6">
                A venda será concluída quando o produto estiver no estoque.
              </p>
            </div>
          ))}
        </div>
      </form>

      {/* MODAL NOVO CLIENTE */}
      {modalClienteAberto && (
        <ClienteFormModal
          aberto={modalClienteAberto}
          titulo="Cadastrar Novo Cliente"
          descricao="Preencha os dados abaixo para cadastrar e vincular o cliente à venda."
          inicial={clienteRapido}
          salvando={criarClienteMutation.isPending}
          erroGeral={erroClienteRapido}
          onClose={() => setModalClienteAberto(false)}
          onSubmit={salvarClienteRapido}
        />
      )}

      {/* MODAL CONFIRMAÇÃO */}
      {confirmar && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-warm-lg space-y-4">
            <h3 className="font-display text-xl font-bold text-foreground">Confirmar Venda</h3>
            <p className="text-sm text-muted-foreground">
              Confira os dados da venda antes de confirmar o registro:
            </p>
            <div className="bg-secondary/40 p-4 rounded-xl space-y-2 text-sm">
              <div>
                <strong>Cliente:</strong> {cliente}
              </div>
              <div>
                <strong>Itens:</strong>{" "}
                {itensCalculados.map((i) => `${i.nome} (${i.potes} potes)`).join(", ")}
              </div>
              <div>
                <strong>Total:</strong> {fmtBRL(total)}
              </div>
              <div>
                <strong>Pagamento:</strong> {formaLabel[forma]} ({statusPagamento})
              </div>
              {temItemPendente && (
                <div className="text-amber-600 dark:text-amber-400 text-xs font-semibold pt-1">
                  ⚠️ Esta venda contém itens com estoque insuficiente e ficará pendente de produção.
                </div>
              )}
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setConfirmar(false)}
                className="ds-button-secondary px-4 py-2 text-xs uppercase"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmar(false);
                  salvar();
                }}
                className="ds-button-primary px-4 py-2 text-xs uppercase"
              >
                Confirmar e Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
