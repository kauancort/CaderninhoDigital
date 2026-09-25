import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("configuração da Vercel", () => {
  it("mantém a URL e reescreve rotas da SPA para index.html", () => {
    const config = JSON.parse(readFileSync(resolve(process.cwd(), "vercel.json"), "utf8"));
    expect(config.rewrites).toContainEqual({ source: "/(.*)", destination: "/index.html" });
    expect(config.redirects).toBeUndefined();
  });

  it("impede indexação do painel privado", () => {
    const config = JSON.parse(readFileSync(resolve(process.cwd(), "vercel.json"), "utf8"));
    expect(JSON.stringify(config.headers)).toContain("X-Robots-Tag");
    expect(readFileSync(resolve(process.cwd(), "public/robots.txt"), "utf8")).toContain(
      "Disallow: /",
    );
  });
});
