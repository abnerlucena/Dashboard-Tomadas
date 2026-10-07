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
