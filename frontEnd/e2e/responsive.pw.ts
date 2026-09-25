import { expect, test, type Page } from "@playwright/test";

const nome = "Mercado e Distribuidora de Doces Artesanais São Francisco";
const cliente = {
  id: 1,
  nome,
  tipo: "CLIENTE",
  email: "contato.distribuidora@example.com",
  telefone: "14999999999",
  cidade: "Marília",
  estado: "SP",
  endereco: "Avenida dos Doces Artesanais",
  numero: "123",
  ativo: true,
};
const produto = {
  id: 1,
  nome: "Paçoca artesanal tradicional com amendoim selecionado",
  precoVenda: 1234.56,
  estoqueAtual: 12345,
  unidadeMedida: "UN",
  ativo: true,
};
const materia = {
  id: 1,
  nome: "Amendoim torrado sem casca para produção artesanal",
  estoqueAtual: 12345,
  estoqueMinimo: 100,
  custoMedio: 123.45,
  unidadeMedida: "kg",
};
const venda = {
  id: 1,
  clienteNome: nome,
  clienteId: 1,
  dataVenda: "2026-09-11",
  valorTotal: 1234567.89,
  quantidadeItens: 1234,
  formaPagamento: "PIX",
  statusPagamento: "PENDENTE",
  emAtraso: false,
  itens: [],
};
const pagina = (registros: unknown[]) => ({
  registros,
  totalRegistros: registros.length,
  totalPaginas: 1,
  paginaAtual: 0,
  tamanhoPagina: 20,
  temAnterior: false,
  temProxima: false,
});

async function preparar(page: Page) {
  // Fontes externas não devem tornar estes testes dependentes da rede.
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
  await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
  const user = {
    id: 1,
    nome: "Gestora",
    email: "administracao.doces@example.com",
    perfil: "GESTOR",
    cargoFuncao: "Gestão",
  };
  await page.addInitScript((user) => {
    localStorage.setItem(
      "userSession",
      JSON.stringify({
        user,
        token: "layout-fixture",
        tokenType: "Bearer",
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        expiresIn: 3600,
      }),
    );
  }, user);
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    let json: unknown = [];
    if (path.startsWith("/auth/")) json = user;
    else if (path === "/dashboard/resumo") json = { totalVendas: 1234567.89, totalProducao: 12345 };
    else if (path === "/vendas/historico/resumo")
      json = {
        faturamento: 1234567.89,
        quantidadeVendas: 1234,
        quantidadeItens: 12345,
        ticketMedio: 123456.78,
      };
    else if (path === "/vendas/historico") json = pagina([venda]);
    else if (path === "/vendas") json = [venda];
    else if (path.includes("cobrancas"))
      json = path.includes("resumo")
        ? {
            totalReceber: 1234567.89,
            totalVencido: 123456.78,
            totalEmDia: 123456.78,
            quantidadeCobrancas: 1234,
            quantidadeAtrasadas: 123,
          }
        : pagina([]);
    else if (path === "/clientes/pagina") json = pagina([cliente]);
    else if (path === "/clientes") json = [cliente];
    else if (path === "/produtos/pagina") json = pagina([produto]);
    else if (path === "/produtos") json = [produto];
    else if (path === "/materias-primas/pagina") json = pagina([materia]);
    else if (path === "/materias-primas") json = [materia];
    else if (path === "/materias-primas/resumo-estoque")
      json = { totalItens: 12, totalBaixos: 0, valorEstoque: 1234567.89 };
    else if (path.includes("historico") || path.includes("/pagina")) json = pagina([]);
    await route.fulfill({ json });
  });
}

async function semTransbordamento(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  const cortados = await page
    .locator(".metric-value")
    .evaluateAll((elements) =>
      elements.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent),
    );
  expect(cortados).toEqual([]);
}

test.beforeEach(async ({ page }) => preparar(page));

test("conteúdo preenchido cabe na tela e navegação permanece fixa ao rolar", async ({ page }) => {
  for (const path of [
    "/",
    "/vendas",
    "/vendas/a-receber",
    "/clientes",
    "/estoque/consultar",
    "/registrar/venda",
    "/registrar/compra",
    "/registrar/producao",
    "/registrar/gastos",
  ]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".app-content")).toBeVisible();
    await expect(
      page.getByText("Não foi possível carregar esta página", { exact: true }),
    ).toHaveCount(0);
    await page.waitForTimeout(450);
    await semTransbordamento(page);
    if (test.info().project.name === "mobile") {
      await page.screenshot({
        path: test.info().outputPath(`${path.replaceAll("/", "_") || "home"}.png`),
        fullPage: true,
      });
    }
    const nav = page.getByRole("navigation", { name: "Navegação principal", exact: true });
    if (page.viewportSize()!.width < 1024) {
      await expect(nav).toBeVisible();
      const before = await nav.boundingBox();
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(100);
      const after = await nav.boundingBox();
      expect(after!.y).toBeCloseTo(before!.y, 0);
      expect(after!.y + after!.height).toBeCloseTo(page.viewportSize()!.height, 0);
      const content = await page.locator(".app-content").boundingBox();
      expect(content!.y + content!.height).toBeLessThanOrEqual(after!.y);
    } else await expect(nav).toBeHidden();
  }
});

test("filtros são acessíveis e menu Mais rola em telas baixas", async ({ page }) => {
  await page.goto("/vendas", { waitUntil: "domcontentloaded" });
  if (page.viewportSize()!.width < 768) {
    await expect(page.getByRole("button", { name: "Mostrar filtros" })).toBeVisible();
    await page.getByRole("button", { name: "Mostrar filtros" }).click();
  }
  await expect(page.getByRole("button", { name: "Recolher filtros" })).toBeVisible();
  await semTransbordamento(page);
  if (page.viewportSize()!.width < 1024) {
    await page.getByRole("button", { name: "Abrir mais opções" }).click();
    const menu = page.getByRole("dialog");
    await expect(menu).toBeVisible();
    await menu.getByRole("button", { name: "Sair", exact: true }).scrollIntoViewIfNeeded();
    const bounds = await menu.boundingBox();
    expect(bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    await expect(menu.getByRole("button", { name: "Sair", exact: true })).toBeInViewport();
  }
});

test("formulário de venda avulsa e cadastro de cliente continuam utilizáveis", async ({ page }) => {
  await page.goto("/registrar/venda", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Venda Avulsa").check();
  await semTransbordamento(page);
  await page.getByRole("button", { name: "Novo", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await expect(dialog.getByRole("button", { name: /Salvar|Cadastrar/ }).last()).toBeInViewport();
});

test("barra e ações do modal se adaptam à redução da altura disponível", async ({ page }) => {
  await page.goto("/registrar/venda", { waitUntil: "domcontentloaded" });
  await page.setViewportSize({ width: 390, height: 420 });
  const nav = page.getByRole("navigation", { name: "Navegação principal", exact: true });
  await expect(nav).toBeInViewport();
  await page.getByRole("button", { name: "Novo", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Salvar|Cadastrar/ }).last()).toBeInViewport();
});
