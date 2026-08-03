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
  Check,
  Eye,
  Star,
  Sparkles,
  Clock,
  CreditCard,
  AlertTriangle,
  ThumbsUp,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  listarClientes,
  criarCliente,
  atualizarCliente,
  excluirCliente,
} from "@/lib/clientes.functions";
import { listarVendas } from "@/lib/vendas.functions";
import { fmtBRL, fmtDateTime } from "@/lib/format";
import { apenasDigitosCep, consultarCep, mascararCep } from "@/lib/viacep";

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
  inscricaoEstadual: string;
};

type FormState = {
  nome: string;
  telefone: string;
  email: string;
  endereco: string;
  numero: string;
  complemento: string;
  documento: string;
  cep: string;
  bairro: string;
  inscricaoEstadual: string;
};

const emptyForm: FormState = {
  nome: "",
  telefone: "",
  email: "",
  endereco: "",
  numero: "",
  complemento: "",
  documento: "",
  cep: "",
  bairro: "",
  inscricaoEstadual: "",
};

type FiltroCliente = "todos" | "frequentes" | "novos" | "atrasadores";
type TipoDocumento = "CPF" | "CNPJ";

// ----- Máscaras -----

function onlyDigits(v: string) {
  return v.replace(/\D/g, "");
}

function maskTelefone(digits: string) {
  const d = digits.slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

function maskCPF(digits: string) {
  const d = digits.slice(0, 11);
  let out = d.slice(0, 3);
  if (d.length > 3) out += "." + d.slice(3, 6);
  if (d.length > 6) out += "." + d.slice(6, 9);
  if (d.length > 9) out += "-" + d.slice(9, 11);
  return out;
}

function maskCNPJ(digits: string) {
  const d = digits.slice(0, 14);
  let out = d.slice(0, 2);
  if (d.length > 2) out += "." + d.slice(2, 5);
  if (d.length > 5) out += "." + d.slice(5, 8);
  if (d.length > 8) out += "/" + d.slice(8, 12);
  if (d.length > 12) out += "-" + d.slice(12, 14);
  return out;
}

function maskDocumento(digits: string, tipo: TipoDocumento) {
  return tipo === "CPF" ? maskCPF(digits) : maskCNPJ(digits);
}

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
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>("CPF");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<Cliente | null>(null);
  const [perfilAberto, setPerfilAberto] = useState<Cliente | null>(null);
  const [statusCep, setStatusCep] = useState<string | null>(null);
  const ultimaConsultaCep = useRef<string | null>(null);
  const consultaCepRef = useRef<AbortController | null>(null);
  const numeroRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => consultaCepRef.current?.abort(), []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let lista = clientes;
    if (q) {
      lista = lista.filter((c) => c.nome.toLowerCase().includes(q));
    }
    if (filtro === "todos") return lista;

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
  }, [clientes, vendas, busca, filtro]);

  function abrirNovo() {
    setEditando(null);
    setForm(emptyForm);
    setTipoDocumento("CPF");
    setErro(null);
    setStatusCep(null);
    ultimaConsultaCep.current = null;
    setModalAberto(true);
  }

  function abrirEditar(c: Cliente) {
    setEditando(c);
    const digitsDoc = onlyDigits(c.documento ?? "");
    const tipoDetectado: TipoDocumento = digitsDoc.length > 11 ? "CNPJ" : "CPF";
    setTipoDocumento(tipoDetectado);
    setForm({
      nome: c.nome,
      telefone: maskTelefone(onlyDigits(c.telefone ?? "")),
      email: c.email ?? "",
      endereco: c.endereco ?? "",
      numero: c.numero ?? "",
      complemento: c.complemento ?? "",
      documento: maskDocumento(digitsDoc, tipoDetectado),
      cep: mascararCep(c.cep ?? ""),
      bairro: c.bairro ?? "",
      inscricaoEstadual: c.inscricaoEstadual ?? "",
    });
    setErro(null);
    setStatusCep(null);
    ultimaConsultaCep.current = apenasDigitosCep(c.cep ?? "") || null;
    setModalAberto(true);
  }

  function fecharModal() {
    if (salvando) return;
    setModalAberto(false);
    setEditando(null);
    setForm(emptyForm);
    setErro(null);
    setStatusCep(null);
    consultaCepRef.current?.abort();
  }

  function handleTelefoneChange(valor: string) {
    setForm((f) => ({ ...f, telefone: maskTelefone(onlyDigits(valor)) }));
  }

  function handleDocumentoChange(valor: string) {
    setForm((f) => ({ ...f, documento: maskDocumento(onlyDigits(valor), tipoDocumento) }));
  }

  function trocarTipoDocumento(tipo: TipoDocumento) {
    setTipoDocumento(tipo);
    setForm((f) => ({ ...f, documento: maskDocumento(onlyDigits(f.documento), tipo) }));
  }

  async function buscarEnderecoPorCep() {
    const cep = apenasDigitosCep(form.cep);
    if (cep.length !== 8 || cep === ultimaConsultaCep.current) return;
    consultaCepRef.current?.abort();
    const controller = new AbortController();
    consultaCepRef.current = controller;
    ultimaConsultaCep.current = cep;
    setStatusCep("Buscando endereço...");
    try {
      const endereco = await consultarCep(cep, controller.signal);
      if (controller.signal.aborted || apenasDigitosCep(form.cep) !== cep) return;
      if (!endereco) {
        setStatusCep("CEP não encontrado. Confira o número ou preencha o endereço manualmente.");
        return;
      }
      setForm((atual) =>
        apenasDigitosCep(atual.cep) === cep
          ? { ...atual, endereco: endereco.endereco, bairro: endereco.bairro }
          : atual,
      );
      setStatusCep("Endereço encontrado. Confira e complete os dados.");
      numeroRef.current?.focus();
    } catch {
      if (!controller.signal.aborted)
        setStatusCep(
          "Não foi possível consultar o CEP agora. Você pode preencher o endereço manualmente.",
        );
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!form.nome.trim()) {
      setErro("Informe o nome do cliente.");
      return;
    }
    if (!form.telefone.trim()) {
      setErro("Informe o telefone do cliente.");
      return;
    }
    if (!form.email.trim()) {
      setErro("Informe o e-mail do cliente.");
      return;
    }
    setSalvando(true);
    try {
      const payload = {
        nome: form.nome.trim(),
        telefone: form.telefone.trim(),
        email: form.email.trim(),
        endereco: form.endereco.trim(),
        numero: form.numero.trim(),
        complemento: form.complemento.trim(),
        documento: form.documento.trim(),
        cep: apenasDigitosCep(form.cep),
        bairro: form.bairro.trim(),
        inscricaoEstadual: form.inscricaoEstadual.trim(),
      };
      if (editando) {
        await fnAtualizar({ data: { ...payload, id: editando.id } });
      } else {
        await fnCriar({ data: payload });
      }
      qc.invalidateQueries({ queryKey: ["clientes"] });
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
      await fnExcluir({ data: { id: confirmDel.id } });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      setConfirmDel(null);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao excluir");
    }
  }

  const filtros: { key: FiltroCliente; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "frequentes", label: "Frequentes" },
    { key: "novos", label: "Novos" },
    { key: "atrasadores", label: "Já atrasou" },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-4xl font-display font-bold text-primary">Clientes</h1>
          <p className="font-body text-sm md:text-base text-muted-foreground mt-1">
            {clientes.length}{" "}
            {clientes.length === 1 ? "cliente cadastrado" : "clientes cadastrados"}.
          </p>
        </div>
        <button
          onClick={abrirNovo}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold text-sm px-5 py-3 rounded-md hover:bg-primary-dark shadow-warm-sm"
        >
          <Plus size={16} /> Novo Cliente
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="relative max-w-md flex-1 min-w-[220px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar por nome..."
            className="ds-input ds-input-search"
          />
        </div>

        <div className="flex items-center gap-1 md:gap-2 bg-card border border-border rounded-full p-1 shadow-warm-sm flex-wrap">
          {filtros.map((f) => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className={[
                "px-3 md:px-4 py-1.5 rounded-full text-[11px] md:text-xs font-bold uppercase tracking-wider transition",
                filtro === f.key
                  ? "bg-primary text-primary-foreground shadow-warm-sm"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div className="text-center py-16 px-6 bg-card border border-dashed border-border rounded-2xl">
          <Users className="mx-auto text-muted-foreground mb-3" size={40} />
          <p className="font-body text-sm text-muted-foreground">
            {busca || filtro !== "todos"
              ? "Nenhum cliente encontrado com esse filtro."
              : "Cadastre seu primeiro cliente."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map((c) => {
            const vendasCliente = vendas.filter((v: any) => v.cliente_id === c.id);
            const frequencia = classificarFrequencia(vendasCliente.length);
            return (
              <article
                key={c.id}
                className="bg-card border border-border rounded-2xl p-5 shadow-warm-sm flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-lg font-bold text-foreground truncate">
                      {c.nome}
                    </h2>
                    <FrequenciaBadge frequencia={frequencia} />
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

                <div className="space-y-2 text-sm text-foreground font-body">
                  <Linha icon={<Phone size={13} />} value={c.telefone} placeholder="Sem telefone" />
                  <Linha icon={<Mail size={13} />} value={c.email} placeholder="Sem e-mail" />
                  <Linha
                    icon={<MapPin size={13} />}
                    value={
                      c.endereco
                        ? `${c.endereco}${c.numero ? `, ${c.numero}` : ""}${c.complemento ? ` · ${c.complemento}` : ""}`
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

                {(c.cep || c.bairro || c.inscricaoEstadual) && (
                  <div className="text-xs text-muted-foreground bg-secondary/60 rounded-md px-3 py-2 font-body space-y-1">
                    {c.cep && <div>CEP: {mascararCep(c.cep)}</div>}
                    {c.bairro && <div>Bairro: {c.bairro}</div>}
                    {c.inscricaoEstadual && <div>Inscrição estadual: {c.inscricaoEstadual}</div>}
                  </div>
                )}

                <button
                  onClick={() => setPerfilAberto(c)}
                  className="mt-1 text-xs font-bold text-primary inline-flex items-center gap-1 self-start"
                >
                  <Eye size={13} /> Ver perfil de compras
                </button>
              </article>
            );
          })}
        </div>
      )}

      {modalAberto && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4"
          onClick={fecharModal}
        >
          <div
            className="bg-card w-full md:max-w-lg md:rounded-2xl rounded-t-2xl shadow-warm-sm max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-primary">
                {editando ? "Editar cliente" : "Novo cliente"}
              </h2>
              <button
                onClick={fecharModal}
                aria-label="Fechar"
                className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={salvar} className="p-6 space-y-4">
              <Campo label="Nome *">
                <input
                  autoFocus
                  className="ds-input"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex.: Dona Maria"
                />
              </Campo>
              <Campo label="Telefone *">
                <input
                  type="tel"
                  inputMode="numeric"
                  required
                  className="ds-input"
                  value={form.telefone}
                  onChange={(e) => handleTelefoneChange(e.target.value)}
                  placeholder="(11) 99999-9999"
                  maxLength={15}
                />
              </Campo>
              <Campo label="E-mail *">
                <input
                  type="email"
                  required
                  className="ds-input"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="cliente@email.com"
                />
              </Campo>
              <Campo label="CEP">
                <input
                  inputMode="numeric"
                  autoComplete="postal-code"
                  className="ds-input"
                  value={form.cep}
                  onChange={(e) => {
                    const cep = mascararCep(e.target.value);
                    if (apenasDigitosCep(cep) !== ultimaConsultaCep.current) {
                      consultaCepRef.current?.abort();
                    }
                    setForm({ ...form, cep });
                    setStatusCep(null);
                    if (apenasDigitosCep(cep).length !== 8) ultimaConsultaCep.current = null;
                  }}
                  onBlur={buscarEnderecoPorCep}
                  placeholder="00000-000"
                  maxLength={9}
                  aria-describedby="status-cep"
                />
                {statusCep && (
                  <p id="status-cep" role="status" className="mt-1.5 text-sm text-muted-foreground">
                    {statusCep}
                  </p>
                )}
              </Campo>
              <Campo label="Rua ou endereço">
                <input
                  className="ds-input"
                  value={form.endereco}
                  onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                  placeholder="Ex.: Rua das Flores"
                  maxLength={255}
                />
              </Campo>
              <Campo label="Número">
                <input
                  ref={numeroRef}
                  type="text"
                  className="ds-input"
                  value={form.numero}
                  onChange={(e) => setForm({ ...form, numero: e.target.value })}
                  placeholder="Ex.: 123 ou S/N"
                  maxLength={20}
                />
              </Campo>
              <Campo label="Complemento (opcional)">
                <input
                  type="text"
                  className="ds-input"
                  value={form.complemento}
                  onChange={(e) => setForm({ ...form, complemento: e.target.value })}
                  placeholder="Ex.: Casa 2, fundos ou apartamento"
                  maxLength={120}
                />
              </Campo>
              <Campo label="Bairro">
                <input
                  className="ds-input"
                  value={form.bairro}
                  onChange={(e) => setForm({ ...form, bairro: e.target.value })}
                  placeholder="Ex.: Centro"
                  maxLength={120}
                />
              </Campo>

              <div>
                <label className="text-sm font-semibold text-foreground mb-1.5 block">
                  Documento
                </label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {(["CPF", "CNPJ"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => trocarTipoDocumento(t)}
                      className={[
                        "py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-colors",
                        tipoDocumento === t
                          ? "bg-primary text-primary-foreground shadow-warm-sm"
                          : "bg-secondary text-brown-mid hover:bg-beige-dark",
                      ].join(" ")}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <input
                  inputMode="numeric"
                  className="ds-input"
                  value={form.documento}
                  onChange={(e) => handleDocumentoChange(e.target.value)}
                  placeholder={tipoDocumento === "CPF" ? "000.000.000-00" : "00.000.000/0000-00"}
                  maxLength={tipoDocumento === "CPF" ? 14 : 18}
                />
              </div>
              <Campo label="Inscrição estadual">
                <input
                  type="text"
                  className="ds-input"
                  value={form.inscricaoEstadual}
                  onChange={(e) => setForm({ ...form, inscricaoEstadual: e.target.value })}
                  placeholder={tipoDocumento === "CNPJ" ? "Número ou ISENTO" : "Opcional"}
                  maxLength={40}
                />
              </Campo>

              {erro && (
                <div className="bg-error-bg border-l-4 border-error text-error rounded-md px-4 py-3 text-sm font-medium">
                  {erro}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={fecharModal}
                  disabled={salvando}
                  className="px-5 py-3 rounded-md font-semibold text-sm border border-border bg-card text-brown-mid hover:bg-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="flex-1 px-5 py-3 rounded-md font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary-dark shadow-warm-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Check size={16} />{" "}
                  {salvando ? "Salvando..." : editando ? "Salvar alterações" : "Cadastrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                <Trash2 size={14} /> Excluir
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
  if (qtdCompras === 0) return "sem_compras";
  if (qtdCompras === 1) return "novo";
  if (qtdCompras <= 2) return "recorrente";
  return "frequente";
}

type Comportamento = "sem_historico" | "pontual" | "parcelador" | "atrasador";

function classificarComportamento(vendasCliente: any[]) {
  const relevantes = vendasCliente.filter((v) => v.status_pagamento !== "NAO_SE_APLICA");
  if (relevantes.length === 0) {
    return { tipo: "sem_historico" as Comportamento, qtdAtraso: 0, qtdParcelada: 0, total: 0 };
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
  return { tipo, qtdAtraso, qtdParcelada, total: relevantes.length };
}

// ----- Componentes visuais -----

function FrequenciaBadge({ frequencia }: { frequencia: Frequencia }) {
  const map: Record<Frequencia, { label: string; cls: string; Icon: any }> = {
    sem_compras: { label: "Sem compras ainda", cls: "text-muted-foreground", Icon: Clock },
    novo: { label: "Cliente novo", cls: "text-info", Icon: Sparkles },
    recorrente: { label: "Cliente recorrente", cls: "text-gold-dark", Icon: Star },
    frequente: { label: "Cliente frequente", cls: "text-success", Icon: Star },
  };
  const { label, cls, Icon } = map[frequencia];
  return (
    <div className={`inline-flex items-center gap-1 text-[11px] font-semibold mt-0.5 ${cls}`}>
      <Icon size={12} /> {label}
    </div>
  );
}

function ComportamentoBadge({ tipo }: { tipo: Comportamento }) {
  const map: Record<Comportamento, { label: string; cls: string; Icon: any }> = {
    sem_historico: {
      label: "Sem histórico suficiente",
      cls: "bg-secondary text-brown-mid",
      Icon: Clock,
    },
    pontual: { label: "Costuma pagar em dia", cls: "bg-success-bg text-success", Icon: ThumbsUp },
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
      <Icon size={16} /> {label}
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
                cliente.cep) && (
                <p>
                  {[
                    cliente.endereco &&
                      `${cliente.endereco}${cliente.numero ? `, ${cliente.numero}` : ""}`,
                    cliente.complemento,
                    cliente.bairro,
                    cliente.cep && `CEP ${mascararCep(cliente.cep)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              {cliente.inscricaoEstadual && <p>Inscrição estadual: {cliente.inscricaoEstadual}</p>}
            </div>
          </section>
          {/* Card 1: resumo de compras */}
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

          {/* Card 2: comportamento de pagamento */}
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

          {/* Card 3: histórico completo */}
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

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-semibold text-foreground mb-1.5 block">{label}</label>
      {children}
    </div>
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
