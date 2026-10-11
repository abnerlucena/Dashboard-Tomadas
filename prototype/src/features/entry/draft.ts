/*
 * Rascunho do Apontamento no navegador.
 *
 * O que foi digitado e ainda não concluído é guardado no `localStorage` a cada
 * alteração, para sobreviver a queda de energia, navegador fechado ou
 * computador travado. Fica só neste aparelho, ligado à pessoa que entrou, e
 * expira em 48 horas. Cada máquina concluída sai do rascunho (já está no
 * banco); terminar o turno apaga o rascunho todo; sair do Dash (logout) apaga
 * os rascunhos de quem saiu. Senha e dados da sessão nunca entram aqui.
 */

const PREFIX = "dash.rascunho.apontamento.v1:";
export const DRAFT_TTL_MS = 48 * 60 * 60 * 1000;

export interface DraftRow {
  op: string;
  qty: string;
  rework: boolean;
  reason: string;
}

/** Os campos de uma máquina que a pessoa digitou */
export interface DraftMachine {
  rows: DraftRow[];
  note: string;
  noteOpen: boolean;
  people: string;
  stopOpen: boolean;
  stop: string;
  stopPlanned: boolean;
}

export interface Draft {
  savedAt: number;
  date: string;
  shift: 1 | 2 | 3;
  overtime: boolean;
  machines: Record<string, DraftMachine>;
}

export interface DraftTurn {
  date: string;
  shift: 1 | 2 | 3;
  overtime: boolean;
}

const keyOf = (user: string, t: DraftTurn) => `${PREFIX}${user}:${t.date}:${t.shift}:${t.overtime ? "x" : "n"}`;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** Lê o que veio do armazenamento como dado não confiável: só texto e booleanos, com limite de tamanho */
function sanitize(raw: unknown): Draft | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (typeof d.savedAt !== "number" || typeof d.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return null;
  if (d.shift !== 1 && d.shift !== 2 && d.shift !== 3) return null;
  if (!d.machines || typeof d.machines !== "object") return null;
  const machines: Record<string, DraftMachine> = {};
  for (const [id, m] of Object.entries(d.machines as Record<string, unknown>)) {
    if (!m || typeof m !== "object" || !/^[\w-]{1,40}$/.test(id)) continue;
    const x = m as Record<string, unknown>;
    machines[id] = {
      rows: (Array.isArray(x.rows) ? x.rows : []).slice(0, 20).map((r) => {
        const y = (r ?? {}) as Record<string, unknown>;
        return { op: str(y.op, 15), qty: str(y.qty, 12), rework: y.rework === true, reason: str(y.reason, 200) };
      }),
      note: str(x.note, 500),
      noteOpen: x.noteOpen === true,
      people: str(x.people, 2),
      stopOpen: x.stopOpen === true,
      stop: str(x.stop, 120),
      stopPlanned: x.stopPlanned === true,
    };
  }
  return { savedAt: d.savedAt, date: d.date, shift: d.shift, overtime: d.overtime === true, machines };
}

/** Guarda o rascunho do turno; sem nenhuma máquina digitada, apaga */
export function saveDraft(user: string, turn: DraftTurn, machines: Record<string, DraftMachine>, now = Date.now()) {
  try {
    if (!Object.keys(machines).length) return removeDraft(user, turn);
    const draft: Draft = { savedAt: now, ...turn, machines };
    localStorage.setItem(keyOf(user, turn), JSON.stringify(draft));
  } catch {
    /* armazenamento cheio ou bloqueado: a tela continua funcionando sem rascunho */
  }
}

export function removeDraft(user: string, turn: DraftTurn) {
  try {
    localStorage.removeItem(keyOf(user, turn));
  } catch {
    /* sem armazenamento */
  }
}

/** Rascunhos de quem está logado, do mais recente ao mais antigo; os vencidos ou inválidos são apagados */
export function listDrafts(user: string, now = Date.now()): Draft[] {
  const found: Draft[] = [];
  try {
    const prefix = `${PREFIX}${user}:`;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      let draft: Draft | null = null;
      try {
        draft = sanitize(JSON.parse(localStorage.getItem(key) ?? "null"));
      } catch {
        draft = null;
      }
      if (!draft || now - draft.savedAt > DRAFT_TTL_MS || !Object.keys(draft.machines).length) localStorage.removeItem(key);
      else found.push(draft);
    }
  } catch {
    return [];
  }
  return found.sort((a, b) => b.savedAt - a.savedAt);
}

/** Saída do Dash: apaga os rascunhos de quem saiu */
export function clearUserDrafts(user: string) {
  try {
    const prefix = `${PREFIX}${user}:`;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) localStorage.removeItem(key);
    }
  } catch {
    /* sem armazenamento */
  }
}
