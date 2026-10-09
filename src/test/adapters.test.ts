import { describe, it, expect } from "vitest";
import {
  buildProdRecords, shiftIdFromTurno, toOrdersJson, toMachine, toHoliday, holidayTypeToEventType, toUpdateEntryArgs,
  type SummaryRow, type OrderRow,
} from "@/lib/repositories/supabase/adapters";

const baseRow: SummaryRow = {
  id: "r1", production_date: "2026-09-19", shift_id: 1, shift_name: "TURNO 1",
  machine_id: 1, machine_name: "HORIZONTAL 1", target_quantity: 500, operator_count: 2,
  work_mode: "regular", notes: "obs", created_by: "u1", updated_by: null,
  created_at: "2026-09-19T12:00:00Z", updated_at: "2026-09-19T12:00:00Z",
  good_quantity: 400, rework_quantity: 100, total_quantity: 500, order_count: 2,
  staffing_ratio: 1, adjusted_target: 500, is_excluded_day: false, counts_toward_target: true,
  effective_target: 500, target_basis: "per_shift", stop_reason: null, stop_planned: false,
};
const orders: OrderRow[] = [
  { production_record_id: "r1", order_number: "000001004521", quantity: 400, is_rework: false, notes: null, rework_reason: null },
  { production_record_id: "r1", order_number: "000001004522", quantity: 100, is_rework: true, notes: "refeito", rework_reason: "Rebarba na peça" },
];
const names = new Map([["u1", "Operador Um"]]);

