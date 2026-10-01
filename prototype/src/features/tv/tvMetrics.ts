import {
  COMPARISON_CUTOFF,
  ELAPSED_DATES,
  MACHINES,
  SHIFTS,
  dayKey,
  progressUntil,
  type Line,
  type Machine,
  type Shift,
  type WorkOrder,
} from "@/data/machines";

/*
 * Métricas do Modo TV (chão de fábrica). Tudo por TURNO e por MÁQUINA —
 * nunca por pessoa: o telão gera competição entre equipes sem expor ninguém.
 */

export type TvScope = "fabrica" | Lowercase<Line>;
export const TV_SCOPES: Array<{ id: TvScope; label: string }> = [
  { id: "fabrica", label: "Fábrica inteira" },
  { id: "montagem", label: "Montagem" },
  { id: "embalagem", label: "Embalagem" },
  { id: "granel", label: "Granel" },
];

export const machinesIn = (scope: TvScope) => (scope === "fabrica" ? MACHINES : MACHINES.filter((m) => m.line.toLowerCase() === scope));

/** Turno em que um horário cai (T1 04h55–14h18, T2 14h18–23h24, T3 23h24–05h00) */
export function shiftAt(d: Date): Shift {
  const minutes = d.getHours() * 60 + d.getMinutes();
  if (minutes >= 4 * 60 + 55 && minutes < 14 * 60 + 18) return 1;
  if (minutes >= 14 * 60 + 18 && minutes < 23 * 60 + 24) return 2;
  return 3;
}

const perMinute = (produced: number, minutes: number) => (minutes ? produced / minutes : 0);
export const machinePerMinute = (m: Machine) => perMinute(m.produced, SHIFTS.reduce((s, sh) => s + m.minutesByShift[sh], 0));

/* ---------- Placar dos turnos ---------- */
/**
 * O Turno 3 hoje só existe como hora extra, e só nas máquinas de 3 turnos:
 * comparar com T1/T2 seria injusto. Ele aparece no placar, fora da disputa.
 * Quando virar turno normal, basta tirar daqui.
 */
export const OUT_OF_CONTEST: Shift[] = [3];
export interface ShiftScore {
  shift: Shift;
  produced: number;
  target: number;
  percent: number;
  perMinute: number;
  opsDone: number;
  /** % das peças apontadas como retrabalho (menor é melhor) */
  reworkRate: number;
  /** categorias em que o turno é o melhor */
  wins: Array<keyof typeof CATEGORIES>;
  /** false = aparece no placar, mas fora da disputa (hora extra) */
  competing: boolean;
}

export const CATEGORIES = {
  percent: { label: "Atingimento", higherIsBetter: true },
  perMinute: { label: "Peças por minuto", higherIsBetter: true },
  opsDone: { label: "OPs concluídas", higherIsBetter: true },
  reworkRate: { label: "Retrabalho", higherIsBetter: false },
} as const;

export function shiftScores(machines: Machine[], ops: WorkOrder[]): ShiftScore[] {
  const ids = new Set(machines.map((m) => m.id));
  const done = ops.filter((op) => ids.has(op.machineId) && op.stage === "done" && op.closedAt);
  const scores = SHIFTS.map((shift) => {
    const withTarget = machines.filter((m) => m.hasTarget && m.targetByShift[shift] > 0);
    const target = Math.round(withTarget.reduce((s, m) => s + m.targetByShift[shift], 0));
    const producedTarget = withTarget.reduce((s, m) => s + m.byShift[shift], 0);
    const produced = machines.reduce((s, m) => s + m.byShift[shift], 0);
    const minutes = machines.reduce((s, m) => s + m.minutesByShift[shift], 0);
    const reworkQty = machines.reduce((s, m) => s + m.orders.filter((o) => o.shift === shift && o.rework).reduce((q, o) => q + o.quantity, 0), 0);
    return {
      shift,
      produced,
      target,
      percent: target ? Math.round((producedTarget / target) * 100) : 0,
      perMinute: perMinute(produced, minutes),
      opsDone: done.filter((op) => shiftAt(op.closedAt!) === shift).length,
      reworkRate: produced ? (reworkQty / produced) * 100 : 0,
      wins: [] as ShiftScore["wins"],
      competing: !OUT_OF_CONTEST.includes(shift),
    };
  }).filter((s) => s.produced > 0);

  // Quem vence cada categoria entre os turnos na disputa (empate: ninguém leva)
  const contest = scores.filter((s) => s.competing);
  if (contest.length >= 2)
    (Object.keys(CATEGORIES) as Array<keyof typeof CATEGORIES>).forEach((key) => {
      const better = CATEGORIES[key].higherIsBetter ? 1 : -1;
      const values = contest.map((s) => s[key] * better);
      const best = Math.max(...values);
      if (values.filter((v) => v === best).length === 1) contest[values.indexOf(best)].wins.push(key);
    });
  // Disputa primeiro (por atingimento); hora extra no fim
  return scores.sort((a, b) => Number(b.competing) - Number(a.competing) || b.percent - a.percent);
}

