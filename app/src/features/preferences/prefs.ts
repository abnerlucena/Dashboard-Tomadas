import { storageGet } from "@/lib/utils";

/*
 * Preferências pessoais: cada conta tem as suas (tema, página inicial, barra
 * lateral, tamanho dos controles do Apontamento, rascunho). Hoje ficam no
 * navegador, uma chave por pessoa: duas pessoas no mesmo computador não
 * misturam as escolhas. Quando o banco guardar as preferências na conta, só o
 * `PrefsStore` abaixo muda (recado em docs/database/notas/2026-10-13-preferencias-e-foto-de-perfil.md).
 */

export type ThemePref = "light" | "dark" | "auto";
export type StartPref = "dashboard" | "apontamento" | "ultima";

export interface Prefs {
  tema: ThemePref;
  /** para onde o Dash leva depois do login */
  inicio: StartPref;
  /** barra lateral aberta por padrão */
  nav: boolean;
  /** controles de 44px (toque) no Apontamento, em vez de 32px */
  toque: boolean;
  /** guarda o que foi digitado e não concluído, para voltar depois de queda de energia */
  rascunho: boolean;
}

/** Padrão de fábrica: o que "Restaurar padrões" devolve */
export const FACTORY_PREFS: Prefs = { tema: "auto", inicio: "dashboard", nav: true, toque: true, rascunho: true };

/**
 * Os valores de quem nunca mexeu. `tema` e `nav` herdam o que o navegador já tinha
 * (as chaves antigas, de antes das preferências por conta), para ninguém ver o Dash
 * mudar sozinho no dia da atualização.
 */
export function defaultPrefs(): Prefs {
  return {
    ...FACTORY_PREFS,
    tema: sanitizeTheme(storageGet<unknown>("dash-proto.color-mode", "auto")),
    nav: storageGet<unknown>("dash-proto.sidenav.expanded", true) !== false,
  };
}

const sanitizeTheme = (v: unknown): ThemePref => (v === "light" || v === "dark" || v === "auto" ? v : "auto");

/** Lê o que veio do armazenamento como dado não confiável: o que não for válido cai no padrão */
export function sanitizePrefs(raw: unknown, fallback: Prefs = defaultPrefs()): Prefs {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    tema: r.tema === undefined ? fallback.tema : sanitizeTheme(r.tema),
    inicio: r.inicio === "dashboard" || r.inicio === "apontamento" || r.inicio === "ultima" ? r.inicio : fallback.inicio,
    nav: typeof r.nav === "boolean" ? r.nav : fallback.nav,
    toque: typeof r.toque === "boolean" ? r.toque : fallback.toque,
    rascunho: typeof r.rascunho === "boolean" ? r.rascunho : fallback.rascunho,
  };
}

/** Onde as preferências moram. Hoje o navegador; depois, a conta no banco */
export interface PrefsStore {
  load(user: string): Prefs;
  save(user: string, prefs: Prefs): void;
  /** última tela aberta, para a preferência "Última tela" */
  lastRoute(user: string): string | null;
  saveLastRoute(user: string, route: string): void;
}

const PREFS_KEY = "dash.prefs.v1:";
const LAST_KEY = "dash.ultima.v1:";

export const localPrefsStore: PrefsStore = {
  load(user) {
    try {
      const raw = localStorage.getItem(PREFS_KEY + user);
      return raw ? sanitizePrefs(JSON.parse(raw)) : defaultPrefs();
    } catch {
      return defaultPrefs();
    }
  },
  save(user, prefs) {
    try {
      localStorage.setItem(PREFS_KEY + user, JSON.stringify(prefs));
    } catch {
      /* armazenamento cheio ou bloqueado: vale nesta sessão */
    }
  },
  lastRoute(user) {
    try {
      const v = localStorage.getItem(LAST_KEY + user);
      return v && /^[a-z0-9-]{1,40}$/.test(v) ? v : null;
    } catch {
      return null;
    }
  },
  saveLastRoute(user, route) {
    try {
      localStorage.setItem(LAST_KEY + user, route);
    } catch {
      /* sem armazenamento */
    }
  },
};
