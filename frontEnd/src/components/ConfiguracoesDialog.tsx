import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, Save, Settings } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { atualizarMeuPerfil } from "@/lib/auth.functions";
import { updateSessionUser, type User } from "@/lib/user-session";

export function ConfiguracoesDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
}) {
  const [nome, setNome] = useState(user.nome);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [mostrarSenhas, setMostrarSenhas] = useState(false);

  useEffect(() => {
    if (open) {
      setNome(user.nome);
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmacao("");
    }
  }, [open, user.nome]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!nome.trim()) throw new Error("Informe o seu nome.");
      if (novaSenha && novaSenha !== confirmacao) {
        throw new Error("A confirmação da nova senha não coincide.");
      }
      if (novaSenha && !senhaAtual) {
        throw new Error("Informe a senha atual para definir uma nova senha.");
      }
      return atualizarMeuPerfil({ nome, senhaAtual, novaSenha });
    },
    onSuccess: (usuario) => {
      updateSessionUser(usuario);
      toast.success("Configurações atualizadas.");
      onOpenChange(false);
    },
    onError: (erro) =>
      toast.error(erro instanceof Error ? erro.message : "Não foi possível atualizar o perfil."),
  });

  return (
    <Dialog open={open} onOpenChange={(value) => !mutation.isPending && onOpenChange(value)}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2 font-display text-2xl">
            <Settings size={20} className="text-primary" /> Configurações
          </DialogTitle>
          <DialogDescription>
            Atualize o seu nome ou defina uma nova senha para esta conta.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!mutation.isPending) mutation.mutate();
          }}
        >
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">Nome</span>
            <input
              className="ds-input"
              value={nome}
              maxLength={120}
              onChange={(event) => setNome(event.target.value)}
              autoComplete="name"
            />
          </label>

          <div className="border-t border-border pt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold">Alterar senha</h3>
              <button
                type="button"
                onClick={() => setMostrarSenhas((atual) => !atual)}
                className="inline-flex items-center gap-1 text-xs font-bold text-primary"
              >
                {mostrarSenhas ? <EyeOff size={14} /> : <Eye size={14} />}
                {mostrarSenhas ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            <div className="space-y-3">
              <CampoSenha
                label="Senha atual"
                value={senhaAtual}
                onChange={setSenhaAtual}
                visivel={mostrarSenhas}
                autoComplete="current-password"
              />
              <CampoSenha
                label="Nova senha"
                value={novaSenha}
                onChange={setNovaSenha}
                visivel={mostrarSenhas}
                autoComplete="new-password"
              />
              <CampoSenha
                label="Confirmar nova senha"
                value={confirmacao}
                onChange={setConfirmacao}
                visivel={mostrarSenhas}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                Deixe os campos de senha vazios para alterar somente o nome. A nova senha deve ter
                entre 6 e 72 caracteres, com ao menos uma letra e um número.
              </p>
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => onOpenChange(false)}
              className="ds-button-secondary min-h-11 px-4"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              <Save size={15} />
              {mutation.isPending ? "Salvando..." : "Salvar alterações"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CampoSenha({
  label,
  value,
  onChange,
  visivel,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visivel: boolean;
  autoComplete: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <input
        type={visivel ? "text" : "password"}
        className="ds-input"
        value={value}
        maxLength={72}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
      />
    </label>
  );
}
