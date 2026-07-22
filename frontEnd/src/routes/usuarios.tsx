import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, UserPlus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { criarUsuario, listarUsuarios } from "@/lib/auth.functions";

export const Route = createFileRoute("/usuarios")({ component: UsuariosPage });

function UsuariosPage() {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cargoFuncao, setCargoFuncao] = useState("");
  const [perfil, setPerfil] = useState<"GESTOR" | "FUNCIONARIO">("GESTOR");
  const [credencial, setCredencial] = useState<{ email: string; senha: string } | null>(null);
  const { data: usuarios = [] } = useQuery({ queryKey: ["usuarios"], queryFn: listarUsuarios });
  const mutation = useMutation({
    mutationFn: criarUsuario,
    onSuccess: (result) => {
      setCredencial({ email: result.usuario.email, senha: result.senhaTemporaria });
      setNome("");
      setEmail("");
      setCargoFuncao("");
      setPerfil("GESTOR");
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    },
  });

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setCredencial(null);
    mutation.mutate({
      nome: nome.trim(),
      email: email.trim(),
      cargoFuncao: cargoFuncao.trim(),
      perfil,
    });
  }

  return (
    <AppShell>
      <div className="max-w-5xl space-y-6">
        <header>
          <div className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Acesso
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-primary">Usuários</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie contas e entregue a senha temporária uma única vez.
          </p>
        </header>
        <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
          <form
            onSubmit={salvar}
            className="rounded-2xl border border-border bg-card p-5 shadow-warm-sm space-y-4"
          >
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <UserPlus size={18} /> Novo usuário
            </h2>
            <input
              className="ds-input"
              placeholder="Nome completo"
              required
              maxLength={120}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
            <input
              className="ds-input"
              type="email"
              placeholder="E-mail"
              required
              maxLength={160}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="ds-input"
              placeholder="Cargo ou função"
              required
              maxLength={80}
              value={cargoFuncao}
              onChange={(e) => setCargoFuncao(e.target.value)}
            />
            <select
              className="ds-input"
              value={perfil}
              onChange={(e) => setPerfil(e.target.value as typeof perfil)}
            >
              <option value="GESTOR">Gestor</option>
              <option value="FUNCIONARIO">Funcionário</option>
            </select>
            {mutation.error && <div className="text-sm text-error">{mutation.error.message}</div>}
            <button
              disabled={mutation.isPending}
              className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {mutation.isPending ? "Criando..." : "Criar conta"}
            </button>
            {credencial && (
              <div className="rounded-lg border border-warning bg-warning-bg p-3 text-sm">
                <strong>Senha temporária de {credencial.email}</strong>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 rounded bg-card px-2 py-1.5">{credencial.senha}</code>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(credencial.senha)}
                    aria-label="Copiar senha"
                  >
                    <Copy size={17} />
                  </button>
                </div>
                <p className="mt-2 text-xs">Copie agora. Ela não será exibida novamente.</p>
              </div>
            )}
          </form>
          <section className="rounded-2xl border border-border bg-card shadow-warm-sm overflow-hidden">
            <div className="border-b border-border px-5 py-4 font-display font-bold">
              Contas cadastradas
            </div>
            <div className="divide-y divide-border">
              {usuarios.map((usuario) => (
                <div key={usuario.id} className="px-5 py-4">
                  <div className="font-semibold text-foreground">{usuario.nome}</div>
                  <div className="text-sm text-muted-foreground">
                    {usuario.email} · {usuario.cargoFuncao}
                  </div>
                  <span className="mt-1 inline-block rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold">
                    {usuario.perfil}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
