import { expect, test, type Page } from "@playwright/test";

/** Passo 1 do apontamento: quem aponta escolhe data, turno e regime (nada vem preenchido) */
const iniciarTurno = async (page: Page, turno = "Turno 1", regime = "Normal") => {
  await page.goto("/#/apontamento");
  await page.getByRole("button", { name: /^Data:/ }).click();
  await page.getByRole("gridcell", { name: /27 de março/ }).or(page.getByRole("button", { name: /27 de março/ })).first().click();
  await page.getByRole("radio", { name: turno }).click();
  await page.getByRole("radio", { name: regime }).click();
  await page.getByRole("button", { name: "Continuar para as máquinas" }).click();
};

/** Máquina já apontada no turno aparece recolhida: "Lançar mais" reabre os campos */
const abrir = async (page: Page, maquina: string) => {
  const mais = page.getByRole("button", { name: `Lançar mais em ${maquina}` });
  const campo = page.getByLabel(`Nº da OP, linha 1, ${maquina}`);
  await expect(mais.or(campo)).toBeVisible();
  if (await mais.isVisible()) await mais.click();
};

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
  await iniciarTurno(page);
  const maquina = "Máquina de tomadas Composé (Aumaq)";
  await abrir(page, maquina);
  // O nº da OP começa vazio: quem aponta digita
  await expect(page.getByLabel(`Nº da OP, linha 1, ${maquina}`)).toHaveValue("");
  await page.getByLabel(`Quantidade, linha 1, ${maquina}`).fill("5000");
  await page.getByRole("button", { name: "Salvar tudo" }).click();
  await expect(page.getByText("Corrija os campos destacados")).toBeVisible();
  await page.getByLabel(`Nº da OP, linha 1, ${maquina}`).fill("4511111");
  await page.getByRole("button", { name: "Salvar tudo" }).click();
  await expect(page.getByText("Apontamento salvo")).toBeVisible();
});

test("meta por pessoa exige o nº de operadores; OP aceita até 15 dígitos", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await iniciarTurno(page);
  const granel = "Bancada de embalagem a granel";
  await abrir(page, granel);
  await page.getByLabel(`Nº da OP, linha 1, ${granel}`).fill("1234567890123");
  await page.getByLabel(`Quantidade, linha 1, ${granel}`).fill("20000");
  await page.getByRole("button", { name: "Salvar tudo" }).click();
  await expect(page.getByText("Informe o nº de operadores")).toBeVisible();
  await expect(page.getByText("Informe quantas pessoas trabalharam")).toBeVisible();
  await page.locator("li", { has: page.locator("h3", { hasText: granel }) }).getByLabel("Nº de operadores").fill("3");
  await page.getByRole("button", { name: "Salvar tudo" }).click();
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
  await iniciarTurno(page);
  const maquina = "Máquina de tomadas Composé (Aumaq)";
  await abrir(page, maquina);
  await page.getByLabel(`Nº da OP, linha 1, ${maquina}`).fill("4511111");
  await page.getByLabel(`Quantidade, linha 1, ${maquina}`).fill("300");
  await page.getByLabel(`Retrabalho, linha 1, ${maquina}`).check();
  await page.getByRole("button", { name: "Salvar tudo" }).click();
  await expect(page.getByText("Escreva o motivo do retrabalho")).toBeVisible();
  await page.getByLabel(`Motivo do retrabalho, linha 1, ${maquina}`).fill("Rebarba na peça");
  await page.getByRole("button", { name: "Salvar tudo" }).click();
  await expect(page.getByText("Apontamento salvo")).toBeVisible();
});

test("descartar alterações pede confirmação", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await iniciarTurno(page);
  // máquina sem apontamento no turno: depois de descartar, o campo continua aberto e vazio
  const campo = page.getByLabel("Quantidade, linha 1, Máquina de plugue Slin (Aumaq)");
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
  await iniciarTurno(page);
  const maquina = "Máquina de interruptores Composé nº 1";
  await abrir(page, maquina);
  await page.getByLabel(`Nº da OP, linha 1, ${maquina}`).fill("4511111");
  await page.getByLabel(`Quantidade, linha 1, ${maquina}`).fill("40000");
  await expect(page.getByText("Confere 40.000 peças?")).toBeVisible();
  await page.getByRole("button", { name: "Salvar tudo" }).click();
  const dialogo = page.getByRole("dialog", { name: "Conferir as quantidades?" });
  await expect(dialogo).toContainText(maquina);
  await dialogo.getByRole("button", { name: "Salvar assim" }).click();
  await expect(page.getByText("Apontamento salvo")).toBeVisible();
});

