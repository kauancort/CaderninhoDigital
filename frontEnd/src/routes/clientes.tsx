import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiFn } from "@/lib/api-function";
import { Plus, Search, Users, Pencil, Trash2, Phone, Mail, MapPin, X, Check } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  listarClientes,
  criarCliente,
  atualizarCliente,
  excluirCliente,
} from "@/lib/clientes.functions";

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
  documento: string;
};

type FormState = {
  nome: string;
  telefone: string;
  email: string;
  endereco: string;
  documento: string;
};

const emptyForm: FormState = {
  nome: "",
  telefone: "",
  email: "",
  endereco: "",
  documento: "",
};

function Clientes() {
  const qc = useQueryClient();
  const fnCriar = useApiFn(criarCliente);
  const fnAtualizar = useApiFn(atualizarCliente);
  const fnExcluir = useApiFn(excluirCliente);

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes"],
    queryFn: () => listarClientes() as Promise<Cliente[]>,
  });

  const [busca, setBusca] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<Cliente | null>(null);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) => c.nome.toLowerCase().includes(q));
  }, [clientes, busca]);

  function abrirNovo() {
    setEditando(null);
    setForm(emptyForm);
    setErro(null);
    setModalAberto(true);
  }

  function abrirEditar(c: Cliente) {
    setEditando(c);
    setForm({
      nome: c.nome,
      telefone: c.telefone ?? "",
      email: c.email ?? "",
      endereco: c.endereco ?? "",
      documento: c.documento ?? "",
    });
    setErro(null);
    setModalAberto(true);
  }

  function fecharModal() {
    if (salvando) return;
    setModalAberto(false);
    setEditando(null);
    setForm(emptyForm);
    setErro(null);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!form.nome.trim()) {
      setErro("Informe o nome do cliente.");
      return;
    }
    setSalvando(true);
    try {
      const payload = {
        nome: form.nome.trim(),
        telefone: form.telefone.trim(),
        email: form.email.trim(),
        endereco: form.endereco.trim(),
        documento: form.documento.trim(),
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

      <div className="relative max-w-md">
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

      {filtrados.length === 0 ? (
        <div className="text-center py-16 px-6 bg-card border border-dashed border-border rounded-2xl">
          <Users className="mx-auto text-muted-foreground mb-3" size={40} />
          <p className="font-body text-sm text-muted-foreground">
            {busca ? "Nenhum cliente encontrado." : "Cadastre seu primeiro cliente."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map((c) => (
            <article
              key={c.id}
              className="bg-card border border-border rounded-2xl p-5 shadow-warm-sm flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-bold text-foreground truncate">
                    {c.nome}
                  </h2>
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
                <Linha icon={<MapPin size={13} />} value={c.endereco} placeholder="Sem endereço" />
              </div>

              {c.documento && (
                <div className="mt-1 text-xs text-muted-foreground bg-secondary/60 rounded-md px-3 py-2 font-body">
                  Documento: {c.documento}
                </div>
              )}
            </article>
          ))}
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
              <Campo label="Telefone">
                <input
                  className="ds-input"
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </Campo>
              <Campo label="E-mail">
                <input
                  type="email"
                  className="ds-input"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="cliente@email.com"
                />
              </Campo>
              <Campo label="Endereço">
                <input
                  className="ds-input"
                  value={form.endereco}
                  onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                  placeholder="Rua, número, bairro"
                />
              </Campo>
              <Campo label="Documento">
                <input
                  className="ds-input"
                  value={form.documento}
                  onChange={(e) => setForm({ ...form, documento: e.target.value })}
                  placeholder="CPF ou CNPJ"
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

      <style>{`.ds-input{width:100%;font-family:var(--font-sans);font-size:1rem;color:var(--color-foreground);background:var(--color-card);border:1.5px solid var(--color-border);border-radius:.5rem;padding:.6rem .85rem;min-height:44px;outline:none;transition:all 150ms ease;}.ds-input.ds-input-search{padding-left:3rem;}.ds-input:focus{border-color:var(--color-primary);box-shadow:0 0 0 3px oklch(0.48 0.19 27/0.12);}`}</style>
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