/* ---------- Ranking das máquinas (com variação desde a semana passada) ---------- */
// "Semana passada" = COMPARISON_CUTOFF (demonstração: sexta, 20/03; com o banco, uma semana antes do último dado)
const percentUntil = (m: Machine, cutoff: Date | null = null) => {
  const { produced, target } = progressUntil(m, cutoff);
  return target ? (produced / target) * 100 : 0;
};

export interface MachineRank {
  machine: Machine;
  position: number;
  /** posições ganhas (+) ou perdidas (−) desde a semana passada */
  move: number;
  percent: number;
  perMinute: number;
}

export function machineRanking(machines: Machine[]): MachineRank[] {
  const withTarget = machines.filter((m) => m.hasTarget);
  const cutoff = COMPARISON_CUTOFF;
  const before = [...withTarget].sort((a, b) => percentUntil(b, cutoff) - percentUntil(a, cutoff)).map((m) => m.id);
  return [...withTarget]
    .sort((a, b) => b.percent - a.percent)
    .map((m, i) => ({
      machine: m,
      position: i + 1,
      move: cutoff ? before.indexOf(m.id) - i : 0,
      percent: m.percent,
      perMinute: machinePerMinute(m),
    }));
}

/* ---------- Máquina a máquina ---------- */
export interface MachineMonth {
  machine: Machine;
  perMinute: number;
  opsDone: number;
  /** dias em que a produção bateu a meta diária */
  daysOnTarget: number;
  /** maior produção num dia */
  bestDay: { date: Date; value: number } | null;
  /** dias úteis seguidos (até hoje) batendo a meta */
  streak: number;
}

export function machineMonths(machines: Machine[], ops: WorkOrder[]): MachineMonth[] {
  return machines.map((m) => {
    const days = ELAPSED_DATES.map((d) => ({ date: d, value: m.daily.get(dayKey(d)) ?? 0 }));
    const best = days.reduce<MachineMonth["bestDay"]>((b, d) => (d.value > (b?.value ?? 0) ? d : b), null);
    let streak = 0;
    if (m.hasTarget) for (let i = days.length - 1; i >= 0 && days[i].value >= m.dailyTarget; i--) streak++;
    return {
      machine: m,
      perMinute: machinePerMinute(m),
      opsDone: ops.filter((op) => op.machineId === m.id && op.stage === "done").length,
      daysOnTarget: m.hasTarget ? days.filter((d) => d.value >= m.dailyTarget).length : 0,
      bestDay: best,
      streak,
    };
  });
}

/* ---------- Ritmo: OPs concluídas por dia, por turno ---------- */
export function opsPerDay(machines: Machine[], ops: WorkOrder[], lastDays = 15) {
  const ids = new Set(machines.map((m) => m.id));
  const done = ops.filter((op) => ids.has(op.machineId) && op.stage === "done" && op.closedAt);
  return ELAPSED_DATES.slice(-lastDays).map((date) => {
    const that = done.filter((op) => op.closedAt!.toDateString() === date.toDateString());
    return { date, byShift: SHIFTS.map((s) => that.filter((op) => shiftAt(op.closedAt!) === s).length) as [number, number, number] };
  });
}

/* ---------- Destaques ---------- */
export function highlights(machines: Machine[], months: MachineMonth[], scores: ShiftScore[]) {
  const ranked = machineRanking(machines);
  const climber = [...ranked].sort((a, b) => b.move - a.move)[0];
  const improved = machines
    .filter((m) => m.hasTarget)
    .map((m) => ({ m, gain: COMPARISON_CUTOFF ? percentUntil(m) - percentUntil(m, COMPARISON_CUTOFF) : 0 }))
    .filter((x) => x.gain > 0)
    .sort((a, b) => b.gain - a.gain)[0];
  const record = [...months].filter((x) => x.bestDay).sort((a, b) => b.bestDay!.value - a.bestDay!.value)[0];
  const streak = [...months].sort((a, b) => b.streak - a.streak)[0];
  const cleanest = scores.filter((s) => s.competing).sort((a, b) => a.reworkRate - b.reworkRate)[0];
  const fastest = [...months].sort((a, b) => b.perMinute - a.perMinute)[0];
  return { climber, improved, record, streak, cleanest, fastest };
}

