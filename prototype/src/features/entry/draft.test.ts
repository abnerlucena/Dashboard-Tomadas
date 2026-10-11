import { beforeEach, describe, expect, it } from "vitest";
import { DRAFT_TTL_MS, clearUserDrafts, listDrafts, removeDraft, saveDraft, type DraftMachine } from "./draft";

const machine = (m: Partial<DraftMachine> = {}): DraftMachine => ({
  rows: [{ op: "4511111", qty: "500", rework: false, reason: "" }],
  note: "",
  noteOpen: false,
  people: "",
  stopOpen: false,
  stop: "",
  stopPlanned: false,
  ...m,
});
const turn = { date: "2026-10-03", shift: 2 as const, overtime: false };

// o ambiente de teste não tem localStorage: um armazenamento mínimo em memória
const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    get length() {
      return store.size;
    },
    key: (i: number) => [...store.keys()][i] ?? null,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
});

beforeEach(() => store.clear());

describe("rascunho do apontamento", () => {
  it("guarda e lê o que foi digitado, do mais recente ao mais antigo", () => {
    saveDraft("u1", turn, { "11": machine() }, 1_000);
    saveDraft("u1", { ...turn, shift: 3 }, { "12": machine({ stopOpen: true, stop: "Manutenção", stopPlanned: true, rows: [] }) }, 2_000);
    const list = listDrafts("u1", 3_000);
    expect(list.map((d) => d.shift)).toEqual([3, 2]);
    expect(list[1].machines["11"].rows[0]).toEqual({ op: "4511111", qty: "500", rework: false, reason: "" });
    expect(list[0].machines["12"]).toMatchObject({ stop: "Manutenção", stopPlanned: true });
  });

  it("aceita os ids de máquina do app (m11)", () => {
    saveDraft("u1", turn, { m11: machine() });
    expect(Object.keys(listDrafts("u1")[0].machines)).toEqual(["m11"]);
  });

  it("é de cada pessoa: outro usuário não vê", () => {
    saveDraft("u1", turn, { "11": machine() });
    expect(listDrafts("u2")).toEqual([]);
  });

  it("sem máquina digitada, apaga o rascunho do turno", () => {
    saveDraft("u1", turn, { "11": machine() });
    saveDraft("u1", turn, {});
    expect(listDrafts("u1")).toEqual([]);
    expect(store.size).toBe(0);
  });

  it("vence em 48 horas e some do armazenamento", () => {
    saveDraft("u1", turn, { "11": machine() }, 1_000);
    expect(listDrafts("u1", 1_000 + DRAFT_TTL_MS)).toHaveLength(1);
    expect(listDrafts("u1", 1_000 + DRAFT_TTL_MS + 1)).toEqual([]);
    expect(store.size).toBe(0);
  });

  it("descarta lixo no armazenamento sem quebrar", () => {
    store.set("dash.rascunho.apontamento.v1:u1:2026-10-03:1:n", "{isso não é json");
    store.set("dash.rascunho.apontamento.v1:u1:2026-10-03:2:n", JSON.stringify({ savedAt: 1, date: "ontem", shift: 2, machines: {} }));
    expect(listDrafts("u1", 2)).toEqual([]);
    expect(store.size).toBe(0);
  });

  it("limita o tamanho dos textos e ignora o que não é texto", () => {
    saveDraft("u1", turn, { "11": machine({ note: "x".repeat(900), people: "123456" }) });
    const raw = JSON.parse([...store.values()][0]);
    raw.machines["11"].rows[0].op = 12345;
    store.set([...store.keys()][0], JSON.stringify(raw));
    const m = listDrafts("u1")[0].machines["11"];
    expect(m.note).toHaveLength(500);
    expect(m.people).toBe("12");
    expect(m.rows[0].op).toBe("");
  });

  it("removeDraft e clearUserDrafts apagam só o que é da pessoa", () => {
    saveDraft("u1", turn, { "11": machine() });
    saveDraft("u1", { ...turn, shift: 3 }, { "11": machine() });
    saveDraft("u2", turn, { "11": machine() });
    removeDraft("u1", turn);
    expect(listDrafts("u1")).toHaveLength(1);
    clearUserDrafts("u1");
    expect(listDrafts("u1")).toEqual([]);
    expect(listDrafts("u2")).toHaveLength(1);
  });
});