describe("adaptadores Supabase → formato das telas", () => {
  it("usa a produção BOA como producao (retrabalho não é produção nova — D11)", () => {
    const [r] = buildProdRecords([baseRow], orders, names);
    expect(r.producao).toBe(400);
    expect(r.meta).toBe(500);
    expect(r.turno).toBe("TURNO 1");
    expect(r.savedBy).toBe("Operador Um");
    expect(r.ordensProducao).toEqual([
      { ordemId: "000001004521", quantidade: 400 },
      { ordemId: "000001004522", quantidade: 100, obs: "refeito", retrabalho: true, motivoRetrabalho: "Rebarba na peça" },
    ]);
  });

  it("lê a parada: motivo e se é planejada; sem parada, os campos não aparecem (D67)", () => {
    const [parada, normal] = buildProdRecords([
      { ...baseRow, id: "r4", stop_reason: "Manutenção", stop_planned: true, counts_toward_target: false },
      { ...baseRow, id: "r5" },
    ], [], names);
    expect(parada.motivoParada).toBe("Manutenção");
    expect(parada.paradaPlanejada).toBe(true);
    expect(parada.meta).toBe(0);
    expect(normal).not.toHaveProperty("motivoParada");
  });

  it("corrigir a parada: motivo vazio tira, e a marcação vai sozinha (D67)", () => {
    expect(toUpdateEntryArgs("r1", { motivoParada: "" })).toEqual({ p_id: "r1", p_stop_reason: "" });
    expect(toUpdateEntryArgs("r1", { paradaPlanejada: false })).toEqual({ p_id: "r1", p_stop_planned: false });
  });

  it("zera a meta da hora extra e do dia anulado, sem perder a produção (D27, D16)", () => {
    const [extra, anulado] = buildProdRecords([
      { ...baseRow, id: "r2", work_mode: "overtime", counts_toward_target: false },
      { ...baseRow, id: "r3", is_excluded_day: true, counts_toward_target: false },
    ], [], names);
    expect(extra.meta).toBe(0);
    expect(extra.producao).toBe(400);
    expect(extra.workMode).toBe("overtime");
    expect(extra.targetQuantity).toBe(500);
    expect(anulado.meta).toBe(0);
    expect(anulado.isExcludedDay).toBe(true);
  });

  it("meta por operador: usa a meta efetiva do turno, não a de cada pessoa (D39, D46)", () => {
    // A Granél: 25.000 por pessoa, três pessoas na bancada. A view entrega a
    // conta feita em effective_target; produção de 60.000 é 80% de 75.000 —
    // antes daqui era comparada com 25.000 e dava 240%.
    const [r] = buildProdRecords([{
      ...baseRow, id: "r4", machine_id: 7, machine_name: "BANCADA EMBALAGEM A GRANÉL",
      target_quantity: 25000, target_basis: "per_operator", operator_count: 3,
      effective_target: 75000, good_quantity: 60000, rework_quantity: 0, total_quantity: 60000,
    }], [], names);
    expect(r.meta).toBe(75000);
    expect(r.targetQuantity).toBe(75000);
    expect(r.operatorCount).toBe(3);
  });

  it("meta rateada pela lotação: horizontal com 3 das 4 pessoas (D47)", () => {
    // A conta é do banco (effective_target); aqui se garante que o adaptador
    // usa esse número e não o cadastrado.
    const [r] = buildProdRecords([{
      ...baseRow, id: "r6", machine_name: "EMBALADORA HORIZONTAL N°1",
      target_quantity: 10000, target_basis: "per_shift_prorated", operator_count: 3,
      effective_target: 7500, good_quantity: 7000, rework_quantity: 0, total_quantity: 7000,
    }], [], names);
    expect(r.meta).toBe(7500);
  });

  it("banco sem a migration 0021: cai na meta crua, como era antes", () => {
    // effective_target nulo = coluna que ainda não existe naquele banco.
    const [r] = buildProdRecords([{ ...baseRow, id: "r5", effective_target: null }], [], names);
    expect(r.meta).toBe(500);
  });

  it("converte turno em id e recusa texto inválido", () => {
    expect(shiftIdFromTurno("TURNO 3")).toBe(3);
    expect(() => shiftIdFromTurno("NOITE")).toThrow();
  });

  it("monta as ordens para a RPC ignorando quantidade zero e preservando zeros à esquerda", () => {
    expect(toOrdersJson([
      { ordemId: "000123", quantidade: 10, retrabalho: true },
      { ordemId: "", quantidade: 0 },
    ])).toEqual([{ order_number: "000123", quantity: 10, is_rework: true, notes: null, rework_reason: null }]);
  });

  it("manda o motivo do retrabalho sem espaços nas pontas, e só quando é retrabalho (D66)", () => {
    const json = toOrdersJson([
      { ordemId: "1", quantidade: 5, retrabalho: true, motivoRetrabalho: "  Cor fora do padrão " },
      { ordemId: "2", quantidade: 5, retrabalho: true, motivoRetrabalho: "   " },
      { ordemId: "3", quantidade: 5, motivoRetrabalho: "Não devia ir" },
    ]);
    expect(json.map(o => o.rework_reason)).toEqual(["Cor fora do padrão", null, null]);
  });

  it("traduz status de máquina e tipo de evento para os valores do legado", () => {
    expect(toMachine({ id: 1, name: "X", has_target: true, status: "inactive" }, 300))
      .toEqual({ id: 1, name: "X", hasMeta: true, defaultMeta: 300, status: "inativo", standardOperatorCount: null });
    // A lotação padrão é o divisor da meta rateada (D47): quando o banco a
    // conhece, ela precisa chegar à tela.
    expect(toMachine({ id: 2, name: "HORIZONTAL", has_target: true, status: "active", standard_operator_count: 4 }, 10000))
      .toMatchObject({ standardOperatorCount: 4 });
    // A linha da máquina vem do banco. A interface adivinhava pelo nome, e
    // um centro renomeado mudaria de linha sem ninguém pedir.
    expect(toMachine({ id: 3, name: "PRENSA TOX", has_target: false, status: "active", process: "assembly" }, 0))
      .toMatchObject({ process: "assembly" });
    expect(toMachine({ id: 4, name: "A GRANEL", has_target: true, status: "active", process: "packaging" }, 25000))
      .toMatchObject({ process: "packaging" });
    // Sem a coluna na consulta, o campo fica ausente, e não um valor inventado.
    expect(toMachine({ id: 5, name: "X", has_target: true, status: "active" }, 0).process).toBeUndefined();
    expect(holidayTypeToEventType("dia_anulado")).toBe("excluded_day");
    const h = toHoliday({
      id: "e1", event_date: "2026-12-25", description: "Natal", event_type: "holiday",
      created_by: null, created_at: "2026-09-20T00:00:00Z", calendar_event_shifts: [{ shift_id: 2 }],
    }, names);
    expect(h).toMatchObject({ date: "2026-12-25", label: "Natal", type: "feriado", shiftIds: [2] });
  });
});
