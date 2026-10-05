import { describe, it, expect, beforeEach } from "vitest";
import { mockAuth, mockUsers, resetarMock } from "@/lib/repositories/mock/acesso";
import { SENHA_DEMO } from "@/lib/repositories/mock/contas";

// A edição de permissão a permissão (pedido da sessão da interface, 27/09).
// O gestor escolheu em 01/10 NÃO travar quais permissões podem ser concedidas,
// e em vez disso guardar o rastro de quem concedeu o quê. Estes testes cobrem
// as duas pontas dessa decisão.
beforeEach(() => resetarMock());

const comoGestor = async () => (await mockAuth.login("gestor@demo.local", SENHA_DEMO)).session;
const comoOperador = async () => (await mockAuth.login("operador@demo.local", SENHA_DEMO)).session;
const codigos = async (id: string, s: Awaited<ReturnType<typeof comoGestor>>) =>
  (await mockUsers.getPermissions(id, s)).map(p => p.code);

describe("catálogo de permissões", () => {
  it("traz código e descrição em português", async () => {
    const catalogo = await mockUsers.listPermissions(await comoGestor());
    expect(catalogo.length).toBe(21);
    expect(catalogo.find(p => p.code === "targets.manage")?.description).toBe("Alterar metas");
  });
});

describe("ler permissões de um usuário", () => {
  it("o gestor vê as de outra pessoa", async () => {
    const s = await comoGestor();
    expect(await codigos("u-operador", s)).toEqual(["production.create", "production.edit_own"]);
  });

  it("quem não aprova vê as próprias", async () => {
    const s = await comoOperador();
    expect(await codigos("u-operador", s)).toContain("production.create");
  });

  it("quem não aprova NÃO vê as de outro", async () => {
    const s = await comoOperador();
    await expect(mockUsers.getPermissions("u-tecnico", s))
      .rejects.toThrow("Você não tem permissão para ver as permissões de outro usuário.");
  });
});

describe("gravar permissões", () => {
  it("acrescenta e retira numa chamada só", async () => {
    const s = await comoGestor();
    await mockUsers.setPermissions("u-operador", ["production.create", "history.view"], s);
    expect(await codigos("u-operador", s)).toEqual(["history.view", "production.create"]);
  });

  it("a lista é COMPLETA: o que não vem é retirado", async () => {
    const s = await comoGestor();
    await mockUsers.setPermissions("u-tecnico", ["dashboard.view"], s);
    expect(await codigos("u-tecnico", s)).toEqual(["dashboard.view"]);
  });

  it("recusa código que não existe, como a chave estrangeira do banco", async () => {
    const s = await comoGestor();
    await expect(mockUsers.setPermissions("u-operador", ["voar.alto"], s))
      .rejects.toThrow('Permissão desconhecida: "voar.alto".');
  });

  it("quem não aprova não grava", async () => {
    const s = await comoOperador();
    await expect(mockUsers.setPermissions("u-operador", ["system.admin"], s))
      .rejects.toThrow("Você não tem permissão para alterar permissões de usuários.");
  });

  // A decisão do gestor (01/10): nada impede conceder as permissões fortes —
  // o que existe é o registro de quem concedeu.
  it("o gestor PODE conceder system.admin, e isso fica registrado", async () => {
    const s = await comoGestor();
    await mockUsers.setPermissions("u-operador", ["production.create", "system.admin"], s);
    const depois = await mockUsers.getPermissions("u-operador", s);
    expect(depois.map(p => p.code)).toContain("system.admin");
    expect(depois.every(p => p.grantedBy !== "")).toBe(true);
  });
});

describe("o perfil é modelo, não fonte (D22)", () => {
  it("aprovar copia as permissões do perfil", async () => {
    const s = await comoGestor();
    await mockUsers.approveUser("u-pendente", 1, s);
    expect(await codigos("u-pendente", s)).toEqual(["production.create", "production.edit_own"]);
  });

  it("ajustar depois NÃO volta atrás ao entrar de novo", async () => {
    const s = await comoGestor();
    await mockUsers.setPermissions("u-operador", ["production.create", "history.view"], s);
    const { session } = await mockAuth.login("operador@demo.local", SENHA_DEMO);
    // Se a sessão lesse o perfil em vez da conta, history.view sumiria aqui.
    expect(session.permissions).toEqual(["history.view", "production.create"]);
  });
});

describe("nome do perfil na sessão", () => {
  it("vem pronto, em vez de ser deduzido das permissões", async () => {
    expect((await comoGestor()).roleName).toBe("Gestor");
    expect((await comoOperador()).roleName).toBe("Operador");
  });
});

// D62: work_orders.manage vai para os mesmos perfis que no banco (distribuidor,
// técnico, gestor e admin). Sem isto, no mock só o gestor cadastrava OP, e só
// porque tem system.admin (nota da interface de 05/10).
describe("permissão das OPs no mock, como no banco", () => {
  it("o catálogo tem work_orders.manage", async () => {
    const catalogo = await mockUsers.listPermissions(await comoGestor());
    expect(catalogo.map(p => p.code)).toContain("work_orders.manage");
  });

  it("técnico e gestor têm; operador não", async () => {
    const tecnico = (await mockAuth.login("tecnico@demo.local", SENHA_DEMO)).session;
    expect(tecnico.permissions).toContain("work_orders.manage");
    expect((await comoGestor()).permissions).toContain("work_orders.manage");
    expect((await comoOperador()).permissions).not.toContain("work_orders.manage");
  });
});
