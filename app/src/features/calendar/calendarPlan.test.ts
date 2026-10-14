import { describe, expect, it } from "vitest";
import { MAX_DAYS, planDays, shiftsLabel, toEntry, type CalendarEntry, type PlanInput } from "./calendarPlan";

const entry = (e: Partial<CalendarEntry>): CalendarEntry => ({
  id: "x",
  date: "2026-10-12",
  label: "Nossa Senhora Aparecida",
  type: "feriado",
  isEvent: false,
  shiftIds: [],
  createdBy: "",
  ...e,
});
const input = (p: Partial<PlanInput>): PlanInput => ({
  from: "2026-10-12",
  to: "",
  skipWeekends: true,
  type: "feriado",
  shiftIds: [],
  existing: [],
  ...p,
});

describe("planDays", () => {
  it("um dia só, mesmo num sábado", () => {
    expect(planDays(input({ from: "2026-10-10" })).add).toEqual(["2026-10-10"]);
  });

  it("intervalo pula o fim de semana quando pedido", () => {
    // 09/10 (sex) a 13/10 (ter)
    const plan = planDays(input({ from: "2026-10-09", to: "2026-10-13" }));
    expect(plan.add).toEqual(["2026-10-09", "2026-10-12", "2026-10-13"]);
    expect(plan.weekends).toBe(2);
    expect(planDays(input({ from: "2026-10-09", to: "2026-10-13", skipWeekends: false })).add).toHaveLength(5);
  });

  it("não repete o que já está cadastrado com o mesmo tipo", () => {
    const existing = [entry({ date: "2026-10-12" })];
    const plan = planDays(input({ from: "2026-10-12", to: "2026-10-13", existing }));
    expect(plan.add).toEqual(["2026-10-13"]);
    expect(plan.duplicates).toEqual(["2026-10-12"]);
    // Tipo diferente no mesmo dia é outro cadastro (D16: vários eventos por dia)
    expect(planDays(input({ type: "dia_anulado", existing })).add).toEqual(["2026-10-12"]);
  });

  it("dia inteiro cobre um turno; um turno não cobre o dia inteiro", () => {
    expect(planDays(input({ shiftIds: [2], existing: [entry({})] })).add).toEqual([]);
    const oneShift = [entry({ shiftIds: [2] })];
    expect(planDays(input({ existing: oneShift })).add).toEqual(["2026-10-12"]);
    expect(planDays(input({ shiftIds: [1, 2], existing: oneShift })).add).toEqual(["2026-10-12"]);
  });

  it("recusa intervalo invertido, longo demais ou sem dia útil", () => {
    expect(planDays(input({ from: "2026-10-13", to: "2026-10-12" })).error).toMatch(/antes/);
    expect(planDays(input({ from: "2026-01-01", to: "2026-12-31" })).error).toMatch(String(MAX_DAYS));
    expect(planDays(input({ from: "2026-10-10", to: "2026-10-11" })).error).toMatch(/Nenhum dia útil/);
    expect(planDays(input({ existing: [entry({})] })).error).toMatch(/já estão cadastrados/);
  });
});

describe("toEntry", () => {
  it("normaliza data da planilha e turnos", () => {
    const e = toEntry({ id: "7", date: "07/09/2026", label: " Independência ", type: "feriado", shiftIds: [3, 1] });
    expect(e).toMatchObject({ id: "7", date: "2026-09-07", label: "Independência", shiftIds: [1, 3], isEvent: false });
    expect(toEntry({ id: "8", date: "", label: "", type: "feriado" })).toBeNull();
  });
});

describe("shiftsLabel", () => {
  it("escreve os turnos por extenso", () => {
    expect(shiftsLabel([])).toBe("Dia inteiro");
    expect(shiftsLabel([2])).toBe("Turno 2");
    expect(shiftsLabel([1, 2, 3])).toBe("Turnos 1, 2 e 3");
  });
});
