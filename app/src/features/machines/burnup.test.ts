import { describe, expect, it } from "vitest";
import { DATA_END, MONTH_RANGE, TARGET_MACHINES, recordedTargetOn, type Machine, type ProductionOrder } from "@/data/machines";
import { burnupSeries, burnupSummary } from "./burnup";

const day = (d: number) => new Date(2026, 2, d);
const range = { from: day(2), to: day(6) }; // seg a sex, sem fim de semana

/** Máquina "do banco" mínima: as ordens e as metas dos turnos apontados */
function backendMachine(orders: Array<Partial<ProductionOrder> & { date: Date; quantity: number }>, targets: Array<{ date: Date; target: number }>): Machine {
  const base = TARGET_MACHINES[0];
  const full = orders.map((o, i) => ({ ...base.orders[0], id: `o${i}`, shift: 1 as const, rework: false, counts: true, ...o }));
  return {
    ...base,
    orders: full,
    dailyTarget: 1000,
    backend: { orders: full, targets: targets.map((t) => ({ ...t, shift: 1 as const })) },
    targetEntries: undefined,
  };
}

describe("burnupSeries", () => {
  it("demonstração: produção que conta e meta dos apontados andam juntas; o calendário cobre todos os dias", () => {
    const series = burnupSeries(TARGET_MACHINES, MONTH_RANGE);
    for (const p of series) {
      expect(p.elapsed).toBe(p.date <= DATA_END);
      if (!p.elapsed) expect(p.produced).toBeNull();
      else {
        expect(p.counted).toBe(p.produced); // na demonstração tudo conta
        expect(p.recordedTarget!).toBeLessThanOrEqual(p.calendarTarget + 1);
      }
    }
    expect(series.at(-1)!.calendarTarget).toBeGreaterThan(0);
  });

  it("produção que não conta (hora extra, dia anulado) fica fora do atingimento, mas na produção total", () => {
    const m = backendMachine(
      [
        { date: day(2), quantity: 800 },
        { date: day(3), quantity: 500, counts: false }, // hora extra: meta 0
        { date: day(3), quantity: 900 },
        { date: day(4), quantity: 300, rework: true }, // retrabalho nunca é produção
      ],
      [
        { date: day(2), target: 1000 },
        { date: day(3), target: 1000 },
      ],
    );
    expect(recordedTargetOn(m, day(3))).toBe(1000);
    const series = burnupSeries([m], range);
    const s = burnupSummary(series);
    expect(s).toMatchObject({ produced: 2200, counted: 1700, outside: 500, recordedTarget: 2000, attainment: 85 });
    expect(series[1].outsideDay).toBe(500);
    // calendário: 1000 por dia útil, 5 dias
    expect(s.calendarTotal).toBe(5000);
  });

  it("produção sem nenhum turno que conte: atingimento vazio, sem dividir por zero", () => {
    const m = backendMachine([{ date: day(2), quantity: 70674, counts: false }], []);
    const s = burnupSummary(burnupSeries([m], range));
    expect(s.attainment).toBeNull();
    expect(s.recordedTarget).toBe(0);
    expect(s.outside).toBe(70674);
  });
});
