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

test("apontamento valida a OP e salva, e sem OP vai como não informado (demonstração)", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await iniciarTurno(page);
  const maquina = "Máquina de tomadas Composé (Aumaq)";
  await abrir(page, maquina);
  // O nº da OP começa vazio: quem aponta digita
  await expect(page.getByLabel(`Nº da OP, linha 1, ${maquina}`)).toHaveValue("");
  await page.getByLabel(`Quantidade, linha 1, ${maquina}`).fill("5000");
  // O nº da OP é opcional por enquanto: avisa que vai como não informado, sem barrar
  await expect(page.getByText("Sem número: vai como não informado")).toBeVisible();
  // Mas, se digitou, tem de ser válido (só números, até 15)
  await page.getByLabel(`Nº da OP, linha 1, ${maquina}`).fill("1234567890123456");
  await expect(page.getByLabel(`Nº da OP, linha 1, ${maquina}`)).toHaveValue("123456789012345");
  await page.getByLabel(`Nº da OP, linha 1, ${maquina}`).fill("");
  await page.getByRole("button", { name: "Salvar tudo" }).click();
  await expect(page.getByText("Apontamento salvo")).toBeVisible();
  // gravada sem OP: aparece "Não informado" na linha recolhida
  await expect(page.getByText("Não informado").first()).toBeVisible();
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

/** Sai pelo menu da conta */
const sair = async (page: Page) => {
  await page.getByRole("button", { name: /^Conta de/ }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await expect(page.getByLabel(/e-mail/i).first()).toBeVisible();
};

test("preferências são pessoais: o tema de uma conta não vai para a outra", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await page.goto("/#/preferencias");
  await expect(page.getByRole("heading", { name: "Preferências", level: 1 })).toBeVisible();
  await page.getByRole("radio", { name: /Escuro/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
  await sair(page);
  // outra pessoa no mesmo computador: abre com as dela (padrão), não com o escuro do gestor
  await entrar(page, "operador@demo.weg");
  await page.goto("/#/preferencias");
  await expect(page.getByRole("radio", { name: /Igual ao sistema/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "light");
  await sair(page);
  // o gestor volta e o escuro dele continua lá
  await entrar(page, "gestor@demo.weg");
  await page.goto("/#/preferencias");
  await expect(page.getByRole("radio", { name: /Escuro/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
});

test("preferências: página inicial Apontamento abre o Apontamento ao entrar", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await page.goto("/#/preferencias");
  await page.getByRole("radio", { name: /Apontamento/ }).click();
  await sair(page);
  await page.goto("/");
  await entrar(page, "gestor@demo.weg");
  await expect(page).toHaveURL(/#\/apontamento/);
});

test("preferências: campos maiores ligam e desligam no Apontamento", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await iniciarTurno(page);
  const maquina = "Máquina de plugue Slin (Aumaq)";
  const campo = page.getByLabel(`Quantidade, linha 1, ${maquina}`);
  expect((await campo.boundingBox())!.height).toBeGreaterThanOrEqual(43);
  await page.goto("/#/preferencias");
  await page.getByRole("switch", { name: "Campos e botões maiores" }).click();
  await iniciarTurno(page);
  expect((await page.getByLabel(`Quantidade, linha 1, ${maquina}`).boundingBox())!.height).toBeLessThan(40);
});

test("preferências: sem rascunho, o que foi digitado não volta depois de recarregar", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await page.goto("/#/preferencias");
  await page.getByRole("switch", { name: "Guardar rascunho" }).click();
  await iniciarTurno(page);
  const maquina = "Máquina de plugue Slin (Aumaq)";
  await page.getByLabel(`Quantidade, linha 1, ${maquina}`).fill("77");
  await page.waitForTimeout(800);
  await page.reload();
  await page.goto("/#/apontamento");
  await expect(page.getByRole("heading", { name: /ficou pela metade|ficaram pela metade/ })).toHaveCount(0);
});

test("perfil mostra quem sou e o menu da conta abre Perfil e Preferências", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await page.getByRole("button", { name: /^Conta de/ }).click();
  await page.getByRole("menuitem", { name: "Perfil" }).click();
  await expect(page.getByRole("heading", { name: "Perfil", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rafael Souza", level: 2 })).toBeVisible();
  await page.getByRole("button", { name: /^Conta de/ }).click();
  await page.getByRole("menuitem", { name: "Preferências" }).click();
  await expect(page.getByRole("heading", { name: "Preferências", level: 1 })).toBeVisible();
});

test("o olho mostra e esconde a senha com o clique", async ({ page }) => {
  await page.goto("/");
  const senha = page.getByLabel("Senha", { exact: true });
  await senha.fill("segredo123");
  await expect(senha).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Mostrar senha" }).click();
  await expect(senha).toHaveAttribute("type", "text");
  await expect(senha).toHaveValue("segredo123");
  // o foco volta ao campo, e dá para continuar digitando
  await expect(senha).toBeFocused();
  await page.getByRole("button", { name: "Esconder senha" }).click();
  await expect(senha).toHaveAttribute("type", "password");
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
  await expect(page.getByRole("button", { name: `Máquinas: ${maquina}` })).toBeVisible();
  await expect(page.getByRole("table", { name: new RegExp(`· ${maquina.replace(/[()]/g, "\\$&")}$`) })).toBeVisible();
  await page.getByRole("button", { name: "Limpar filtro" }).click();
  await expect(page.getByRole("button", { name: "Máquinas: Todas" })).toBeVisible();
});

test("histórico: o dia mostra a meta do dia, e ela acompanha o filtro de máquinas", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await page.goto("/#/historico");
  const selo = page.getByText(/% da meta diária de [\d.]+/);
  await expect(selo).toBeVisible();
  const todas = await selo.textContent();
  // com menos máquinas na conta, a meta do dia encolhe junto com a produção
  await page.getByRole("button", { name: "Máquinas: Todas" }).click();
  const painel = page.getByRole("dialog", { name: "Escolher as máquinas da conta" });
  await painel.getByRole("button", { name: "Desmarcar todas" }).click();
  await painel.getByLabel("Buscar máquina").fill("Composé");
  await painel.getByRole("button", { name: "Só as encontradas" }).click();
  await painel.getByRole("button", { name: "Concluir" }).click();
  await expect(selo).not.toHaveText(todas ?? "");
});

test("histórico: o filtro de turno muda as unidades e a meta do resumo do dia", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await page.goto("/#/historico");
  const selo = page.getByText(/% da meta (diária|do turno \d) de [\d.]+/);
  await expect(selo).toContainText("meta diária");
  const dia = await selo.textContent();
  await page.getByRole("radio", { name: "Turno 1" }).click();
  await expect(selo).toContainText("meta do turno 1");
  await expect(selo).not.toHaveText(dia ?? "");
  await page.getByRole("radio", { name: "Todos" }).first().click();
  await expect(selo).toContainText("meta diária");
});

test("histórico: tirar máquinas da conta, devolver e deixar só algumas", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  const painel = page.getByRole("dialog", { name: "Escolher as máquinas da conta" });
  await page.goto("/#/historico");
  await expect(page.getByRole("button", { name: "Máquinas: Todas" })).toBeVisible();
  // tirar as duas Embaladoras de kit parafusos: busca "kit" e "Tirar as encontradas"
  await page.getByRole("button", { name: "Máquinas: Todas" }).click();
  await painel.getByLabel("Buscar máquina").fill("kit");
  await painel.getByRole("button", { name: "Tirar as encontradas" }).click();
  await expect(painel.getByText("20 de 22 máquinas na conta")).toBeVisible();
  await painel.getByRole("button", { name: "Concluir" }).click();
  await expect(page.getByRole("button", { name: "Máquinas: Sem 2 máquinas" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Máquinas do filtro" })).toContainText("Embaladora kit parafusos nº 1");
  await expect(page.getByText("só as 20 máquinas da conta")).toBeVisible();
  // o endereço guarda o filtro e dá para abrir o link
  await expect(page).toHaveURL(/#\/historico\/sem%3A/);
  await page.reload();
  await expect(page.getByRole("button", { name: "Máquinas: Sem 2 máquinas" })).toBeVisible();
  // o ✕ devolve uma máquina; a outra continua fora
  await page.getByRole("button", { name: "Voltar Embaladora kit parafusos nº 1 para a conta" }).click();
  await expect(page.getByRole("button", { name: "Máquinas: Sem 1 máquina" })).toBeVisible();
  // limpar volta a todas
  await page.getByRole("button", { name: "Limpar filtro" }).click();
  await expect(page.getByRole("button", { name: "Máquinas: Todas" })).toBeVisible();
  // só algumas: desmarcar todas, buscar e deixar só as encontradas
  await page.getByRole("button", { name: "Máquinas: Todas" }).click();
  await painel.getByRole("button", { name: "Desmarcar todas" }).click();
  await expect(painel.getByText("0 de 22 máquinas na conta")).toBeVisible();
  await painel.getByLabel("Buscar máquina").fill("Composé");
  await painel.getByRole("button", { name: "Só as encontradas" }).click();
  await painel.getByRole("button", { name: "Concluir" }).click();
  await expect(page.getByRole("button", { name: "Máquinas: 2 máquinas" })).toBeVisible();
  await expect(page.getByText("Só estas na conta:")).toBeVisible();
  // nenhuma na conta: avisa e oferece marcar todas
  await page.getByRole("button", { name: "Máquinas: 2 máquinas" }).click();
  await painel.getByRole("button", { name: "Desmarcar todas" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Nenhuma máquina na conta").first()).toBeVisible();
  await page.getByRole("button", { name: "Marcar todas" }).click();
  await expect(page.getByRole("button", { name: "Máquinas: Todas" })).toBeVisible();
});

test("ranking tem os filtros do Retrabalho: período, máquinas, turno e motivo", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await page.goto("/#/ranking");
  await expect(page.getByRole("heading", { name: "Ranking de máquinas", level: 1 })).toBeVisible();
  const filtros = page.getByRole("toolbar", { name: "Filtros" });
  await expect(filtros.getByRole("button", { name: /^Período/ })).toBeVisible();
  await expect(filtros.getByRole("button", { name: "Máquinas: Todas" })).toBeVisible();
  await expect(filtros.getByRole("button", { name: "Turno: Todos" })).toBeVisible();
  // o motivo só vale no critério Retrabalho
  await expect(filtros.getByRole("button", { name: "Motivo: Todos" })).toBeDisabled();
  await page.getByRole("radio", { name: "Retrabalho" }).click();
  await expect(filtros.getByRole("button", { name: "Motivo: Todos" })).toBeEnabled();
  await page.getByRole("radio", { name: "Atingimento" }).click();
  // só duas máquinas no ranking
  const linhas = page.getByRole("table", { name: /Ranking por/ }).getByRole("row");
  const antes = await linhas.count();
  await filtros.getByRole("button", { name: "Máquinas: Todas" }).click();
  const painel = page.getByRole("dialog", { name: "Escolher as máquinas do ranking" });
  await painel.getByRole("button", { name: "Desmarcar todas" }).click();
  await painel.getByLabel("Buscar máquina").fill("Composé");
  await painel.getByRole("button", { name: "Só as encontradas" }).click();
  await expect(painel.getByText(/^2 de \d+ máquinas no ranking/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(filtros.getByRole("button", { name: "Máquinas: 2 máquinas" })).toBeVisible();
  await expect(page.getByText("Só as 2 máquinas escolhidas.")).toBeVisible();
  expect(await linhas.count()).toBeLessThan(antes);
  await expect(page.getByRole("table", { name: /Ranking por/ })).toContainText("Composé");
  // limpar volta a todas
  await filtros.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(filtros.getByRole("button", { name: "Máquinas: Todas" })).toBeVisible();
  expect(await linhas.count()).toBe(antes);
});

test("o Dashboard mostra todos os postos por demanda, com a produção, fora do atingimento", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await page.evaluate(() => (window.location.hash = "#/dashboard"));
  const postos = page.getByRole("table", { name: /^Postos por demanda/ });
  await expect(page.getByRole("heading", { name: "Postos por demanda", level: 2 })).toBeVisible();
  // de todas as linhas, não só da Montagem
  await expect(postos.getByText("Embaladora kit parafusos nº 1")).toBeVisible();
  await expect(postos.getByText("Prensa Tox")).toBeVisible();
  await expect(page.getByText(/postos por demanda aparecem abaixo, fora do atingimento/)).toBeVisible();
  // e não entram na tabela das máquinas com meta
  await expect(page.getByRole("table", { name: /^Máquinas/ }).getByText("Prensa Tox")).toHaveCount(0);
});

test("a aba Montagem mostra também os postos por demanda, fora do atingimento", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await page.goto("/#/linha-montagem");
  await expect(page.getByRole("heading", { name: "Montagem", level: 1 })).toBeVisible();
  const postos = page.getByRole("table", { name: /^Postos por demanda/ });
  await expect(page.getByRole("heading", { name: "Postos por demanda", level: 2 })).toBeVisible();
  await expect(postos).toContainText("Embaladora kit parafusos nº 1");
  await expect(postos).toContainText("Prensa Tox");
  await expect(postos).toContainText("Bancada nº 3");
  // a tabela principal continua só com as máquinas com meta
  await expect(page.getByRole("table", { name: /^Produção por máquina/ })).not.toContainText("Prensa Tox");
  await expect(page.getByText(/postos por demanda aparecem abaixo, fora do atingimento/)).toBeVisible();
  // a página da Embalagem não tem postos por demanda
  await page.goto("/#/linha-embalagem");
  await expect(page.getByRole("heading", { name: "Embalagem", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Postos por demanda" })).toHaveCount(0);
});

test("histórico: as setas do mês não mudam de lugar quando o nome do mês muda", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await page.goto("/#/historico");
  const anterior = page.getByRole("button", { name: /^Mês anterior/ });
  const proximo = page.getByRole("button", { name: /^Próximo mês/ });
  const a = await anterior.boundingBox();
  const p = await proximo.boundingBox();
  // as setas vêm antes do nome do mês (que muda de largura), então não andam
  const titulo = await page.getByRole("region", { name: /^Calendário de / }).getByRole("heading", { level: 2 }).boundingBox();
  expect(a!.x).toBeLessThan(p!.x);
  expect(p!.x + p!.width).toBeLessThanOrEqual(titulo!.x);
  // vai e volta pelos meses disponíveis: a posição das setas é sempre a mesma
  for (let i = 0; i < 3; i++) {
    if (!(await anterior.isEnabled())) break;
    await anterior.click();
    expect(await anterior.boundingBox()).toEqual(a);
    expect(await proximo.boundingBox()).toEqual(p);
  }
  for (let i = 0; i < 3; i++) {
    if (!(await proximo.isEnabled())) break;
    await proximo.click();
    expect(await anterior.boundingBox()).toEqual(a);
    expect(await proximo.boundingBox()).toEqual(p);
  }
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

test("não produziu: pede o motivo, grava sem peças e aparece na conferência", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await iniciarTurno(page);
  const maquina = "Máquina de plugue Slin (Aumaq)";
  await page.getByRole("button", { name: `Marcar que ${maquina} não produziu` }).click();
  // sem motivo, não conclui
  await page.getByRole("button", { name: `Concluir ${maquina}` }).click();
  await expect(page.getByText("Escolha uma sugestão ou escreva o motivo", { exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "Manutenção" }).click();
  // manutenção é parada planejada: a marcação vem sugerida e o texto livre acompanha a sugestão
  await expect(page.getByRole("checkbox", { name: `Parada planejada, ${maquina}` })).toBeChecked();
  await expect(page.getByLabel(`Motivo de não ter produzido, ${maquina}`)).toHaveValue("Manutenção");
  // outro motivo, escrito à mão, mantém a marcação como está e dá para mudá-la
  await page.getByLabel(`Motivo de não ter produzido, ${maquina}`).fill("Aguardando molde");
  await page.getByRole("checkbox", { name: `Parada planejada, ${maquina}` }).uncheck();
  await page.getByRole("radio", { name: "Sem OP", exact: false }).first().click();
  await expect(page.getByRole("checkbox", { name: `Parada planejada, ${maquina}` })).not.toBeChecked();
  await page.getByRole("radio", { name: "Manutenção" }).click();
  await page.getByRole("button", { name: `Concluir ${maquina}` }).click();
  await expect(page.getByText(`${maquina}: gravada`)).toBeVisible();
  // recolhida, com o motivo e a situação na meta
  await expect(page.getByText("Não produziu · Manutenção · parada planejada, fora da meta")).toBeVisible();
  // conferência: conta à parte, e não vira aviso de "menos de 30% da meta"
  await page.getByRole("button", { name: /Conferir e terminar/ }).first().click();
  const resumo = page.getByRole("region", { name: "Resumo do turno" });
  await expect(resumo.getByText("Não produziram")).toBeVisible();
  await expect(page.getByText(`${maquina}: 0 peças`)).toHaveCount(0);
});

test("rascunho: o que foi digitado volta depois de fechar a página", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await iniciarTurno(page);
  const maquina = "Máquina de plugue Slin (Aumaq)";
  await page.getByLabel(`Nº da OP, linha 1, ${maquina}`).fill("4511111");
  await page.getByLabel(`Quantidade, linha 1, ${maquina}`).fill("777");
  await page.waitForTimeout(800);
  // a página fecha sem ninguém concluir (queda de energia, navegador fechado)
  await page.reload();
  await page.goto("/#/apontamento");
  await expect(page.getByRole("heading", { name: "Encontramos um apontamento que ficou pela metade" })).toBeVisible();
  await page.getByRole("button", { name: /^Restaurar o rascunho/ }).click();
  await expect(page.getByLabel(`Nº da OP, linha 1, ${maquina}`)).toHaveValue("4511111");
  await expect(page.getByLabel(`Quantidade, linha 1, ${maquina}`)).toHaveValue("777");
  // concluir a máquina a tira do rascunho: depois de recarregar, não há aviso
  await page.getByRole("button", { name: `Concluir ${maquina}` }).click();
  await expect(page.getByText(`${maquina}: gravada`)).toBeVisible();
  await page.waitForTimeout(800);
  await page.reload();
  await page.goto("/#/apontamento");
  await expect(page.getByText("Escolha a data", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /ficou pela metade|ficaram pela metade/ })).toHaveCount(0);
});

test("rascunho: dá para descartar", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await iniciarTurno(page);
  const maquina = "Máquina de plugue Slin (Aumaq)";
  await page.getByLabel(`Quantidade, linha 1, ${maquina}`).fill("55");
  await page.waitForTimeout(800);
  await page.reload();
  await page.goto("/#/apontamento");
  await page.getByRole("button", { name: /^Descartar o rascunho/ }).click();
  await expect(page.getByRole("heading", { name: /ficou pela metade/ })).toHaveCount(0);
  await page.reload();
  await page.goto("/#/apontamento");
  await expect(page.getByRole("heading", { name: /ficou pela metade/ })).toHaveCount(0);
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

test("mudança de rota feita pelo sistema também pergunta antes de sair", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await iniciarTurno(page);
  const maquina = "Máquina de plugue Slin (Aumaq)";
  // nada digitado: a rota muda sem perguntar
  await page.evaluate(() => (window.location.hash = "#/ajuda"));
  await expect(page.getByRole("heading", { name: "Ajuda", level: 1 })).toBeVisible();
  await iniciarTurno(page);
  await page.getByLabel(`Quantidade, linha 1, ${maquina}`).fill("321");
  // um atalho de notificação muda o hash por código, sem clique em link
  await page.evaluate(() => (window.location.hash = "#/feedbacks/4514087"));
  const dialogo = page.getByRole("dialog", { name: "Sair do apontamento?" });
  await expect(dialogo).toBeVisible();
  expect(page.url()).toContain("#/apontamento");
  await dialogo.getByRole("button", { name: "Continuar apontando" }).click();
  await expect(page.getByLabel(`Quantidade, linha 1, ${maquina}`)).toHaveValue("321");
  // o botão Voltar do navegador passa pelo mesmo guarda
  await page.goBack();
  await expect(page.getByRole("dialog", { name: "Sair do apontamento?" })).toBeVisible();
  await page.getByRole("dialog", { name: "Sair do apontamento?" }).getByRole("button", { name: "Continuar apontando" }).click();
  expect(page.url()).toContain("#/apontamento");
  // confirmando, sai
  await page.evaluate(() => (window.location.hash = "#/feedbacks/4514087"));
  await page.getByRole("dialog", { name: "Sair do apontamento?" }).getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/#\/feedbacks/);
});

test("cartão em duas colunas e lista de situação com linhas de 44px", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await entrar(page, "gestor@demo.weg");
  await iniciarTurno(page);
  const maquina = "Máquina de plugue Slin (Aumaq)";
  const nome = page.getByRole("heading", { level: 3, name: maquina });
  const campo = page.getByLabel(`Nº da OP, linha 1, ${maquina}`);
  const a = await nome.boundingBox();
  const b = await campo.boundingBox();
  // contexto à esquerda, campos à direita, na mesma altura do cartão
  expect(b!.x).toBeGreaterThan(a!.x + 200);
  expect(Math.abs(b!.y - a!.y)).toBeLessThan(120);
  const linha = await page.locator("#entry-status").getByRole("button", { name: new RegExp(`^${maquina.replace(/[()]/g, "\\$&")}:`) }).boundingBox();
  expect(linha!.height).toBeGreaterThanOrEqual(43);
  // no celular volta a uma coluna
  await page.setViewportSize({ width: 390, height: 800 });
  const a2 = await nome.boundingBox();
  const b2 = await campo.boundingBox();
  expect(b2!.y).toBeGreaterThan(a2!.y + 20);
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

test("a lista de situação tem largura proporcional à tela", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await page.setViewportSize({ width: 1920, height: 950 });
  await iniciarTurno(page);
  const lista = page.locator("#entry-status");
  const larga = (await lista.boundingBox())!.width;
  expect(larga).toBeGreaterThan(540);
  expect(larga).toBeLessThanOrEqual(576);
  await page.setViewportSize({ width: 1280, height: 800 });
  const estreita = (await lista.boundingBox())!.width;
  expect(estreita).toBeLessThan(larga);
  expect(estreita).toBeGreaterThanOrEqual(224);
});

test("ajuda: respostas por assunto, em passos, e a busca acha o texto da resposta", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await page.evaluate(() => (window.location.hash = "#/ajuda"));
  for (const assunto of ["Apontamento", "Consultar e corrigir", "Metas e números", "OPs e Feedbacks", "Sua conta"]) {
    await expect(page.getByRole("heading", { name: assunto, level: 3, exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "Como faço um apontamento?" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Conferir e terminar: veja o resumo" })).toBeVisible();
  // busca pelo texto de dentro da resposta, sem acento
  await page.getByPlaceholder(/Buscar na ajuda/).fill("restaurar");
  await expect(page.getByRole("button", { name: "A luz caiu no meio do apontamento. Perdi tudo?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Como faço um apontamento?" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Sua conta", level: 3 })).toHaveCount(0);
  await page.getByPlaceholder(/Buscar na ajuda/).fill("xyzxyz");
  await expect(page.getByText("Nada encontrado")).toBeVisible();
});

test("ocorrências do turno: material da máquina parada, falta de pessoa, cadastro e histórico", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await iniciarTurno(page);
  const maquina = "Máquina de plugue Slin (Aumaq)";
  await page.getByRole("button", { name: `Marcar que ${maquina} não produziu` }).click();
  await page.getByRole("radio", { name: "Falta de material" }).click();
  await page.getByRole("button", { name: `Concluir ${maquina}` }).click();
  await page.getByRole("button", { name: /Conferir e terminar/ }).first().click();
  const materiais = page.getByRole("region", { name: "Materiais faltantes" });
  // a parada por falta de material pede o material, com a máquina já escolhida
  await materiais.getByRole("button", { name: "Informar o material" }).click();
  // a máquina parada já vem escolhida; dá para juntar outra
  await expect(materiais.getByRole("list", { name: "Máquinas escolhidas" })).toContainText(maquina);
  await materiais.getByLabel(/Máquinas afetadas/).selectOption({ label: "Embaladora horizontal nº 1" });
  await expect(materiais.getByRole("list", { name: "Máquinas escolhidas" })).toContainText("Embaladora horizontal nº 1");
  // o filme 19189479 já está neste turno: não aparece de novo (o mesmo material entra uma vez por turno)
  await page.getByRole("combobox", { name: "Material" }).fill("filme");
  await expect(page.getByRole("option", { name: /19189479/ })).toHaveCount(0);
  await page.getByRole("combobox", { name: "Material" }).fill("etiqueta");
  await page.getByRole("option", { name: /12093344/ }).click();
  await materiais.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(materiais.getByText(`${maquina}, Embaladora horizontal nº 1`)).toBeVisible();
  await expect(materiais.getByRole("button", { name: "Informar o material" })).toHaveCount(0);

  // falta de pessoa: sem escolher, não adiciona; quem não está no cadastro é cadastrado ali
  const pessoas = page.getByRole("region", { name: "Falta de pessoas" });
  await pessoas.getByRole("button", { name: "Adicionar pessoa" }).click();
  await pessoas.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(pessoas.getByText("Escolha a pessoa na lista.")).toBeVisible();
  await page.getByRole("combobox", { name: "Colaborador" }).fill("joão da silva");
  await page.getByRole("option", { name: /Cadastrar “João da Silva”/ }).click();
  await pessoas.getByRole("radio", { name: "Saiu mais cedo" }).click();
  await pessoas.getByLabel("Saiu às (opcional)").fill("11:30");
  await pessoas.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(pessoas.getByText("Saiu mais cedo · 11:30")).toBeVisible();

  // o cadastro novo aparece em Colaboradores, com a ocorrência do mês
  await page.evaluate(() => (window.location.hash = "#/colaboradores"));
  const linha = page.getByRole("row", { name: /João da Silva/ });
  await expect(linha).toContainText("1 saída ou atraso");

  // no Histórico do dia, por turno, com o material e o nome
  await page.evaluate(() => (window.location.hash = "#/historico"));
  const occ = page.getByRole("region", { name: "Ocorrências do turno" });
  await expect(occ.getByText("João da Silva")).toBeVisible();
  await expect(occ.getByText(maquina)).toBeVisible();
});

test("filtro de período aceita a data digitada", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await page.evaluate(() => (window.location.hash = "#/ranking"));
  await page.getByRole("button", { name: /^Período:/ }).click();
  const de = page.getByLabel("Data inicial, dd/mm/aaaa");
  const ate = page.getByLabel("Data final, dd/mm/aaaa");
  // fim antes do início: avisa e não aplica
  await de.fill("20032026");
  await ate.fill("10032026");
  await expect(page.getByText("A data final vem antes da inicial.")).toBeVisible();
  await ate.fill("");
  await ate.pressSequentially("25032026");
  await expect(de).toHaveValue("20/03/2026");
  await expect(ate).toHaveValue("25/03/2026");
  await ate.press("Enter");
  await expect(page.getByRole("button", { name: /^Período: 20 – 25 mar/ })).toBeVisible();
});

test("ocorrências: o operador não vê os nomes registrados antes, só o que acabou de lançar", async ({ page }) => {
  await entrar(page, "operador@demo.weg");
  await iniciarTurno(page);
  await page.getByRole("button", { name: /Conferir e terminar/ }).first().click();
  const pessoas = page.getByRole("region", { name: "Falta de pessoas" });
  // as do turno (registradas por outra pessoa): só o tipo, sem nome e sem corrigir
  await expect(pessoas.getByText("Nome visível só para o gestor").first()).toBeVisible();
  await expect(pessoas.getByRole("button", { name: /^Editar Nome visível/ })).toHaveCount(0);
  await expect(pessoas.getByText("Gabriel Martins")).toHaveCount(0);
  // o que ele lança agora aparece com o nome e dá para desfazer
  await pessoas.getByRole("button", { name: "Adicionar pessoa" }).click();
  await page.getByRole("combobox", { name: "Colaborador" }).fill("fernanda");
  await page.getByRole("option", { name: /Fernanda Oliveira/ }).click();
  await pessoas.getByRole("radio", { name: "Faltou" }).click();
  await pessoas.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(pessoas.getByText("Fernanda Oliveira")).toBeVisible();
  await expect(pessoas.getByRole("button", { name: "Tirar Fernanda Oliveira" })).toBeVisible();
  // e não oferece cadastrar gente nova (só o gestor)
  await pessoas.getByRole("button", { name: "Adicionar pessoa" }).click();
  await page.getByRole("combobox", { name: "Colaborador" }).fill("pessoa nova");
  await expect(page.getByRole("option", { name: /Cadastrar/ })).toHaveCount(0);
});

test("colaboradores: inativar avisa quantas faltas perdem o nome, e elas perdem", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await page.evaluate(() => (window.location.hash = "#/colaboradores"));
  const linha = page.getByRole("row", { name: /Gabriel Martins/ });
  await expect(linha).toContainText("saídas ou atrasos");
  await linha.getByRole("button", { name: /Inativar/ }).click();
  const dialogo = page.getByRole("dialog", { name: "Inativar o colaborador?" });
  await expect(dialogo).toContainText("faltas registradas vão perder o nome");
  await dialogo.getByRole("button", { name: /^Inativar e tirar o nome de \d+ faltas$/ }).click();
  await page.getByRole("radio", { name: /^Todos \(/ }).click();
  await expect(page.getByRole("row", { name: /Gabriel Martins/ })).toContainText("Nenhuma");
  // no Histórico do dia, a falta continua, sem o nome
  await page.evaluate(() => (window.location.hash = "#/historico"));
  await expect(page.getByRole("region", { name: "Ocorrências do turno" }).getByText("Sem nome (colaborador inativado)").first()).toBeVisible();
});

test("acumulado vs meta: duas leituras com a mesma base dos dois lados, e o resumo que explica a distância", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await page.getByText("Gráficos", { exact: true }).first().click();
  const card = page.getByRole("region", { name: "Produção acumulada vs meta" });
  await expect(card.getByText("Atingimento", { exact: true })).toBeVisible();
  await expect(card.getByText("Meta coberta por apontamento")).toBeVisible();
  await expect(card.getByText("Fora da meta", { exact: true })).toBeVisible();
  // padrão: turnos apontados (a conta do atingimento)
  await expect(card.getByText("Meta dos turnos apontados", { exact: true })).toBeVisible();
  await card.getByRole("radio", { name: "Calendário" }).click();
  await expect(card.getByText("Meta do calendário", { exact: true })).toBeVisible();
  await expect(card.getByText("Meta dos turnos apontados", { exact: true })).toHaveCount(0);
  // a tabela segue a leitura escolhida
  await card.getByRole("radio", { name: "Tabela" }).click();
  await expect(card.getByRole("columnheader", { name: "Produção total" })).toBeVisible();
});
