import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiFn } from "@/lib/api-function";
import {
  Plus,
  Search,
  Users,
  Pencil,
  Trash2,
  Phone,
  Mail,
  MapPin,
  X,
  Eye,
  Star,
  Sparkles,
  Clock,
  CreditCard,
  AlertTriangle,
  ThumbsUp,
  ChevronDown,
  Store,
  UserRound,
  Truck,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";

import {
  listarClientes,
  criarCliente,
  atualizarCliente,
  excluirCliente,
  buscarDetalhesTransportadora,
} from "@/lib/clientes.functions";

import { listarVendas } from "@/lib/vendas.functions";

import { fmtBRL, fmtDate, fmtDateTime } from "@/lib/format";
import { mascararCep } from "@/lib/viacep";

import { ClienteFormModal } from "@/components/clientes/ClienteFormModal";

import { clienteFormVazio, type ClienteFormData } from "@/lib/cliente-form";

import { mascararDocumento, somenteDigitos } from "@/lib/documento-fiscal";

import { toast } from "sonner";

export const Route = createFileRoute("/clientes")({
  component: () => (
    <AppShell>
      <Clientes />
    </AppShell>
  ),
});

type Cliente = {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  endereco: string;
  numero: string;
  complemento: string;
  documento: string;
  cep: string;
  bairro: string;
  cidade: string;
  estado: string;
  inscricaoEstadual: string;
  tipo?: "CLIENTE" | "TRANSPORTADORA" | "LOJISTA";
};

type FiltroCliente = "todos" | "frequentes" | "novos" | "atrasadores";

type TipoCadastro = "CLIENTE" | "TRANSPORTADORA" | "LOJISTA";

const opcoesNovoCadastro: {
  tipo: TipoCadastro;
  titulo: string;
  descricao: string;
  Icone: typeof UserRound;
}[] = [
  {
    tipo: "CLIENTE",
    titulo: "Cliente",
    descricao: "Pessoa ou empresa que compra seus produtos.",
    Icone: UserRound,
  },
  {
    tipo: "TRANSPORTADORA",
    titulo: "Transportadora",
    descricao: "Empresa responsável pelas entregas.",
    Icone: Truck,
  },
  {
    tipo: "LOJISTA",
    titulo: "Lojista",
    descricao: "Parceiro comercial ou ponto de revenda.",
    Icone: Store,
  },
];

function Clientes() {
  const qc = useQueryClient();

  const fnCriar = useApiFn(criarCliente);
  const fnAtualizar = useApiFn(atualizarCliente);
  const fnExcluir = useApiFn(excluirCliente);

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes"],
    queryFn: () => listarClientes() as Promise<Cliente[]>,
  });

  const { data: vendas = [] } = useQuery({
    queryKey: ["vendas"],
    queryFn: () => listarVendas(),
  });

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroCliente>("todos");
  const [abaAtual, setAbaAtual] = useState<TipoCadastro>("CLIENTE");
  const [menuNovoAberto, setMenuNovoAberto] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalTipo, setModalTipo] = useState<TipoCadastro>("CLIENTE");
  const menuNovoRef = useRef<HTMLDivElement>(null);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [formInicial, setFormInicial] = useState<ClienteFormData>(clienteFormVazio);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<Cliente | null>(null);
  const [perfilAberto, setPerfilAberto] = useState<Cliente | null>(null);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let lista = clientes.filter((c) => (c.tipo || "CLIENTE") === abaAtual);
    if (q) {
      lista = lista.filter((c) => c.nome.toLowerCase().includes(q));
    }

    if (filtro === "todos") {
      return lista;
    }

    return lista.filter((c) => {
      const vendasCliente = vendas.filter((v: any) => v.cliente_id === c.id);

      if (filtro === "frequentes") {
        return classificarFrequencia(vendasCliente.length) === "frequente";
      }

      if (filtro === "novos") {
        return classificarFrequencia(vendasCliente.length) === "novo";
      }

      if (filtro === "atrasadores") {
        return classificarComportamento(vendasCliente).tipo === "atrasador";
      }

      return true;
    });
  }, [clientes, vendas, busca, filtro, abaAtual]);

  useEffect(() => {
    if (!menuNovoAberto) return;

    function fecharAoClicarFora(event: PointerEvent) {
      if (!menuNovoRef.current?.contains(event.target as Node)) {
        setMenuNovoAberto(false);
      }
    }

    document.addEventListener("pointerdown", fecharAoClicarFora);
    return () => document.removeEventListener("pointerdown", fecharAoClicarFora);
  }, [menuNovoAberto]);

  function abrirNovo(tipo: TipoCadastro) {
    setEditando(null);
    setMenuNovoAberto(false);
    setFormInicial({ ...clienteFormVazio, tipo });
    setErro(null);
    setModalTipo(tipo);
    setModalAberto(true);
  }

  function abrirEditar(c: Cliente) {
    setEditando(c);

    const documento = somenteDigitos(c.documento ?? "");

    /*
     * IMPORTANTE:
     * usamos clienteFormVazio como base.
     *
     * Isso garante que os novos campos da
     * transportadora existam no objeto.
     *
     * Depois o ClienteFormModal consulta a
     * transportadora vinculada através do clienteId.
     */
    setFormInicial({
      ...clienteFormVazio,

      nome: c.nome ?? "",
      telefone: c.telefone ?? "",
      email: c.email ?? "",

      endereco: c.endereco ?? "",
      numero: c.numero ?? "",
      complemento: c.complemento ?? "",

      documento: mascararDocumento(documento, documento.length > 11 ? "CNPJ" : "CPF"),

      cep: mascararCep(c.cep ?? ""),

      bairro: c.bairro ?? "",
      cidade: c.cidade ?? "",
      estado: c.estado ?? "",
      inscricaoEstadual: c.inscricaoEstadual ?? "",
      tipo: c.tipo || "CLIENTE",
    });
    setModalTipo(c.tipo || "CLIENTE");
    setErro(null);
    setModalAberto(true);
  }

  function fecharModal() {
    if (salvando) return;

    setModalAberto(false);
    setEditando(null);

    setFormInicial({
      ...clienteFormVazio,
    });

    setErro(null);
  }

  async function salvar(form: ClienteFormData) {
    setErro(null);
    setSalvando(true);

    try {
      if (editando) {
        await fnAtualizar({
          data: {
            ...form,
            id: editando.id,
          },
        });
      } else {
        await fnCriar({
          data: form,
        });
      }
      await qc.invalidateQueries({ queryKey: ["clientes"] });
      const nomeEntidade =
        modalTipo === "TRANSPORTADORA"
          ? "Transportadora"
          : modalTipo === "LOJISTA"
            ? "Lojista"
            : "Cliente";
      toast.success(
        editando
          ? "Cadastro atualizado com sucesso."
          : `${nomeEntidade} cadastrado(a) com sucesso.`,
      );

      fecharModal();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExclusao() {
    if (!confirmDel) return;

    try {
      await fnExcluir({
        data: {
          id: confirmDel.id,
        },
      });

      await qc.invalidateQueries({
        queryKey: ["clientes"],
      });

      setConfirmDel(null);

      toast.success("Cliente excluído com sucesso.");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao excluir");
    }
  }

  const filtros: {
    key: FiltroCliente;
    label: string;
  }[] = [
    {
      key: "todos",
      label: "Todos",
    },
    {
      key: "frequentes",
      label: "Frequentes",
    },
    {
      key: "novos",
      label: "Novos",
    },
    {
      key: "atrasadores",
      label: "Já atrasou",
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-warm-sm md:px-6">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold text-primary md:text-2xl">Clientes</h1>

          <p className="mt-1 font-body text-xs text-muted-foreground md:text-sm">
            {clientes.length}{" "}
            {clientes.length === 1 ? "cliente cadastrado" : "clientes cadastrados"}.
          </p>
        </div>
        <div ref={menuNovoRef} className="relative w-full sm:w-auto">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuNovoAberto}
            onClick={() => setMenuNovoAberto((aberto) => !aberto)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-warm-sm hover:bg-primary-dark sm:w-auto"
          >
            <Plus size={16} />
            Novo cliente
            <ChevronDown
              size={15}
              className={`transition-transform ${menuNovoAberto ? "rotate-180" : ""}`}
            />
          </button>

          {menuNovoAberto && (
            <div
              role="menu"
              aria-label="Escolha o tipo de cadastro"
              className="absolute right-0 z-30 mt-2 w-full min-w-[280px] rounded-xl border border-border bg-card p-2 shadow-warm-lg sm:w-[320px]"
            >
              <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                O que você deseja cadastrar?
              </p>

              {opcoesNovoCadastro.map(({ tipo, titulo, descricao, Icone }) => (
                <button
                  key={tipo}
                  type="button"
                  role="menuitem"
                  onClick={() => abrirNovo(tipo)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icone size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-foreground">{titulo}</span>
                    <span className="block text-xs leading-4 text-muted-foreground">
                      {descricao}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <nav
        aria-label="Tipos de cadastro"
        className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 shadow-warm-sm"
      >
        {(["CLIENTE", "TRANSPORTADORA", "LOJISTA"] as const).map((aba) => (
          <button
            key={aba}
            onClick={() => setAbaAtual(aba)}
            className={`shrink-0 rounded-lg px-4 py-2.5 text-xs font-bold transition-colors md:text-sm ${
              abaAtual === aba
                ? "bg-primary text-primary-foreground shadow-warm-sm"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            {aba === "CLIENTE"
              ? "Clientes"
              : aba === "TRANSPORTADORA"
                ? "Transportadoras"
                : "Lojistas"}
          </button>
        ))}
      </nav>

      <section className="rounded-2xl border border-border bg-card p-3 shadow-warm-sm md:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-[220px] flex-1 md:max-w-md">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />

          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar por nome..."
            className="ds-input ds-input-search"
          />
          </div>

          <span className="text-xs font-semibold text-muted-foreground">
            {filtrados.length} {filtrados.length === 1 ? "resultado" : "resultados"}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <span className="mr-1 text-xs font-semibold text-muted-foreground">Filtrar:</span>
          {filtros.map((f) => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition md:text-xs ${
                filtro === f.key
                  ? "bg-primary text-primary-foreground shadow-warm-sm"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      {filtrados.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <Users className="mx-auto text-muted-foreground mb-3" size={40} />

          <p className="font-body text-sm text-muted-foreground">
            {busca || filtro !== "todos"
              ? "Nenhum cliente encontrado com esse filtro."
              : "Cadastre seu primeiro cliente."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((c) => {
            const vendasCliente = vendas.filter((v: any) => v.cliente_id === c.id);
            const ehTransportadora = c.tipo === "TRANSPORTADORA";

            const frequencia = classificarFrequencia(vendasCliente.length);

            return (
              <article
                key={c.id}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-warm-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-lg font-bold text-foreground truncate">
                      {c.nome}
                    </h2>

                    {ehTransportadora ? (
                      <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                        <Truck size={12} />
                        Transportadora
                      </div>
                    ) : (
                      <FrequenciaBadge frequencia={frequencia} />
                    )}
                  </div>

                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => abrirEditar(c)}
                      aria-label="Editar"
                      className="w-9 h-9 rounded-full bg-secondary text-brown-mid hover:bg-beige-dark flex items-center justify-center"
                    >
                      <Pencil size={14} />
                    </button>

                    <button
                      onClick={() => setConfirmDel(c)}
                      aria-label="Excluir"
                      className="w-9 h-9 rounded-full bg-error-bg text-error hover:bg-error hover:text-error-foreground flex items-center justify-center"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {ehTransportadora ? (
                  <div className="rounded-xl border border-primary/15 bg-primary/5 px-3 py-4 text-sm text-muted-foreground">
                    Cadastro simplificado. Consulte os clientes vinculados e o histórico de uso.
                  </div>
                ) : (
                  <>
                    <div className="space-y-2 text-sm text-foreground font-body">
                      <Linha icon={<Phone size={13} />} value={c.telefone} placeholder="Sem telefone" />

                      <Linha icon={<Mail size={13} />} value={c.email} placeholder="Sem e-mail" />

                      <Linha
                        icon={<MapPin size={13} />}
                        value={
                          c.endereco
                            ? `${c.endereco}${c.numero ? `, ${c.numero}` : ""}${
                                c.complemento ? ` · ${c.complemento}` : ""
                              }`
                            : ""
                        }
                        placeholder="Sem endereço"
                      />
                    </div>

                    {c.documento && (
                      <div className="text-xs text-muted-foreground bg-secondary/60 rounded-md px-3 py-2 font-body">
                        Documento: {c.documento}
                      </div>
                    )}

                    {(c.cep || c.bairro || c.cidade || c.estado || c.inscricaoEstadual) && (
                      <div className="text-xs text-muted-foreground bg-secondary/60 rounded-md px-3 py-2 font-body space-y-1">
                        {c.cep && <div>CEP: {mascararCep(c.cep)}</div>}

                        {c.bairro && <div>Bairro: {c.bairro}</div>}

                        {(c.cidade || c.estado) && (
                          <div>{[c.cidade, c.estado].filter(Boolean).join(" — ")}</div>
                        )}

                        {c.inscricaoEstadual && <div>Inscrição estadual: {c.inscricaoEstadual}</div>}
                      </div>
                    )}
                  </>
                )}

                <button
                  onClick={() => setPerfilAberto(c)}
                  className="mt-1 text-xs font-bold text-primary inline-flex items-center gap-1 self-start"
                >
                  <Eye size={13} />
                  {ehTransportadora ? "Ver detalhes da transportadora" : "Ver perfil de compras"}
                </button>
              </article>
            );
          })}
        </div>
      )}

      <ClienteFormModal
        aberto={modalAberto}
        titulo={
          editando
            ? "Editar cadastro"
            : modalTipo === "TRANSPORTADORA"
              ? "Nova transportadora"
              : modalTipo === "LOJISTA"
                ? "Novo lojista"
                : "Novo cliente"
        }
        inicial={formInicial}
        clienteId={editando?.id ?? null}
        salvando={salvando}
        erroGeral={erro}
        onClose={fecharModal}
        onSubmit={salvar}
      />

      {confirmDel && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setConfirmDel(null)}
        >
          <div
            className="bg-card max-w-sm w-full rounded-2xl shadow-warm-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-bold text-foreground">Excluir cliente?</h3>

            <p className="text-sm text-muted-foreground mt-2 font-body">
              Tem certeza que deseja excluir <strong>{confirmDel.nome}</strong>? Essa ação não pode
              ser desfeita.
            </p>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setConfirmDel(null)}
                className="flex-1 px-4 py-2.5 rounded-md font-semibold text-sm border border-border bg-card text-brown-mid hover:bg-secondary"
              >
                Cancelar
              </button>

              <button
                onClick={confirmarExclusao}
                className="flex-1 px-4 py-2.5 rounded-md font-semibold text-sm bg-error text-error-foreground hover:opacity-90 inline-flex items-center justify-center gap-2"
              >
                <Trash2 size={14} />
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {perfilAberto && (
        <PerfilClienteModal
          cliente={perfilAberto}
          vendas={vendas.filter((v: any) => v.cliente_id === perfilAberto.id)}
          onClose={() => setPerfilAberto(null)}
        />
      )}
    </div>
  );
}

// ----- Regras de classificação -----

type Frequencia = "sem_compras" | "novo" | "recorrente" | "frequente";

function classificarFrequencia(qtdCompras: number): Frequencia {
  if (qtdCompras === 0) {
    return "sem_compras";
  }

  if (qtdCompras === 1) {
    return "novo";
  }

  if (qtdCompras <= 2) {
    return "recorrente";
  }

  return "frequente";
}

type Comportamento = "sem_historico" | "pontual" | "parcelador" | "atrasador";

function classificarComportamento(vendasCliente: any[]) {
  const relevantes = vendasCliente.filter((v) => v.status_pagamento !== "NAO_SE_APLICA");

  if (relevantes.length === 0) {
    return {
      tipo: "sem_historico" as Comportamento,
      qtdAtraso: 0,
      qtdParcelada: 0,
      total: 0,
    };
  }

  const qtdAtraso = relevantes.filter((v) => v.em_atraso).length;

  const qtdParcelada = relevantes.filter(
    (v) => v.tipo_cartao === "CREDITO" && (v.parcelas || 1) > 1,
  ).length;

  let tipo: Comportamento = "pontual";

  if (qtdAtraso > 0) {
    tipo = "atrasador";
  } else if (qtdParcelada / relevantes.length > 0.5) {
    tipo = "parcelador";
  }

  return {
    tipo,
    qtdAtraso,
    qtdParcelada,
    total: relevantes.length,
  };
}

// ----- Componentes visuais -----

function FrequenciaBadge({ frequencia }: { frequencia: Frequencia }) {
  const map: Record<
    Frequencia,
    {
      label: string;
      cls: string;
      Icon: any;
    }
  > = {
    sem_compras: {
      label: "Sem compras ainda",
      cls: "text-muted-foreground",
      Icon: Clock,
    },

    novo: {
      label: "Cliente novo",
      cls: "text-info",
      Icon: Sparkles,
    },

    recorrente: {
      label: "Cliente recorrente",
      cls: "text-gold-dark",
      Icon: Star,
    },

    frequente: {
      label: "Cliente frequente",
      cls: "text-success",
      Icon: Star,
    },
  };

  const { label, cls, Icon } = map[frequencia];

  return (
    <div className={`inline-flex items-center gap-1 text-[11px] font-semibold mt-0.5 ${cls}`}>
      <Icon size={12} />
      {label}
    </div>
  );
}

function ComportamentoBadge({ tipo }: { tipo: Comportamento }) {
  const map: Record<
    Comportamento,
    {
      label: string;
      cls: string;
      Icon: any;
    }
  > = {
    sem_historico: {
      label: "Sem histórico suficiente",
      cls: "bg-secondary text-brown-mid",
      Icon: Clock,
    },

    pontual: {
      label: "Costuma pagar em dia",
      cls: "bg-success-bg text-success",
      Icon: ThumbsUp,
    },

    parcelador: {
      label: "Prefere parcelar no cartão",
      cls: "bg-info-bg text-info",
      Icon: CreditCard,
    },

    atrasador: {
      label: "Já teve atraso no pagamento",
      cls: "bg-error-bg text-error",
      Icon: AlertTriangle,
    },
  };

  const { label, cls, Icon } = map[tipo];

  return (
    <span
      className={`inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide px-3 py-1.5 rounded-full ${cls}`}
    >
      <Icon size={16} />
      {label}
    </span>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-secondary/50 rounded-lg px-3 py-3 text-center">
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">
        {label}
      </div>

      <div className="font-display text-xl font-bold text-primary mt-1 truncate">{value}</div>
    </div>
  );
}

function PerfilClienteModal({
  cliente,
  vendas,
  onClose,
}: {
  cliente: Cliente;
  vendas: any[];
  onClose: () => void;
}) {
  if (cliente.tipo === "TRANSPORTADORA") {
    return <PerfilTransportadoraModal cliente={cliente} onClose={onClose} />;
  }

  const totalGasto = vendas.reduce((s, v) => s + Number(v.valor_total), 0);

  const qtdCompras = vendas.length;

  const ticketMedio = qtdCompras > 0 ? totalGasto / qtdCompras : 0;

  const ultimaCompra = vendas
    .slice()
    .sort((a, b) => +new Date(b.data_venda) - +new Date(a.data_venda))[0];

  const frequencia = classificarFrequencia(qtdCompras);

  const comportamento = classificarComportamento(vendas);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={onClose}
    >
      <div
        className="bg-card w-full md:max-w-xl md:rounded-2xl rounded-t-2xl shadow-warm-sm max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-7 py-5 border-b border-border flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl font-bold text-primary">{cliente.nome}</h2>

            <div className="mt-1 scale-110 origin-left">
              <FrequenciaBadge frequencia={frequencia} />
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Fechar"
            className="w-10 h-10 rounded-full hover:bg-secondary flex items-center justify-center shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-7 space-y-7 text-base">
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Dados cadastrais
            </h3>

            <div className="space-y-1 text-sm text-foreground">
              <p>{cliente.email || "Sem e-mail"}</p>

              <p>{cliente.telefone || "Sem telefone"}</p>

              {(cliente.endereco ||
                cliente.numero ||
                cliente.complemento ||
                cliente.bairro ||
                cliente.cidade ||
                cliente.estado ||
                cliente.cep) && (
                <p>
                  {[
                    cliente.endereco &&
                      `${cliente.endereco}${cliente.numero ? `, ${cliente.numero}` : ""}`,

                    cliente.complemento,

                    cliente.bairro,

                    [cliente.cidade, cliente.estado].filter(Boolean).join(" — "),

                    cliente.cep && `CEP ${mascararCep(cliente.cep)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}

              {cliente.inscricaoEstadual && <p>Inscrição estadual: {cliente.inscricaoEstadual}</p>}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Resumo de compras
            </h3>

            {qtdCompras === 0 ? (
              <p className="text-base text-muted-foreground bg-secondary/50 rounded-lg px-4 py-4">
                Esse cliente ainda não tem nenhuma compra registrada.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <MiniCard label="Compras" value={String(qtdCompras)} />

                <MiniCard label="Total gasto" value={fmtBRL(totalGasto)} />

                <MiniCard label="Ticket médio" value={fmtBRL(ticketMedio)} />
              </div>
            )}

            {ultimaCompra && (
              <p className="text-sm text-muted-foreground mt-3">
                Última compra em {fmtDateTime(ultimaCompra.data_venda)}, no valor de{" "}
                <strong>{fmtBRL(Number(ultimaCompra.valor_total))}</strong>.
              </p>
            )}
          </section>

          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Comportamento de pagamento
            </h3>

            <ComportamentoBadge tipo={comportamento.tipo} />

            {comportamento.total > 0 && (
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                Baseado nas últimas {comportamento.total}{" "}
                {comportamento.total === 1 ? "venda" : "vendas"}:{" "}
                {comportamento.qtdAtraso > 0 && (
                  <>
                    {comportamento.qtdAtraso} {comportamento.qtdAtraso === 1 ? "ficou" : "ficaram"}{" "}
                    em atraso
                    {comportamento.qtdParcelada > 0 ? " · " : ""}
                  </>
                )}
                {comportamento.qtdParcelada > 0 && (
                  <>{comportamento.qtdParcelada} parcelada(s) no cartão</>
                )}
              </p>
            )}

            <p className="text-sm text-muted-foreground/80 mt-3 italic leading-relaxed">
              Estimativa com base no status atual das vendas.
            </p>
          </section>

          {qtdCompras > 0 && (
            <section>
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Últimas compras
              </h3>

              <ul className="space-y-3 max-h-64 overflow-y-auto">
                {vendas
                  .slice()
                  .sort((a, b) => +new Date(b.data_venda) - +new Date(a.data_venda))
                  .slice(0, 8)
                  .map((v) => (
                    <li
                      key={v.id}
                      className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-3 text-base"
                    >
                      <div className="min-w-0">
                        <div className="text-sm text-muted-foreground">
                          {fmtDateTime(v.data_venda)}
                        </div>

                        <div className="text-sm font-semibold text-muted-foreground mt-0.5">
                          {v.status_pagamento === "PAGO"
                            ? "Pago"
                            : v.em_atraso
                              ? "Em atraso"
                              : v.status_pagamento === "PENDENTE"
                                ? "Pendente"
                                : "—"}
                        </div>
                      </div>

                      <span className="font-display font-bold text-lg text-primary">
                        {fmtBRL(Number(v.valor_total))}
                      </span>
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function PerfilTransportadoraModal({
  cliente,
  onClose,
}: {
  cliente: Cliente;
  onClose: () => void;
}) {
  const detalhesQuery = useQuery({
    queryKey: ["transportadoras", "detalhes", cliente.id],
    queryFn: () => buscarDetalhesTransportadora(cliente.id),
  });
  const detalhes = detalhesQuery.data;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm md:items-center md:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-card shadow-warm-sm md:max-w-2xl md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Truck size={20} />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-primary">{cliente.nome}</h2>
              <p className="mt-1 text-sm text-muted-foreground">Detalhes da transportadora</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhes da transportadora"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-secondary"
          >
            <X size={20} />
          </button>
        </div>

        {detalhesQuery.isLoading ? (
          <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
            Carregando vínculos e histórico...
          </div>
        ) : detalhesQuery.isError || !detalhes ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-error">Não foi possível carregar os detalhes.</p>
            <button
              type="button"
              onClick={() => detalhesQuery.refetch()}
              className="mt-3 text-sm font-bold text-primary hover:underline"
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <div className="space-y-6 p-6">
            <section className="rounded-xl border border-primary/15 bg-primary/5 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Cadastro
              </p>
              <p className="mt-1 text-lg font-bold text-foreground">{detalhes.nome}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Cadastro simplificado: esta transportadora não possui dados de cliente comum.
              </p>
            </section>

            <div className="grid grid-cols-2 gap-3">
              <MiniCard
                label="Clientes vinculados"
                value={String(detalhes.clientesVinculados.length)}
              />
              <MiniCard label="Usos em vendas" value={String(detalhes.historico.length)} />
            </div>

            <section>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Clientes vinculados
              </h3>
              {detalhes.clientesVinculados.length === 0 ? (
                <p className="rounded-xl bg-secondary/50 px-4 py-4 text-sm text-muted-foreground">
                  Nenhum cliente está vinculado a esta transportadora.
                </p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {detalhes.clientesVinculados.map((vinculo) => (
                    <li
                      key={vinculo.id}
                      className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-3 text-sm"
                    >
                      <UserRound size={15} className="shrink-0 text-primary" />
                      <span className="min-w-0 truncate font-semibold text-foreground">
                        {vinculo.nome}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Histórico de uso nas vendas
              </h3>
              {detalhes.historico.length === 0 ? (
                <p className="rounded-xl bg-secondary/50 px-4 py-4 text-sm text-muted-foreground">
                  Esta transportadora ainda não foi utilizada em nenhuma venda.
                </p>
              ) : (
                <ul className="space-y-3">
                  {detalhes.historico.map((uso) => (
                    <li key={uso.vendaId} className="rounded-xl border border-border bg-secondary/30 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-foreground">Venda #{uso.vendaId}</p>
                          <p className="text-xs text-muted-foreground">
                            {uso.clienteNome} · {fmtDate(uso.dataVenda)}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-primary">
                          {uso.custoEnvio == null ? "Frete não informado" : fmtBRL(uso.custoEnvio)}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                        <span>
                          <strong className="text-foreground">Envio:</strong>{" "}
                          {uso.dataEnvio ? fmtDate(uso.dataEnvio) : "Não informado"}
                        </span>
                        <span>
                          <strong className="text-foreground">Previsão:</strong>{" "}
                          {uso.previsaoEntrega ? fmtDate(uso.previsaoEntrega) : "Não informada"}
                        </span>
                        <span>
                          <strong className="text-foreground">Status:</strong>{" "}
                          {rotuloDespacho(uso.situacaoDespacho)}
                        </span>
                      </div>

                      {uso.codigoRastreamento && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          <strong className="text-foreground">Rastreamento:</strong>{" "}
                          {uso.codigoRastreamento}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function rotuloDespacho(status: string | null) {
  return (
    {
      NAO_APLICAVEL: "Não aplicável",
      AGUARDANDO_DESPACHO: "Aguardando despacho",
      DESPACHADO: "Despachada",
      ENTREGUE: "Entregue",
    }[status ?? ""] ?? status ?? "Não informado"
  );
}

function Linha({
  icon,
  value,
  placeholder,
}: {
  icon: React.ReactNode;
  value: string;
  placeholder: string;
}) {
  const tem = value && value.trim().length > 0;

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground shrink-0">{icon}</span>

      <span className={tem ? "truncate" : "truncate text-muted-foreground italic"}>
        {tem ? value : placeholder}
      </span>
    </div>
  );
}
