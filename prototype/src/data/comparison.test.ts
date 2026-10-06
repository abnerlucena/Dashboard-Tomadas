import { describe, expect, it } from "vitest";
import { comparableMonthBefore, toIsoDate } from "./machines";

const range = (d: Date) => {
  const r = comparableMonthBefore(d);
  return [toIsoDate(r.from), toIsoDate(r.to), r.label];
};

describe("comparableMonthBefore", () => {
  it("mês em curso compara com o anterior até o mesmo dia", () => {
    expect(range(new Date(2026, 8, 21))).toEqual(["2026-08-01", "2026-08-21", "agosto até o dia 21"]);
  });

  it("mês fechado compara com o anterior inteiro", () => {
    expect(range(new Date(2026, 8, 30))).toEqual(["2026-08-01", "2026-08-31", "agosto"]);
  });

  it("dia que não existe no mês anterior vira o último dele", () => {
    expect(range(new Date(2026, 2, 30))).toEqual(["2026-02-01", "2026-02-28", "fevereiro até o dia 28"]);
  });
});
