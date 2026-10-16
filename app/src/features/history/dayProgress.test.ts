import { describe, expect, it } from "vitest";
import { ALL_ORDERS, MACHINES, machineById, targetOn, toIsoDate } from "@/data/machines";
import { dayProgress } from "./dayProgress";

describe("Histórico: % da meta do dia", () => {
  const day = new Date(2026, 2, 27);
  const orders = ALL_ORDERS.filter((o) => toIsoDate(o.date) === toIsoDate(day));
  const p = dayProgress(orders, targetOn(MACHINES, day), (id) => machineById(id).hasTarget);

  it("compara só a produção das máquinas com meta com a meta delas", () => {
    // 27/03: 176.852 peças boas nas máquinas com meta, meta do dia 226.600
    expect(p.percent).toBe(Math.round((176852 / 226600) * 100));
  });

  it("o total de unidades do dia continua com todas as máquinas", () => {
    expect(p.total).toBe(orders.reduce((s, o) => s + (o.rework ? 0 : o.quantity), 0));
  });
});

describe("Histórico: meta do dia por turno", () => {
  const day = new Date(2026, 2, 27);

  it("as metas dos turnos somam a meta do dia", () => {
    const parts = ([1, 2, 3] as const).reduce((s, sh) => s + targetOn(MACHINES, day, sh), 0);
    // cada máquina arredonda a sua parte por turno: a soma pode diferir de poucas peças
    expect(Math.abs(parts - targetOn(MACHINES, day))).toBeLessThanOrEqual(MACHINES.length);
  });

  it("um turno tem meta menor que o dia todo", () => {
    expect(targetOn(MACHINES, day, 1)).toBeGreaterThan(0);
    expect(targetOn(MACHINES, day, 1)).toBeLessThan(targetOn(MACHINES, day));
  });

  it("o % do turno usa só a produção e a meta do turno", () => {
    const first = ALL_ORDERS.filter((o) => toIsoDate(o.date) === toIsoDate(day) && o.shift === 1);
    const p = dayProgress(first, targetOn(MACHINES, day, 1), (id) => machineById(id).hasTarget);
    expect(p.total).toBe(first.reduce((s, o) => s + (o.rework ? 0 : o.quantity), 0));
    expect(p.percent).not.toBeNull();
  });
});
