import { describe, expect, it } from "vitest";
import { DATA_END, TARGET_MACHINES, dayKey, plantSeries, recordedTargetOn, scopeMachine, type Machine } from "./machines";

describe("plantSeries: as duas metas acumuladas", () => {
  const series = plantSeries(TARGET_MACHINES);

  it("a meta dos turnos apontados só existe nos dias que já passaram", () => {
    for (const p of series) expect(p.recordedTargetCumulative == null).toBe(p.date > DATA_END);
  });

  it("nunca passa da meta do calendário (dia sem apontamento não soma meta)", () => {
    for (const p of series) if (p.recordedTargetCumulative != null) expect(p.recordedTargetCumulative).toBeLessThanOrEqual(p.targetCumulative + 1);
  });

  it("na demonstração, soma a meta diária só da máquina que apontou no dia", () => {
    const m = TARGET_MACHINES[0];
    const day = [...m.daily.keys()][0];
    const date = new Date(Math.floor(day / 10000), Math.floor(day / 100) % 100, day % 100);
    expect(recordedTargetOn(m, date)).toBe(m.dailyTarget);
    const empty: Machine = { ...m, daily: new Map() };
    expect(recordedTargetOn(empty, date)).toBe(0);
    expect(dayKey(date)).toBe(day);
  });

  it("com o banco, usa as metas gravadas no recorte de turno", () => {
    const date = new Date(2026, 2, 10);
    const base = TARGET_MACHINES[0];
    const m: Machine = {
      ...base,
      backend: {
        orders: [],
        targets: [
          { date, shift: 1, target: 4000 },
          { date, shift: 2, target: 3000 },
        ],
      },
    };
    expect(recordedTargetOn(m, date)).toBe(7000);
    expect(recordedTargetOn(scopeMachine(m, 2, { from: date, to: date }), date)).toBe(3000);
  });
});
