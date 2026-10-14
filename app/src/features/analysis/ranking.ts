import {
  COMPARISON_CUTOFF,
  DATA_END,
  MONTH_RANGE,
  TARGET_MACHINES,
  dayKey,
  progressUntil,
  scopeToShift,
  workingDatesIn,
  type Machine,
  type Shift,
} from "@/data/machines";
import { reworkRate } from "@/features/machines/insights";

export type Metric = "percent" | "produced" | "entries" | "rework";

export const METRICS: Record<Metric, { label: string; hint: string; higherIsBetter: boolean }> = {
  percent: { label: "Atingimento", hint: "Produção sobre a meta do mês", higherIsBetter: true },
  produced: { label: "Produção", hint: "Unidades produzidas no mês", higherIsBetter: true },
  entries: { label: "Apontamento", hint: "Dias com apontamento sobre dias úteis", higherIsBetter: true },
  rework: { label: "Retrabalho", hint: "Peças retrabalhadas sobre o total apontado — menor é melhor", higherIsBetter: false },
};

/** "Semana passada" = dados até COMPARISON_CUTOFF (demonstração: sexta, 20/03) */
export function rankingValue(m: Machine, metric: Metric, cutoff: Date | null = null) {
  const orders = cutoff ? m.orders.filter((o) => o.date <= cutoff) : m.orders;
  const { produced, target } = progressUntil(m, cutoff);
  // Dias úteis que já aconteceram (até o último dado ou até a semana passada), como a taxa do Dashboard
  const until = cutoff && cutoff < DATA_END ? cutoff : DATA_END;
  const workingDays = workingDatesIn({ from: MONTH_RANGE.from, to: until }).length;
  switch (metric) {
    case "percent":
      // na semana passada, compara contra a meta até ali
      return target ? (produced / target) * 100 : 0;
    case "produced":
      return produced;
    case "entries":
      // dias com produção (dia só com retrabalho não conta, como no Dashboard)
      return (new Set(orders.filter((o) => !o.rework).map((o) => dayKey(o.date))).size / Math.max(1, workingDays)) * 100;
    case "rework":
      return reworkRate(orders.reduce((s, o) => s + (o.rework ? o.quantity : 0), 0), produced);
  }
}

export interface Ranked {
  machine: Machine;
  value: number;
  position: number;
  /** posição na semana passada; null = sem base para comparar */
  previous: number | null;
}

/**
 * Máquinas com meta, no recorte do turno, da melhor para a pior no critério.
 * Como no Dashboard, máquina de 2 turnos não entra no recorte do Turno 3.
 */
export function rankMachines(metric: Metric, shift: Shift | "all"): Ranked[] {
  const meta = METRICS[metric];
  const scoped = TARGET_MACHINES.filter((m) => shift === "all" || shift <= m.regime).map((m) => scopeToShift(m, shift));
  const order = (cutoff: Date | null = null) =>
    [...scoped]
      .map((m) => ({ m, v: rankingValue(m, metric, cutoff) }))
      .sort((a, b) => (meta.higherIsBetter ? b.v - a.v : a.v - b.v))
      .map((x) => x.m.id);
  const now = order();
  const before = COMPARISON_CUTOFF ? order(COMPARISON_CUTOFF) : null;
  return now.map((id, i) => {
    const machine = scoped.find((m) => m.id === id)!;
    return { machine, value: rankingValue(machine, metric), position: i + 1, previous: before ? before.indexOf(id) + 1 : null };
  });
}
