import { beforeEach, describe, expect, it } from "vitest";
import { FACTORY_PREFS, defaultPrefs, localPrefsStore, sanitizePrefs } from "./prefs";

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

describe("preferências pessoais", () => {
  it("quem nunca mexeu recebe o padrão", () => {
    expect(localPrefsStore.load("u1")).toEqual(FACTORY_PREFS);
  });

  it("cada pessoa guarda as suas: uma não aparece para a outra", () => {
    localPrefsStore.save("u1", { ...FACTORY_PREFS, tema: "dark", inicio: "apontamento" });
    localPrefsStore.save("u2", { ...FACTORY_PREFS, nav: false });
    expect(localPrefsStore.load("u1")).toMatchObject({ tema: "dark", inicio: "apontamento", nav: true });
    expect(localPrefsStore.load("u2")).toMatchObject({ tema: "auto", inicio: "dashboard", nav: false });
    expect(localPrefsStore.load("u3")).toEqual(FACTORY_PREFS);
  });

  it("herda o tema e a barra lateral que o navegador já tinha, para ninguém ver o Dash mudar no dia da atualização", () => {
    store.set("dash-proto.color-mode", JSON.stringify("dark"));
    store.set("dash-proto.sidenav.expanded", JSON.stringify(false));
    expect(defaultPrefs()).toMatchObject({ tema: "dark", nav: false });
    expect(localPrefsStore.load("novo")).toMatchObject({ tema: "dark", nav: false });
  });

  it("trata o que vem do armazenamento como dado não confiável", () => {
    expect(sanitizePrefs({ tema: "rosa", inicio: "outra", nav: "sim", toque: 1, rascunho: null }, FACTORY_PREFS)).toEqual(FACTORY_PREFS);
    expect(sanitizePrefs("lixo", FACTORY_PREFS)).toEqual(FACTORY_PREFS);
    expect(sanitizePrefs({ toque: false, rascunho: false }, FACTORY_PREFS)).toEqual({ ...FACTORY_PREFS, toque: false, rascunho: false });
    store.set("dash.prefs.v1:u1", "{não é json");
    expect(localPrefsStore.load("u1")).toEqual(defaultPrefs());
  });

  it("lembra a última tela por pessoa e recusa valor estranho", () => {
    localPrefsStore.saveLastRoute("u1", "historico");
    expect(localPrefsStore.lastRoute("u1")).toBe("historico");
    expect(localPrefsStore.lastRoute("u2")).toBeNull();
    store.set("dash.ultima.v1:u3", "../../x y");
    expect(localPrefsStore.lastRoute("u3")).toBeNull();
  });
});
