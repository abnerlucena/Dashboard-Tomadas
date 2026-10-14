import { describe, expect, it } from "vitest";
import { ELAPSED_DATES, TARGET_MACHINES, scopeToShift } from "@/data/machines";
import { reworkRate } from "@/features/machines/insights";
import { rankMachines, rankingValue } from "./ranking";

const machine = (id: string) => TARGET_MACHINES.find((m) => m.id === id)!;

describe("Ranking de máquinas", () => {
  it("apontamento: dias com produção sobre os dias úteis já transcorridos, como no Dashboard", () => {
    // Máquina de tomadas Composé (Aumaq): 20 dias com apontamento em 20 dias úteis até 27/03
    const m = machine("m4");
    expect(rankingValue(m, "entries")).toBe((m.days / ELAPSED_DATES.length) * 100);
    expect(rankingValue(m, "entries")).toBe(100);
  });

  it("retrabalho: a mesma conta da tela Retrabalho", () => {
    const m = machine("m1");
    const rw = m.orders.reduce((s, o) => s + (o.rework ? o.quantity : 0), 0);
    expect(rankingValue(m, "rework")).toBeCloseTo(reworkRate(rw, m.produced), 10);
  });

  it("um turno só tem as máquinas que trabalham nele (Turno 3: as de 3 turnos)", () => {
    const t3 = rankMachines("percent", 3);
    expect(t3.map((r) => r.machine.id).sort()).toEqual(TARGET_MACHINES.filter((m) => m.regime === 3).map((m) => m.id).sort());
    expect(t3.every((r) => scopeToShift(r.machine, 3).target > 0)).toBe(true);
  });
});
