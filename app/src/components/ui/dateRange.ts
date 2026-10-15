// ─── Período: tipo, primitivas de data e rótulos ──────────────
// Fora de DateRangePicker.tsx de propósito: um arquivo que exporta componente E
// funções perde o recarregamento a quente (react-refresh). Tudo aqui é puro.

export interface Range {
  from: Date;
  to: Date;
}

export const WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
export const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
export const dayMonth = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
export const longDay = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });

export const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const same = (a: Date, b: Date) => a.getTime() === b.getTime();
export const isWeekday = (d: Date) => d.getDay() !== 0 && d.getDay() !== 6;
export const clamp = (d: Date, min: Date, max: Date) => (d < min ? min : d > max ? max : d);
export const shortLabel = (d: Date) => dayMonth.format(d).replace(".", "").replace(" de ", " ");
export const workingDaysBetween = (r: Range) => {
  let n = 0;
  for (let d = r.from; d <= r.to; d = addDays(d, 1)) if (isWeekday(d)) n++;
  return n;
};

/** Texto do período: "Março de 2026", "27 mar", "02 – 13 mar" */
export function rangeLabel(r: Range) {
  const lastOfMonth = new Date(r.from.getFullYear(), r.from.getMonth() + 1, 0);
  if (r.from.getDate() === 1 && same(r.to, lastOfMonth)) {
    const m = monthName.format(r.from);
    return m.charAt(0).toUpperCase() + m.slice(1);
  }
  if (same(r.from, r.to)) return shortLabel(r.from);
  // Período que atravessa o ano: com o ano, para não confundir 10 jan de anos diferentes
  if (r.from.getFullYear() !== r.to.getFullYear()) return `${toBrDate(r.from)} – ${toBrDate(r.to)}`;
  return r.from.getMonth() === r.to.getMonth() && r.from.getFullYear() === r.to.getFullYear()
    ? `${String(r.from.getDate()).padStart(2, "0")} – ${shortLabel(r.to)}`
    : `${shortLabel(r.from)} – ${shortLabel(r.to)}`;
}

/** Atalhos relativos ao último dia com dados */
export function presetsFor(dataEnd: Date, min: Date, max: Date) {
  const monday = addDays(dataEnd, -((dataEnd.getDay() + 6) % 7));
  let back = dataEnd;
  for (let n = 1; n < 10; ) {
    back = addDays(back, -1);
    if (isWeekday(back)) n++;
  }
  const list: Array<{ id: string; label: string; range: Range }> = [
    { id: "last", label: "Último dia com dados", range: { from: dataEnd, to: dataEnd } },
    { id: "week", label: "Esta semana", range: { from: monday, to: dataEnd } },
    { id: "prev-week", label: "Semana passada", range: { from: addDays(monday, -7), to: addDays(monday, -3) } },
    { id: "10d", label: "Últimos 10 dias úteis", range: { from: back, to: dataEnd } },
    { id: "fortnight", label: "1ª quinzena", range: { from: min, to: new Date(min.getFullYear(), min.getMonth(), 15) } },
    { id: "mtd", label: "Mês até hoje", range: { from: min, to: dataEnd } },
    { id: "month", label: "Mês inteiro", range: { from: min, to: max } },
  ];
  return list.map((p) => ({ ...p, range: { from: clamp(p.range.from, min, max), to: clamp(p.range.to, min, max) } }));
}

/* ---------- Data digitada (dd/mm/aaaa) ---------- */

/** "10012026" ou "10/1/2026" → "10/01/2026" enquanto digita: só números, barras nos lugares */
export function maskBrDate(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join("/");
}

/** "10/01/2026" → a data; `null` se incompleta ou se o dia não existe (31/02) */
export function parseBrDate(s: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day ? d : null;
}

export const toBrDate = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

/**
 * Confere o período digitado: as duas datas completas, dentro dos limites e na
 * ordem. Devolve o período ou a mensagem para mostrar.
 */
export function checkTypedRange(from: string, to: string, min: Date, max: Date): { range: Range } | { error: string | null } {
  const a = parseBrDate(from);
  const b = parseBrDate(to);
  const full = (s: string) => s.replace(/\D/g, "").length === 8;
  if ((full(from) && !a) || (full(to) && !b)) return { error: "Essa data não existe. Confira o dia e o mês." };
  if (!a || !b) return { error: null };
  if (a < min || b > max || a > max || b < min) return { error: `Escolha datas entre ${toBrDate(min)} e ${toBrDate(max)}.` };
  if (b < a) return { error: "A data final vem antes da inicial." };
  return { range: { from: a, to: b } };
}
