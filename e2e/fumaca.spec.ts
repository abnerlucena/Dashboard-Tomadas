import { expect, test, type Page } from "@playwright/test";

const entrar = async (page: Page, email: string) => {
  await page.goto("/");
  await page.getByLabel(/e-mail/i).first().fill(email);
  await page.getByLabel(/senha/i).first().fill("demo123");
  await page.getByRole("button", { name: /^entrar$/i }).click();
};

test("gestor entra e navega pelas telas principais", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(e.message));
  await entrar(page, "gestor@demo.weg");
  await expect(page.getByRole("heading", { name: "Máquinas", level: 1 })).toBeVisible();
  for (const [rota, titulo] of [
    ["historico", "Histórico"],
    ["metas", "Metas"],
    ["calendario", "Calendário"],
    ["relatorios", "Relatórios"],
    ["ranking", "Ranking de máquinas"],
    ["usuarios", "Usuários"],
    ["cadastro-maquinas", "Cadastro de máquinas"],
  ]) {
    await page.goto(`/#/${rota}`);
    await expect(page.getByRole("heading", { name: titulo, level: 1 })).toBeVisible();
  }
  expect(erros).toEqual([]);
});

test("apontamento valida a OP e salva (demonstração)", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await page.goto("/#/apontamento");
  const maquina = "Máquina de tomadas Composé (Aumaq)";
  // O nº da OP começa vazio: quem aponta digita
  await expect(page.getByLabel(`Nº da OP, linha 1, ${maquina}`)).toHaveValue("");
  await page.getByLabel(`Quantidade, linha 1, ${maquina}`).fill("5000");
  await page.getByRole("button", { name: "Salvar apontamento" }).click();
  await expect(page.getByText("Corrija os campos destacados")).toBeVisible();
  await page.getByLabel(`Nº da OP, linha 1, ${maquina}`).fill("4511111");
  await page.getByRole("button", { name: "Salvar apontamento" }).click();
  await expect(page.getByText("Apontamento salvo")).toBeVisible();
});

test("meta por pessoa exige o nº de operadores; OP aceita até 15 dígitos", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await page.goto("/#/apontamento");
  const granel = "Bancada de embalagem a granel";
  await page.getByLabel(`Nº da OP, linha 1, ${granel}`).fill("1234567890123");
  await page.getByLabel(`Quantidade, linha 1, ${granel}`).fill("20000");
  await page.getByRole("button", { name: "Salvar apontamento" }).click();
  await expect(page.getByText("Informe o nº de operadores")).toBeVisible();
  await expect(page.getByText("Informe quantas pessoas trabalharam")).toBeVisible();
  await page.locator("li", { has: page.locator("h3", { hasText: granel }) }).getByLabel("Nº de operadores").fill("3");
  await page.getByRole("button", { name: "Salvar apontamento" }).click();
  await expect(page.getByText("Apontamento salvo")).toBeVisible();
});

test("calendário cadastra e remove um dia (demonstração)", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await page.goto("/#/calendario");
  await page.getByRole("button", { name: "Cadastrar", exact: true }).first().click();
  await page.getByLabel("Descrição").fill("Ponte de teste");
  await page.getByRole("dialog").getByRole("button", { name: "Cadastrar", exact: true }).click();
  await expect(page.getByText("Ponte de teste: 1 dia cadastrado.")).toBeVisible();
  await page.getByRole("button", { name: /^Remover Ponte de teste/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remover" }).click();
  await expect(page.getByText("1 dia removido.")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Ponte de teste" })).toHaveCount(0);
});

test("cadastro de máquinas cadastra e desativa (demonstração)", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await page.goto("/#/cadastro-maquinas");
  await page.getByRole("button", { name: "Cadastrar máquina" }).first().click();
  await page.getByLabel("Nome").fill("Embaladora de teste");
  await page.getByLabel("Meta por turno").fill("5000");
  await page.getByRole("dialog").getByRole("button", { name: "Cadastrar" }).click();
  await expect(page.getByText("Máquina cadastrada", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Desativar Embaladora de teste" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Desativar" }).click();
  await expect(page.getByText("Máquina desativada", { exact: true })).toBeVisible();
  await page.getByRole("radio", { name: /Inativas/ }).click();
  await expect(page.getByRole("rowheader", { name: "Embaladora de teste" })).toBeVisible();
});

test("operador não vê a gestão de usuários", async ({ page }) => {
  await entrar(page, "operador@demo.weg");
  await page.goto("/#/usuarios");
  await expect(page.getByText("Sem permissão para esta tela")).toBeVisible();
});

test("senha errada mostra o motivo", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel(/e-mail/i).first().fill("gestor@demo.weg");
  await page.getByLabel(/senha/i).first().fill("errada");
  await page.getByRole("button", { name: /^entrar$/i }).click();
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
});

