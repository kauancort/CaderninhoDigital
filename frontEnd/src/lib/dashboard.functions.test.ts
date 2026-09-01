import { describe, expect, it } from "vitest";
import { dataLocalParaIso, normalizarDataVenda } from "./dashboard.functions";
import { fmtDate } from "./format";

describe("datas do dashboard", () => {
  it("mantém a data local sem deslocá-la para UTC", () => {
    const data = new Date(2026, 7, 28, 23, 30);

    expect(dataLocalParaIso(data)).toBe("2026-08-28");
  });

  it("aceita data da API no formato de data ou datetime", () => {
    expect(normalizarDataVenda("2026-08-28")).toBe("2026-08-28");
    expect(normalizarDataVenda("2026-08-28T23:30:00")).toBe("2026-08-28");
    expect(normalizarDataVenda(null)).toBe("");
  });

  it("exibe uma data de venda no dia correto no horário local", () => {
    expect(fmtDate("2026-08-29")).toContain("29");
  });
});
