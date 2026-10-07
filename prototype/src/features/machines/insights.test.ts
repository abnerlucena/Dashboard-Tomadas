import { describe, expect, it } from "vitest";
import { DATA_END, MONTH_RANGE, TARGET_MACHINES, plantSeries, workingDatesIn } from "@/data/machines";
import { shiftScores } from "@/features/tv/tvMetrics";
import { insights, reworkRate } from "./insights";

const dates = workingDatesIn(MONTH_RANGE).filter((d) => d <= DATA_END);
const data = insights(TARGET_MACHINES, dates, MONTH_RANGE, []);
const good = TARGET_MACHINES.reduce((s, m) => s + m.produced, 0);
const reworkOf = (pred: (o: (typeof TARGET_MACHINES)[number]["orders"][number]) => boolean = () => true) =>
  TARGET_MACHINES.flatMap((m) => m.orders).reduce((s, o) => s + (o.rework && pred(o) ? o.quantity : 0), 0);

describe("reworkRate", () => {
  it("é o retrabalho sobre tudo o que foi apontado (boa + retrabalho)", () => {
    expect(reworkRate(10, 90)).toBe(10);
    expect(reworkRate(0, 0)).toBe(0);
  });
});

describe("insights (aba Gráficos)", () => {
  it("produção é só a boa, como no KPI Produção do Dashboard (D11)", () => {
    expect(data.produced).toBe(good);
  });

  it("produção por turno soma o mesmo que a produção diária, dia a dia", () => {
    const daily = plantSeries(TARGET_MACHINES, MONTH_RANGE).filter((p) => p.value != null);
    for (const d of data.byDayShift) {
      const same = daily.find((p) => p.date.getTime() === d.date.getTime());
      expect(d.byShift[0] + d.byShift[1] + d.byShift[2]).toBe(same?.value ?? 0);
    }
  });

  it("ritmo geral e por máquina usam a mesma conta (produção boa por minuto)", () => {
    const minutes = TARGET_MACHINES.flatMap((m) => m.orders).reduce((s, o) => s + o.minutes, 0);
    expect(data.perMinuteTotal).toBeCloseTo(good / minutes, 10);
  });

  it("taxa de retrabalho é a mesma da tela Retrabalho", () => {
    expect(data.reworkRate).toBeCloseTo(reworkRate(reworkOf(), good), 10);
  });
});

describe("Modo TV", () => {
  it("retrabalho do placar usa a mesma conta das outras telas", () => {
    for (const s of shiftScores(TARGET_MACHINES, [])) {
      expect(s.reworkRate).toBeCloseTo(reworkRate(reworkOf((o) => o.shift === s.shift), s.produced), 10);
    }
  });
});