test("nenhuma tela rola de lado no celular", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await entrar(page, "gestor@demo.weg");
  await expect(page.getByRole("heading", { name: "Máquinas", level: 1 })).toBeVisible();
  const rotas = ["dashboard", "apontamento", "ops", "historico", "metas", "calendario", "feedbacks", "relatorios", "ranking", "retrabalho", "usuarios", "cadastro-maquinas", "ajuda"];
  for (const rota of rotas) {
    await page.goto(`/#/${rota}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // tabelas largas rolam dentro do próprio cartão; a página, nunca
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sobra, `#/${rota} rola de lado`).toBeLessThanOrEqual(0);
  }
});

test("retrabalho pede o motivo antes de salvar", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await page.goto("/#/apontamento");
  const maquina = "Máquina de tomadas Composé (Aumaq)";
  await page.getByLabel(`Nº da OP, linha 1, ${maquina}`).fill("4511111");
  await page.getByLabel(`Quantidade, linha 1, ${maquina}`).fill("300");
  await page.getByLabel(`Retrabalho, linha 1, ${maquina}`).check();
  await page.getByRole("button", { name: "Salvar apontamento" }).click();
  await expect(page.getByText("Escreva o motivo do retrabalho")).toBeVisible();
  await page.getByLabel(`Motivo do retrabalho, linha 1, ${maquina}`).fill("Rebarba na peça");
  await page.getByRole("button", { name: "Salvar apontamento" }).click();
  await expect(page.getByText("Apontamento salvo")).toBeVisible();
});

test("descartar alterações pede confirmação", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await page.goto("/#/apontamento");
  const campo = page.getByLabel("Quantidade, linha 1, Máquina de tomadas Composé (Aumaq)");
  await campo.fill("123");
  await page.getByRole("button", { name: "Descartar alterações" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Continuar editando" }).click();
  await expect(campo).toHaveValue("123");
  await page.getByRole("button", { name: "Descartar alterações" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Descartar", exact: true }).click();
  await expect(campo).toHaveValue("");
});

test("histórico da máquina abre o Histórico já filtrado", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  const maquina = "Máquina de tomadas Composé (Aumaq)";
  await page.getByRole("row", { name: new RegExp(maquina.replace(/[()]/g, "\\$&")) }).getByRole("button", { name: /ações/i }).click();
  await page.getByRole("menuitem", { name: "Histórico da máquina" }).click();
  await expect(page.getByRole("heading", { name: "Histórico", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: `Máquina: ${maquina}` })).toBeVisible();
  await expect(page.getByRole("table", { name: new RegExp(`· ${maquina.replace(/[()]/g, "\\$&")}$`) })).toBeVisible();
  await page.getByRole("button", { name: "Limpar filtro" }).click();
  await expect(page.getByRole("button", { name: "Máquina: Todas" })).toBeVisible();
});

test("quantidade acima de 2× a meta pede conferência, sem impedir", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await page.goto("/#/apontamento");
  const maquina = "Máquina de interruptores Composé nº 1";
  await page.getByLabel(`Nº da OP, linha 1, ${maquina}`).fill("4511111");
  await page.getByLabel(`Quantidade, linha 1, ${maquina}`).fill("40000");
  await expect(page.getByText("Confere 40.000 peças?")).toBeVisible();
  await page.getByRole("button", { name: "Salvar apontamento" }).click();
  const dialogo = page.getByRole("dialog", { name: "Conferir as quantidades?" });
  await expect(dialogo).toContainText(maquina);
  await dialogo.getByRole("button", { name: "Salvar assim" }).click();
  await expect(page.getByText("Apontamento salvo")).toBeVisible();
});

test("a busca do topo filtra as máquinas do apontamento", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await page.goto("/#/apontamento");
  await expect(page.getByLabel("Filtrar máquinas")).toHaveCount(0);
  await page.getByPlaceholder("Buscar máquinas e linhas").fill("Slin");
  await expect(page.getByRole("heading", { level: 3, name: "Máquina de plugue Slin (Aumaq)" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Máquina de interruptores Composé nº 1" })).toHaveCount(0);
  await page.getByRole("button", { name: "Limpar busca" }).click();
  await expect(page.getByRole("heading", { level: 3, name: "Máquina de interruptores Composé nº 1" })).toBeVisible();
});