test("a busca do topo filtra as máquinas do apontamento", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await iniciarTurno(page);
  await expect(page.getByLabel("Filtrar máquinas")).toHaveCount(0);
  await page.getByPlaceholder("Buscar máquinas e linhas").fill("Slin");
  await expect(page.getByRole("heading", { level: 3, name: "Máquina de plugue Slin (Aumaq)" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Máquina de interruptores Composé nº 1" })).toHaveCount(0);
  await page.getByRole("button", { name: "Limpar busca" }).click();
  await expect(page.getByRole("heading", { level: 3, name: "Máquina de interruptores Composé nº 1" })).toBeVisible();
});

test("concluir grava só a máquina, recolhe e leva à próxima pendente", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await iniciarTurno(page);
  const maquina = "Máquina de plugue Slin (Aumaq)";
  await page.getByLabel(`Nº da OP, linha 1, ${maquina}`).fill("4511111");
  await page.getByLabel(`Quantidade, linha 1, ${maquina}`).fill("5000");
  await page.getByRole("button", { name: `Concluir ${maquina}` }).click();
  await expect(page.getByText(`${maquina}: gravada`)).toBeVisible();
  // recolhida numa linha, com "Lançar mais"
  await expect(page.getByRole("button", { name: `Lançar mais em ${maquina}` })).toBeVisible();
  await expect(page.getByLabel(`Nº da OP, linha 1, ${maquina}`)).toHaveCount(0);
  // o cursor vai para o Nº da OP da próxima máquina sem apontamento
  await expect(page.locator(":focus")).toHaveAttribute("aria-label", /^Nº da OP, linha 1, /);
});

test("o apontamento é um ambiente: navegação recolhida e turno escolhido por quem aponta", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  // No Dashboard a navegação lateral está aberta
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();
  await page.goto("/#/apontamento");
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toHaveCount(0);
  await expect(page.getByText("Ambiente de apontamento")).toBeVisible();
  // Nada vem preenchido: sem os três, não passa para as máquinas
  await page.getByRole("button", { name: "Continuar para as máquinas" }).click();
  await expect(page.getByText("Escolha a data", { exact: true })).toBeVisible();
  await expect(page.getByText("Escolha o turno", { exact: true })).toBeVisible();
  await expect(page.getByText("Escolha o regime", { exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
  // O botão do topo abre a navegação como gaveta
  await page.getByRole("button", { name: /navegação lateral/i }).click();
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toHaveCount(0);
});

test("sair do apontamento pede confirmação se há algo digitado e não concluído", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await iniciarTurno(page);
  await page.getByRole("button", { name: "Sair do apontamento" }).click();
  // nada digitado: sai direto
  await expect(page.getByRole("heading", { name: "Máquinas", level: 1 })).toBeVisible();
  await iniciarTurno(page);
  const maquina = "Máquina de plugue Slin (Aumaq)";
  await page.getByLabel(`Quantidade, linha 1, ${maquina}`).fill("123");
  await page.getByRole("button", { name: "Sair do apontamento" }).click();
  const dialogo = page.getByRole("dialog", { name: "Sair do apontamento?" });
  await dialogo.getByRole("button", { name: "Continuar apontando" }).click();
  await expect(page.getByLabel(`Quantidade, linha 1, ${maquina}`)).toHaveValue("123");
  // um link do Dash passa pela mesma confirmação
  await page.getByRole("link", { name: "Dash de Produção, início" }).click();
  await page.getByRole("dialog", { name: "Sair do apontamento?" }).getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Máquinas", level: 1 })).toBeVisible();
});

test("conferir e terminar mostra o resumo e encerra o turno", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await iniciarTurno(page);
  await page.getByRole("button", { name: /Conferir e terminar/ }).first().click();
  await expect(page.getByRole("region", { name: "Resumo do turno" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ainda sem apontamento" })).toBeVisible();
  await page.getByRole("button", { name: "Terminar o turno" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Terminar assim" }).click();
  await expect(page.getByRole("heading", { name: "Turno encerrado" })).toBeVisible();
});

test("a lista de situação das máquinas muda de largura pela borda", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await entrar(page, "gestor@demo.weg");
  await iniciarTurno(page);
  const lista = page.locator("#entry-status");
  const borda = page.getByRole("separator", { name: /Redimensionar a lista de situação/ });
  const inicial = (await lista.boundingBox())!.width;
  await borda.focus();
  await page.keyboard.press("End");
  expect((await lista.boundingBox())!.width).toBeGreaterThan(inicial);
  await page.keyboard.press("Home");
  expect((await lista.boundingBox())!.width).toBeLessThan(inicial);
});
