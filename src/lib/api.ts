// ─── API Layer ────────────────────────────────────────────────
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyGWjBPTX4Em8T0eh3hfT7RWEmjRQAf_RwGmhPbyZn3lHZgombjKzyFwYkBKQN0vC3SDw/exec";
export const SESSION_KEY = "prod_session_v3";
const CACHE_KEY = "prod_records_cache";
const CACHE_METAS_KEY = "prod_metas_cache";
const CACHE_HOLIDAYS_KEY = "prod_holidays_cache";

export interface Session {
  token: string;
  nome: string;
  role: "admin" | "user";
  expiresAt?: string;
  // Campos só do modo Supabase (VITE_DATA_SOURCE=supabase); ausentes no modo GAS.
  source?: "gas" | "supabase" | "mock";
  userId?: string;
  permissions?: string[];
  /**
   * Nome do perfil em português ("Gestor", "Distribuidor"). A tela mostrava
   * um rótulo deduzido das permissões, que acertava por acaso: duas pessoas
   * com o mesmo conjunto apareciam iguais mesmo tendo perfis diferentes.
   */
  roleName?: string;
  accountType?: "personal" | "shared" | "display";
}

export interface Machine {
  id: number;
  name: string;
  hasMeta: boolean;
  defaultMeta: number;
  status?: string;
  /** Só modo Supabase: lotação padrão do posto (`standard_operator_count`).
   *  Serve para ratear a meta das horizontais pela lotação real (D47). */
  standardOperatorCount?: number | null;
  /**
   * Linha do centro de trabalho (D37): montagem ou embalagem. Vem da coluna
   * `machines.process`, que todo centro tem. A interface agrupava pela linha
   * adivinhando pelo nome, e um centro renomeado mudaria de linha sem ninguém
   * pedir. "Granel" não é linha: é um agrupamento só de tela.
   */
  process?: "assembly" | "packaging";
}

export interface Holiday {
  id: string;
  date: string;
  label: string;
  type: "feriado" | "dia_anulado";
  createdBy?: string;
  createdAt?: string;
  // Modo Supabase: tipo original do evento e turnos afetados (vazio = dia inteiro).
  eventType?: "holiday" | "special_event" | "excluded_day";
  shiftIds?: number[];
}

export interface OrdemProducao {
  ordemId: string;
  quantidade: number;
  obs?: string;
  retrabalho?: boolean;
}

export interface ProdRecord {
  id?: string;
  date: string;
  turno: string;
  machineId: number;
  machineName: string;
  meta: number;
  producao: number;
  savedBy: string;
  savedAt?: string;
  editUser?: string;
  editTime?: string;
  obs?: string;
  ordensProducao?: OrdemProducao[];
  // Campos só do modo Supabase (ver src/lib/repositories/supabase/adapters.ts).
  workMode?: "regular" | "overtime";
  goodQuantity?: number;
  reworkQuantity?: number;
  /** Meta efetiva do turno: já multiplicada pelas pessoas quando a meta da
   *  máquina é por operador (A Granél, D39/D46). Diferente de `meta`, que vai a
   *  zero quando o apontamento não conta para meta (hora extra, dia anulado). */
  targetQuantity?: number;
  countsTowardTarget?: boolean;
  isExcludedDay?: boolean;
  operatorCount?: number | null;
}

// ─── Session helpers ──────────────────────────────────────────
export const loadSession = (): Session | null => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
  catch { return null; }
};
export const saveSession = (u: Session) => {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(u)); } catch { /* sem localStorage: a sessão vale só nesta aba */ }
};
export const clearSession = () => {
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_METAS_KEY);
    localStorage.removeItem(CACHE_HOLIDAYS_KEY);
  } catch { /* sem localStorage: não havia o que limpar */ }
};

// ─── Cache helpers ────────────────────────────────────────────
export const loadCachedRecords = (): ProdRecord[] => {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "[]"); }
  catch { return []; }
};
export const saveCachedRecords = (data: ProdRecord[]) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* cota cheia ou aba privada: segue sem cache */ }
};
export const loadCachedMetas = (): Record<number, number> | null => {
  try { return JSON.parse(localStorage.getItem(CACHE_METAS_KEY) || "null"); }
  catch { return null; }
};
export const saveCachedMetas = (m: Record<number, number>) => {
  try { localStorage.setItem(CACHE_METAS_KEY, JSON.stringify(m)); } catch { /* cota cheia ou aba privada: segue sem cache */ }
};
export const loadCachedHolidays = (): Holiday[] => {
  try { return JSON.parse(localStorage.getItem(CACHE_HOLIDAYS_KEY) || "[]"); }
  catch { return []; }
};
export const saveCachedHolidays = (h: Holiday[]) => {
  try { localStorage.setItem(CACHE_HOLIDAYS_KEY, JSON.stringify(h)); } catch { /* cota cheia ou aba privada: segue sem cache */ }
};

// ─── cellKey ──────────────────────────────────────────────────
export const cellKey = (mId: number, d: string, t: string) => `${mId}_${d}_${t}`;

// ─── Date helpers ─────────────────────────────────────────────
export const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => fmt(new Date());

