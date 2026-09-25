import type { ClientRequest, IncomingMessage } from "node:http";

export const LOCAL_API_TARGET = "http://localhost:8080";

export function rewriteLocalProxyOrigin(proxyReq: ClientRequest, req: IncomingMessage) {
  // A chamada do navegador é same-origin com o Vite. Remover Origin no salto
  // interno evita que o CORS do Spring rejeite IPs da rede local.
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (host && (origin === `http://${host}` || origin === `https://${host}`)) {
    proxyReq.removeHeader("origin");
  }
}
