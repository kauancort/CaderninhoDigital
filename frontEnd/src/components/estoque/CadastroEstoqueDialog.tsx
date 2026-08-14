import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PackagePlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  atualizarMateriaPrimaBasica,
  atualizarProdutoBasico,
  criarMateriaPrima,
  criarProduto,
} from "@/lib/catalogo.functions";
import { useApiFn } from "@/lib/api-function";

type TipoCadastro = "PRODUTO" | "MATERIA_PRIMA";

export type ItemEdicaoEstoque = {
  id: string;
  nome: string;
  tipo: TipoCadastro;
  unidade: string;
  estoqueMinimo?: number;
  precoVenda?: number;
  sku?: string;
};

export function CadastroEstoqueDialog({
  tipo,
  open,
  onClose,
  item,
}: {
  tipo: TipoCadastro;
  open: boolean;
  onClose: () => void;
  item?: ItemEdicaoEstoque | null;
}) {
  const queryClient = useQueryClient();
  const fnCriarProduto = useApiFn(criarProduto);
  const fnCriarMateriaPrima = useApiFn(criarMateriaPrima);
  const fnAtualizarProduto = useApiFn(atualizarProdutoBasico);
  const fnAtualizarMateriaPrima = useApiFn(atualizarMateriaPrimaBasica);
  const [nome, setNome] = useState("");
  const [sku, setSku] = useState("");
  const [preco, setPreco] = useState("");
  const [unidade, setUnidade] = useState("kg");
  const [estoqueInicial, setEstoqueInicial] = useState("0");
  const [estoqueMinimo, setEstoqueMinimo] = useState("0");
  const [erro, setErro] = useState<string | null>(null);

  const produto = tipo === "PRODUTO";
  const editando = Boolean(item);

  useEffect(() => {
    if (!open) return;
    setNome(item?.nome ?? "");
    setSku(item?.sku ?? "");
    setPreco(item?.precoVenda !== undefined ? String(item.precoVenda).replace(".", ",") : "");
    setUnidade(item?.unidade ?? "kg");
    setEstoqueInicial("0");
    setEstoqueMinimo(String(item?.estoqueMinimo ?? 0));
    setErro(null);
  }, [open, tipo, item]);

  const cadastro = useMutation({
    mutationFn: async () => {
      const quantidadeInicial = numero(estoqueInicial);
      if (!nome.trim()) throw new Error("Informe o nome.");
      if (quantidadeInicial < 0) throw new Error("A quantidade inicial não pode ser negativa.");

      if (produto) {
        const precoVenda = numero(preco);
        if (precoVenda <= 0) throw new Error("Informe um preço de venda maior que zero.");
        if (item) {
          return fnAtualizarProduto({
            data: {
              id: item.id,
              nome: nome.trim(),
              preco_venda: precoVenda,
              sku: sku.trim() || null,
            },
          });
        }
        return fnCriarProduto({
          data: {
            nome: nome.trim(),
            preco_venda: precoVenda,
            custo_estimado: 0,
            sku: sku.trim() || null,
            categoria_id: null,
            imagem: null,
            estoque_inicial: quantidadeInicial,
          },
        });
      }

      if (item) {
        return fnAtualizarMateriaPrima({
          data: {
            id: item.id,
            nome: nome.trim(),
            unidade,
            estoque_minimo: numero(estoqueMinimo),
          },
        });
      }

      return fnCriarMateriaPrima({
        data: {
          nome: nome.trim(),
          unidade,
          estoque_minimo: numero(estoqueMinimo),
          estoque_inicial: quantidadeInicial,
        },
      });
    },
    onSuccess: async () => {
      const raiz = produto ? "produtos" : "materia_prima";
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [raiz] }),
        queryClient.invalidateQueries({ queryKey: ["movimentacoes_estoque"] }),
        queryClient.invalidateQueries({ queryKey: ["movimentacoes_estoque_resumo"] }),
      ]);
      toast.success(
        editando
          ? produto
            ? "Cadastro do produto atualizado."
            : "Cadastro da matéria-prima atualizado."
          : produto
            ? "Produto adicionado ao estoque."
            : "Matéria-prima adicionada.",
      );
      onClose();
    },
    onError: (error) =>
      setErro(error instanceof Error ? error.message : "Não foi possível concluir o cadastro."),
  });

  return (
    <Dialog open={open} onOpenChange={(aberto) => !aberto && !cadastro.isPending && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg rounded-2xl border-border bg-card">
        <DialogHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-bg text-primary">
            <PackagePlus size={21} />
          </div>
          <DialogTitle className="font-display text-2xl text-foreground">
            {editando
              ? produto
                ? "Editar produto"
                : "Editar matéria-prima"
              : produto
                ? "Adicionar produto"
                : "Adicionar matéria-prima"}
          </DialogTitle>
          <DialogDescription>
            {editando
              ? "Altere somente as informações do cadastro. O saldo do estoque não será modificado."
              : produto
                ? "Cadastre somente as informações necessárias para começar a usar o produto."
                : "O item ficará disponível em compras e produções."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setErro(null);
            cadastro.mutate();
          }}
        >
          <Campo label="Nome *">
            <input
              autoFocus
              className="ds-input"
              value={nome}
              maxLength={120}
              onChange={(event) => setNome(event.target.value)}
              placeholder={produto ? "Ex.: Pé de moleque" : "Ex.: Amendoim"}
            />
          </Campo>

          {produto ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Preço de venda *">
                <input
                  className="ds-input"
                  inputMode="decimal"
                  value={preco}
                  onChange={(event) => setPreco(event.target.value)}
                  placeholder="0,00"
                />
              </Campo>
              <Campo label="Código (opcional)">
                <input
                  className="ds-input"
                  value={sku}
                  maxLength={60}
                  onChange={(event) => setSku(event.target.value)}
                  placeholder="Ex.: PAC-01"
                />
              </Campo>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Unidade de medida *">
                <select
                  className="ds-input"
                  value={unidade}
                  onChange={(event) => setUnidade(event.target.value)}
                >
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="un">unidade</option>
                  <option value="L">litro</option>
                  <option value="ml">ml</option>
                  <option value="lata">lata</option>
                </select>
              </Campo>
              <Campo label="Estoque mínimo">
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  className="ds-input"
                  value={estoqueMinimo}
                  onChange={(event) => setEstoqueMinimo(event.target.value)}
                />
              </Campo>
            </div>
          )}

          {!editando && (
            <Campo label={`Quantidade inicial (${produto ? "unidades" : unidade})`}>
              <input
                type="number"
                min="0"
                step="0.001"
                className="ds-input"
                value={estoqueInicial}
                onChange={(event) => setEstoqueInicial(event.target.value)}
              />
            </Campo>
          )}

          {erro && <p className="rounded-xl bg-error-bg px-3 py-2 text-sm text-error">{erro}</p>}

          <DialogFooter className="gap-2 pt-2">
            <button
              type="button"
              className="ds-button-secondary min-h-11 px-4"
              onClick={onClose}
              disabled={cadastro.isPending}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="ds-button-primary min-h-11 px-5"
              disabled={cadastro.isPending}
            >
              {cadastro.isPending
                ? "Salvando..."
                : editando
                  ? "Salvar alterações"
                  : produto
                    ? "Adicionar produto"
                    : "Adicionar matéria-prima"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm font-semibold text-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}

function numero(valor: string) {
  return Number(valor.replace(",", ".")) || 0;
}