export const parseAny = (s: string | Date | undefined): Date => {
  if (!s) return new Date(0);
  if (s instanceof Date) return new Date(s);
  if (typeof s === 'string') {
    if (s.length >= 10 && s[4] === '-' && s[7] === '-') return new Date(s.slice(0, 10) + 'T00:00:00');
    if (s.includes('/')) {
      const parts = s.split(' ')[0].split('/');
      if (parts.length === 3) { const [d, m, y] = parts; return new Date(`${y}-${m}-${d}T00:00:00`); }
    }
  }
  try { const d = new Date(s as string); if (!isNaN(d.getTime())) return d; } catch { /* data impossível: cai no new Date(0) abaixo */ }
  return new Date(0);
};

export const dispD = (s: string | undefined) => {
  if (!s) return "";
  const d = parseAny(s);
  if (!d.getTime()) return String(s);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

export const dispDH = (s: string | undefined) => {
  if (!s) return "";
  const d = parseAny(s);
  if (!d.getTime()) return String(s);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// ─── API call ─────────────────────────────────────────────────
/** Resposta crua do Apps Script: sempre um objeto, com `ok` e, quando falha, `error`. */
export type RespostaGas = { ok?: boolean; error?: string } & Record<string, unknown>;

/**
 * Chama o Apps Script. `T` é a forma esperada da resposta: quem chama declara o
 * que espera (ver `src/lib/repositories/gas.ts`), em vez de receber `any` e
 * descobrir na tela quando o backend muda de formato.
 */
export async function api<T = RespostaGas>(action: string, body: Record<string, unknown> = {}, userSession?: Session | null): Promise<T> {
  const payload: Record<string, unknown> = { action, ...body };
  if (userSession?.token) payload.token = userSession.token;
  const obj = JSON.stringify(payload);
  const encoded = btoa(encodeURIComponent(obj).replace(/%([0-9A-F]{2})/g, (_, p) => String.fromCharCode(parseInt(p, 16))));
  const url = `${SCRIPT_URL}?payload=${encodeURIComponent(encoded)}&t=${Date.now()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (e: unknown) {
    if ((e as Error)?.name === "AbortError") throw new Error("Tempo de resposta excedido. Tente novamente.");
    throw new Error("Não foi possível conectar ao servidor. Verifique sua internet.");
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error("Erro no servidor (HTTP " + res.status + ")");
  let j: RespostaGas;
  try { j = await res.json(); }
  catch { throw new Error("Resposta inválida do servidor. Tente novamente."); }
  if (!j.ok && j.error && j.error.includes("Sessão")) {
    clearSession();
    window.location.reload();
    throw new Error("Sessão expirada. Reconectando...");
  }
  if (!j.ok) throw new Error(j.error || "Erro no servidor");
  return j as T;
}

// ─── Default machines (fallback) ──────────────────────────────
export const MACHINES_DEFAULT: Machine[] = [
  { id: 1, name: "HORIZONTAL 1", hasMeta: true, defaultMeta: 500 },
  { id: 2, name: "HORIZONTAL 2", hasMeta: true, defaultMeta: 500 },
  { id: 3, name: "VERTICAL PLACAS / SUP. 1", hasMeta: true, defaultMeta: 400 },
  { id: 4, name: "VERTICAL PLACAS / SUP. 2", hasMeta: true, defaultMeta: 400 },
  { id: 5, name: "VERTICAL MÓDULOS 1", hasMeta: true, defaultMeta: 350 },
  { id: 6, name: "VERTICAL MÓDULOS 2", hasMeta: true, defaultMeta: 350 },
  { id: 7, name: "A GRANEL", hasMeta: true, defaultMeta: 600 },
  { id: 8, name: "MÁQUINA INTERRUPTOR", hasMeta: true, defaultMeta: 300 },
  { id: 9, name: "TESTE INTERRUPTORES", hasMeta: true, defaultMeta: 250 },
  { id: 10, name: "MANUAL INTERRUPTOR", hasMeta: true, defaultMeta: 200 },
  { id: 11, name: "MONTAGEM DIVERSOS", hasMeta: true, defaultMeta: 150 },
  { id: 12, name: "MONTAGEM PLACA REFINATTO", hasMeta: true, defaultMeta: 180 },
  { id: 13, name: "KIT 1 PARAFUSO", hasMeta: true, defaultMeta: 220 },
  { id: 14, name: "KIT 2 PARAFUSO", hasMeta: true, defaultMeta: 220 },
  { id: 15, name: "MONTAGEM TOMADAS MANUAL", hasMeta: true, defaultMeta: 160 },
  { id: 16, name: "MÁQUINA DE TOMADAS AUTOMÁTICA", hasMeta: true, defaultMeta: 500 },
  { id: 17, name: "INSERÇÃO DOS CONTATOS INTERRUPTOR", hasMeta: true, defaultMeta: 0 },
  { id: 18, name: "FECHAMENTO TECLA INTERRUPTORES", hasMeta: true, defaultMeta: 0 },
  { id: 19, name: "RETRABALHO GERAL", hasMeta: true, defaultMeta: 0 },
];

export const TURNOS = ["TURNO 1", "TURNO 2", "TURNO 3"];

// ─── Utility ──────────────────────────────────────────────────
export const num = (v: unknown): number => { const x = Number(v); return isNaN(x) ? 0 : x; };
export const pctColor = (p: number | null): string =>
  p === null ? "#6B7280" : p >= 100 ? "#22C55E" : p >= 80 ? "#F59E0B" : "#EF4444";
