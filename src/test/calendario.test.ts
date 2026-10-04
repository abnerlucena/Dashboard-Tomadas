import { describe, it, expect } from "vitest";
import { toAddCalendarArgs, toHoliday } from "@/lib/repositories/supabase/adapters";

// Calendário em intervalo e com abrangência (D61). Pedido da tela de
// Calendário: férias coletivas numa operação só, e feriado de SC e de Itajaí
// separado do que é da empresa.
describe("toAddCalendarArgs", () => {
  it("monta o intervalo com o tipo do banco e abrangência da empresa por padrão", () => {
    expect(toAddCalendarArgs(["2026-12-21", "2026-12-22"], "Férias coletivas", "dia_anulado")).toEqual({
      p_dates: ["2026-12-21", "2026-12-22"],
      p_description: "Férias coletivas",
      p_event_type: "excluded_day",
      p_scope: "company",
    });
  });

  it("leva a abrangência e os turnos quando vierem", () => {
    const a = toAddCalendarArgs(["2026-06-15"], "Aniversário de Itajaí", "feriado", { scope: "municipal", shiftIds: [1, 2] });
    expect(a).toMatchObject({ p_event_type: "holiday", p_scope: "municipal", p_shift_ids: [1, 2] });
  });

  it("turnos vazios = o dia inteiro, e o campo nem vai", () => {
    expect("p_shift_ids" in toAddCalendarArgs(["2026-06-15"], "X", "feriado", { shiftIds: [] })).toBe(false);
  });

  it("lista vazia é engano de quem chamou", () => {
    expect(() => toAddCalendarArgs([], "X", "feriado")).toThrow("Informe ao menos um dia.");
  });
});

describe("toHoliday com abrangência", () => {
  const base = {
    id: "e1", event_date: "2026-08-11", description: "Dia de Santa Catarina", event_type: "holiday",
    created_by: null, created_at: "2026-10-04T00:00:00Z", calendar_event_shifts: [],
  };
  it("a abrangência chega à tela", () => {
    expect(toHoliday({ ...base, scope: "state" }, new Map()).scope).toBe("state");
  });
  it("sem a coluna na consulta, o campo fica ausente", () => {
    expect(toHoliday(base, new Map()).scope).toBeUndefined();
  });
});
