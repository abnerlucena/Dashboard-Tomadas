import { describe, it, expect } from "vitest";
import { toUpdateEntryArgs } from "@/lib/repositories/supabase/adapters";

// production.updateEntry → update_production_record (D59).
// O que importa aqui é a diferença entre "não mexi" e "apaguei": ausente
// mantém o que está no banco; vazio apaga. Trocar uma pela outra faria a
// correção desfazer dado que ninguém pediu para desfazer.
describe("toUpdateEntryArgs", () => {
  it("só manda o que mudou: o resto fica como está no banco", () => {
    expect(toUpdateEntryArgs("r1", { date: "2026-10-08" })).toEqual({
      p_id: "r1",
      p_production_date: "2026-10-08",
    });
  });

  it("troca as OPs no formato do banco, com retrabalho", () => {
    const a = toUpdateEntryArgs("r1", {
      ordensProducao: [
        { ordemId: " 4600002 ", quantidade: 7500 },
        { ordemId: "4600003", quantidade: 300, retrabalho: true },
      ],
    });
    expect(a.p_orders).toEqual([
      { order_number: "4600002", quantity: 7500, is_rework: false, notes: null, rework_reason: null },
      { order_number: "4600003", quantity: 300, is_rework: true, notes: null, rework_reason: null },
    ]);
  });

  it("turno vai como número do turno", () => {
    expect(toUpdateEntryArgs("r1", { turno: "TURNO 3" }).p_shift_id).toBe(3);
  });

  it("hora extra vai como overtime", () => {
    expect(toUpdateEntryArgs("r1", { workMode: "overtime" }).p_work_mode).toBe("overtime");
  });

  it("nº de pessoas: 0 apaga (D52), ausente mantém", () => {
    expect(toUpdateEntryArgs("r1", { operatorCount: 0 }).p_operator_count).toBe(0);
    expect(toUpdateEntryArgs("r1", { operatorCount: 3 }).p_operator_count).toBe(3);
    expect("p_operator_count" in toUpdateEntryArgs("r1", { date: "2026-10-08" })).toBe(false);
  });

  it("observação: texto vazio apaga, ausente mantém", () => {
    expect(toUpdateEntryArgs("r1", { obs: "" }).p_notes).toBe("");
    expect("p_notes" in toUpdateEntryArgs("r1", { date: "2026-10-08" })).toBe(false);
  });

  // Pedido da interface (nota 2026-10-03-historico-e-updateentry): lista vazia
  // vale, e o apontamento fica sem peça — máquina parada —, como o saveEntries
  // só com observação. Ausente é que mantém as OPs.
  it("lista de OPs vazia tira todas, e é diferente de não mandar", () => {
    expect(toUpdateEntryArgs("r1", { ordensProducao: [] }).p_orders).toEqual([]);
    // Linhas com quantidade 0 não contam: sobrar só elas também é "nenhuma OP".
    expect(toUpdateEntryArgs("r1", { ordensProducao: [{ ordemId: "4600009", quantidade: 0 }] }).p_orders).toEqual([]);
    expect("p_orders" in toUpdateEntryArgs("r1", { obs: "x" })).toBe(false);
  });

  it("sem nada para mudar é engano de quem chamou", () => {
    expect(() => toUpdateEntryArgs("r1", {})).toThrow("Nada para corrigir.");
  });
});
