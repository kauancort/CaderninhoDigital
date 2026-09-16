import type { ClientRequest, IncomingMessage } from "node:http";
import { describe, expect, it, vi } from "vitest";
import { LOCAL_API_TARGET, rewriteLocalProxyOrigin } from "./dev-api-proxy";

describe("origem do proxy de desenvolvimento", () => {
  it.each(["localhost:3000", "192.168.0.15:3000", "192.168.0.15:3001"])(
    "encaminha requisições da própria página em %s",
    (host) => {
      const setHeader = vi.fn();
      const removeHeader = vi.fn();
      rewriteLocalProxyOrigin(
        { setHeader, removeHeader } as unknown as ClientRequest,
        { headers: { host, origin: `http://${host}` } } as IncomingMessage,
      );
      expect(removeHeader).toHaveBeenCalledWith("origin");
      expect(setHeader).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, "https://external.example", "http://192.168.0.15:9999"])(
    "não reescreve uma origem ausente ou externa: %s",
    (origin) => {
      const setHeader = vi.fn();
      const removeHeader = vi.fn();
      rewriteLocalProxyOrigin(
        { setHeader, removeHeader } as unknown as ClientRequest,
        { headers: { host: "192.168.0.15:3000", origin } } as IncomingMessage,
      );
      expect(setHeader).not.toHaveBeenCalled();
      expect(removeHeader).not.toHaveBeenCalled();
    },
  );
});
