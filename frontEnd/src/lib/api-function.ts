import { getUsuarioId } from "./api-client";

type Validator = (data: unknown) => unknown;
// Adaptador temporário para preservar a API das telas durante a separação do BFF.
// Tudo aqui roda no navegador; não há função ou segredo server-side neste projeto.
export function createApiFn(_options: { method: "GET" | "POST" }) {
  let validate: Validator | undefined;
  const builder = {
    middleware(..._middleware: unknown[]) {
      return builder;
    },
    inputValidator(fn: Validator) {
      validate = fn;
      return builder;
    },
    validator(fn: Validator) {
      validate = fn;
      return builder;
    },
    handler<TResult>(
      fn: (args: { data: any; context: { userId: number } }) => TResult | Promise<TResult>,
    ) {
      return async (options?: { data?: unknown }): Promise<TResult> => {
        const data = validate ? validate(options?.data) : options?.data;
        return await fn({ data, context: { userId: getUsuarioId() } });
      };
    },
  };
  return builder;
}

export function useApiFn<T>(fn: T): T {
  return fn;
}
