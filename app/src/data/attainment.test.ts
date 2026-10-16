import { describe, expect, it } from "vitest";
import { TARGET_MACHINES, aggregate, countedQuantity, progressUntil, scopeMachine, shiftTotals, type Machine, type ProductionOrder } from "./machines";

/** Máquina "do banco": 900 peças que contam e 500 de hora extra (meta 0) no turno 1, meta de 1.000 */
function withOvertime(): Machine {
  const base = TARGET_MACHINES[0];
  const date = new Date(2026, 2, 10);
  const o = (quantity: number, counts: boolean, rework = false): ProductionOrder => ({ ...base.orders[0], id: `x${quantity}${counts}`, date, shift: 1, quantity, rework, counts });
  const orders = [o(900, true), o(500, false), o(200, true, true)];
  return scopeMachine({ ...base, orders, backend: { orders, targets: [{ date, shift: 1, target: 1000 }] }, targetEntries: undefined }, "all", { from: date, to: date });
}

describe("atingimento só com a produção que conta (counts_toward_target)", () => {
  it("hora extra entra na produção, não no atingimento; retrabalho em nenhum dos dois", () => {
    const m = withOvertime();
    expect(m.produced).toBe(1400);
    expect(m.counted).toBe(900);
    expect(m.percent).toBe(90);
    expect(m.countedByShift[1]).toBe(900);
    expect(countedQuantity(m.orders)).toBe(900);
  });

  it("totais da tela, turnos e ranking seguem a mesma regra", () => {
    const m = withOvertime();
    expect(aggregate([m])).toMatchObject({ produced: 1400, counted: 900, target: 1000, percent: 90 });
    expect(shiftTotals([m])[0]).toMatchObject({ produced: 1400, counted: 900, target: 1000 });
    expect(progressUntil(m, new Date(2026, 2, 31))).toMatchObject({ produced: 1400, counted: 900 });
  });

  it("na demonstração tudo conta: nada muda", () => {
    for (const m of TARGET_MACHINES) expect(m.counted).toBe(m.produced);
  });
});
