import { REWORK_REASONS, SHIFTS, dayKey, type DateRange, type Machine, type ProductionOrder, type Shift, type WorkOrder } from "@/data/machines";

/*
 * Indicadores da aba Gráficos, calculados sobre o recorte atual (máquinas
 * filtradas, turno e período) e sobre o que se movimenta no sistema:
 * apontamentos (produção, minutos, retrabalho, observações) e OPs (conclusão
 * e tempo entre liberação e conclusão).
 */

const HOUR = 3600000;
const inRange = (d: Date, r: DateRange) => d >= r.from && d < new Date(r.to.getFullYear(), r.to.getMonth(), r.to.getDate() + 1);

/** Faixas do tempo de OP (liberação → conclusão) */
export const LEAD_BUCKETS = [
  { label: "até 1 dia", max: 24 },
  { label: "1 a 2 dias", max: 48 },
  { label: "2 a 4 dias", max: 96 },
  { label: "4 a 7 dias", max: 168 },
  { label: "mais de 7 dias", max: Infinity },
];

/** Limite de retrabalho usado no app (mesmo da aba Retrabalho) */
export const REWORK_LIMIT = 10;

/**
 * Taxa de retrabalho (%): peças apontadas como retrabalho sobre tudo o que foi
 * apontado (produção boa + retrabalho). É a conta de todas as telas e planilhas.
 */
export const reworkRate = (rework: number, good: number) => (rework + good ? (rework / (rework + good)) * 100 : 0);

/** Retrabalho apontado sem motivo: aparece com este nome, para a falta ficar visível */
export const NO_REASON = "Não informado";
/** Motivo de um apontamento de retrabalho ("Não informado" quando vazio) */
export const reasonOf = (o: Pick<ProductionOrder, "reworkReason">) => o.reworkReason?.trim() || NO_REASON;
/**
 * Motivos presentes nos apontamentos: os da lista padrão primeiro, depois os
 * que vierem do banco com outro texto, e "Não informado" por último.
 */
export function reworkReasonsOf(orders: ProductionOrder[]): string[] {
  const seen = new Set(orders.filter((o) => o.rework).map(reasonOf));
  const extra = [...seen].filter((r) => r !== NO_REASON && !REWORK_REASONS.includes(r)).sort((a, b) => a.localeCompare(b, "pt-BR"));
  return [...REWORK_REASONS.filter((r) => seen.has(r)), ...extra, ...(seen.has(NO_REASON) ? [NO_REASON] : [])];
}

/** Produção de apontamentos: só a boa, o retrabalho fica de fora (D11) */
const goodOf = (orders: ProductionOrder[]) => orders.reduce((s, o) => s + (o.rework ? 0 : o.quantity), 0);

export function insights(rows: Machine[], dates: Date[], range: DateRange, ops: WorkOrder[]) {
  const orders = rows.flatMap((m) => m.orders);
  // Produção = só a boa (D11), como o KPI Produção e os demais gráficos
  const produced = goodOf(orders);
  const minutes = orders.reduce((s, o) => s + o.minutes, 0);
  const reworkOrders = orders.filter((o) => o.rework);
  const reworkQty = reworkOrders.reduce((s, o) => s + o.quantity, 0);

  // Produção por dia, por turno
  const byDayShift = dates.map((date) => {
    const that = orders.filter((o) => dayKey(o.date) === dayKey(date));
    return { date, byShift: SHIFTS.map((s) => goodOf(that.filter((o) => o.shift === s))) as [number, number, number] };
  });

  // Peças por minuto de cada máquina no recorte
  const perMinute = rows
    .map((m) => {
      const mins = m.orders.reduce((s, o) => s + o.minutes, 0);
      return { machine: m, value: mins ? m.produced / mins : 0 };
    })
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);

  // OPs concluídas no período (das máquinas do recorte)
  const ids = new Set(rows.map((m) => m.id));
  const done = ops.filter((op) => ids.has(op.machineId) && op.stage === "done" && op.closedAt && inRange(op.closedAt, range));
  const leadHours = (op: WorkOrder) => (op.closedAt!.getTime() - op.releasedAt.getTime()) / HOUR;
  const opsByDay = dates.map((date) => {
    const that = done.filter((op) => dayKey(op.closedAt!) === dayKey(date));
    const avg = that.length ? that.reduce((s, op) => s + leadHours(op), 0) / that.length : null;
    return { date, count: that.length, avgDays: avg == null ? null : avg / 24 };
  });
  const leadBuckets = LEAD_BUCKETS.map((b, i) => ({
    label: b.label,
    count: done.filter((op) => {
      const h = leadHours(op);
      return h <= b.max && (i === 0 || h > LEAD_BUCKETS[i - 1].max);
    }).length,
  }));
  const avgLeadDays = done.length ? done.reduce((s, op) => s + leadHours(op), 0) / done.length / 24 : 0;
  const openNow = ops.filter((op) => ids.has(op.machineId) && op.stage !== "done");

  // Retrabalho por dia (peças e taxa) e motivos (Pareto)
  const reworkByDay = dates.map((date) => {
    const that = orders.filter((o) => dayKey(o.date) === dayKey(date));
    const rw = that.filter((o) => o.rework).reduce((s, o) => s + o.quantity, 0);
    return { date, qty: rw, rate: that.length ? reworkRate(rw, goodOf(that)) : null };
  });
  const reasons = reworkReasonsOf(reworkOrders).map((reason) => ({
    reason,
    count: reworkOrders.filter((o) => reasonOf(o) === reason).length,
  }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
  const totalReasons = reasons.reduce((s, r) => s + r.count, 0);
  let acc = 0;
  const pareto = reasons.map((r) => {
    acc += r.count;
    return { ...r, cumulative: totalReasons ? (acc / totalReasons) * 100 : 0 };
  });

  return {
    produced,
    perMinuteTotal: minutes ? produced / minutes : 0,
    reworkRate: reworkRate(reworkQty, produced),
    notes: orders.filter((o) => o.note).length,
    entries: orders.length,
    byDayShift,
    perMinute,
    opsDone: done.length,
    opsOpen: openNow.length,
    opsPaused: openNow.filter((op) => op.stage === "paused").length,
    avgLeadDays,
    opsByDay,
    leadBuckets,
    reworkByDay,
    pareto,
  };
}

export type Insights = ReturnType<typeof insights>;
export const SHIFT_NAMES: Record<Shift, string> = { 1: "Turno 1", 2: "Turno 2", 3: "Turno 3" };
