import { describe, expect, it } from "vitest";
import { ELAPSED_DATES, MONTH_RANGE, TARGET_MACHINES, scopeToShift } from "@/data/machines";
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

  it("só as máquinas escolhidas entram, com posições de 1 a N", () => {
    const ids = new Set(TARGET_MACHINES.slice(0, 3).map((m) => m.id));
    const r = rankMachines("produced", "all", { machineIds: ids });
    expect(r.map((x) => x.machine.id).sort()).toEqual([...ids].sort());
    expect(r.map((x) => x.position)).toEqual([1, 2, 3]);
    expect(rankMachines("produced", "all", { machineIds: new Set() })).toEqual([]);
  });

  it("outro período recalcula a produção e não tem posição da semana passada", () => {
    const month = rankMachines("produced", "all");
    const firstWeek = { from: new Date(MONTH_RANGE.from), to: new Date(MONTH_RANGE.from.getFullYear(), MONTH_RANGE.from.getMonth(), 7) };
    const week = rankMachines("produced", "all", { range: firstWeek });
    const total = (rows: typeof month) => rows.reduce((s, x) => s + x.value, 0);
    expect(total(week)).toBeLessThan(total(month));
    expect(week.every((x) => x.previous === null)).toBe(true);
    // no período padrão a comparação continua
    expect(month.every((x) => x.previous !== null)).toBe(true);
  });

  it("o motivo só muda a taxa de retrabalho", () => {
    const all = rankMachines("rework", "all");
    const none = rankMachines("rework", "all", { reason: "Motivo que ninguém usou" });
    expect(none.every((x) => x.value === 0)).toBe(true);
    expect(all.some((x) => x.value > 0)).toBe(true);
    expect(rankMachines("produced", "all", { reason: "Motivo que ninguém usou" }).map((x) => x.value)).toEqual(
      rankMachines("produced", "all").map((x) => x.value),
    );
  });
});

