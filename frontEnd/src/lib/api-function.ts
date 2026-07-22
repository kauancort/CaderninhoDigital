type Validator = (data: unknown) => unknown;

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
    handler<TResult>(fn: (args: { data: any }) => TResult | Promise<TResult>) {
      return async (options?: { data?: unknown }): Promise<TResult> => {
        const data = validate ? validate(options?.data) : options?.data;
        return await fn({ data });
      };
    },
  };
  return builder;
}

export function useApiFn<T>(fn: T): T {
  return fn;
}
