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
  return r.from.getMonth() === r.to.getMonth()
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
