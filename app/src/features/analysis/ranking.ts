import {
  COMPARISON_CUTOFF,
  DATA_END,
  MONTH_RANGE,
  TARGET_MACHINES,
  dayKey,
  isMonthRange,
  progressUntil,
  scopeMachine,
  workingDatesIn,
  type DateRange,
  type Machine,
  type Shift,
} from "@/data/machines";
import { reasonOf, reworkRate } from "@/features/machines/insights";

export type Metric = "percent" | "produced" | "entries" | "rework";

export const METRICS: Record<Metric, { label: string; hint: string; higherIsBetter: boolean }> = {
  percent: { label: "Atingimento", hint: "Produção sobre a meta do mês", higherIsBetter: true },
  produced: { label: "Produção", hint: "Unidades produzidas no mês", higherIsBetter: true },
  entries: { label: "Apontamento", hint: "Dias com apontamento sobre dias úteis", higherIsBetter: true },
  rework: { label: "Retrabalho", hint: "Peças retrabalhadas sobre o total apontado — menor é melhor", higherIsBetter: false },
};

/** Texto do critério: "do mês" no recorte padrão, "do período" quando o período foi mudado */
export const hintOf = (metric: Metric, monthly: boolean) => METRICS[metric].hint.replace("do mês", monthly ? "do mês" : "do período");

/**
 * "Semana passada" = dados até COMPARISON_CUTOFF (demonstração: sexta, 20/03).
 * `range` é o período do ranking (o mês, por padrão) e `reason`, o motivo de
 * retrabalho que a taxa de retrabalho deve contar (vazio = todos).
 */
export function rankingValue(m: Machine, metric: Metric, cutoff: Date | null = null, range: DateRange = MONTH_RANGE, reason = "all") {
  const orders = cutoff ? m.orders.filter((o) => o.date <= cutoff) : m.orders;
  const { produced, counted, target } = progressUntil(m, cutoff);
  // Dias úteis que já aconteceram (até o último dado ou até a semana passada), como a taxa do Dashboard
  const until = cutoff && cutoff < DATA_END ? cutoff : range.to < DATA_END ? range.to : DATA_END;
  const workingDays = workingDatesIn({ from: range.from, to: until }).length;
  switch (metric) {
    case "percent":
      // na semana passada, compara contra a meta até ali; só a produção que conta (fora hora extra, dia anulado)
      return target ? (counted / target) * 100 : 0;
    case "produced":
      return produced;
    case "entries":
      // dias com produção (dia só com retrabalho não conta, como no Dashboard)
      return (new Set(orders.filter((o) => !o.rework).map((o) => dayKey(o.date))).size / Math.max(1, workingDays)) * 100;
    case "rework":
      return reworkRate(orders.reduce((s, o) => s + (o.rework && (reason === "all" || reasonOf(o) === reason) ? o.quantity : 0), 0), produced);
  }
}

export interface Ranked {
  machine: Machine;
  value: number;
  position: number;
  /** posição na semana passada; null = sem base para comparar */
  previous: number | null;
}

export interface RankingOptions {
  /** período do ranking; o mês do último dado, por padrão */
  range?: DateRange;
  /** só estas máquinas entram; vazio ou ausente = todas as com meta */
  machineIds?: ReadonlySet<string>;
  /** motivo de retrabalho que a taxa conta (só vale no critério Retrabalho) */
  reason?: string;
}

/**
 * Máquinas com meta, no recorte do turno (e do período e das máquinas escolhidas),
 * da melhor para a pior no critério. Como no Dashboard, máquina de 2 turnos não
 * entra no recorte do Turno 3. A posição na semana passada só existe no período
 * padrão: em outro período não há com o que comparar.
 */
export function rankMachines(metric: Metric, shift: Shift | "all", opts: RankingOptions = {}): Ranked[] {
  const { range = MONTH_RANGE, machineIds, reason = "all" } = opts;
  const meta = METRICS[metric];
  const scoped = TARGET_MACHINES.filter((m) => (shift === "all" || shift <= m.regime) && (!machineIds || machineIds.has(m.id))).map((m) =>
    scopeMachine(m, shift, range),
  );
  const compare = isMonthRange(range) && COMPARISON_CUTOFF != null;
  const order = (cutoff: Date | null = null) =>
    [...scoped]
      .map((m) => ({ m, v: rankingValue(m, metric, cutoff, range, reason) }))
      .sort((a, b) => (meta.higherIsBetter ? b.v - a.v : a.v - b.v))
      .map((x) => x.m.id);
  const now = order();
  const before = compare ? order(COMPARISON_CUTOFF) : null;
  return now.map((id, i) => {
    const machine = scoped.find((m) => m.id === id)!;
    return { machine, value: rankingValue(machine, metric, null, range, reason), position: i + 1, previous: before ? before.indexOf(id) + 1 : null };
  });
}
