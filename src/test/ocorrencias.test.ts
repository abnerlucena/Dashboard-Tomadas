import { describe, it, expect } from "vitest";
import {
  toAbsence, toCollaborator, toCreateCollaboratorArgs, toHoraMinuto, toSaveAbsenceArgs,
  toSaveShortageArgs, toShortage, toUpdateCollaboratorArgs,
} from "@/lib/repositories/supabase/adapters";

// Ocorrências do turno (D70): o formato da tela ↔ o das funções do banco.
describe("ocorrências do turno: adaptadores", () => {
  it("colaborador: linha desconhecida vira nula", () => {
    expect(toCollaborator({
      id: "c1", name: "Ana Paula Ribeiro", badge_number: "12345", shift_id: 1, process: "assembly", active: true,
      created_at: "", created_by: null, updated_at: null, updated_by: null,
    })).toEqual({ id: "c1", name: "Ana Paula Ribeiro", badgeNumber: "12345", shiftId: 1, process: "assembly", active: true });
  });

  it("cadastrar: cadastro em branco não vai", () => {
    expect(toCreateCollaboratorArgs({ name: "Gabriel Martins", shiftId: 2, badgeNumber: "  " }))
      .toEqual({ p_name: "Gabriel Martins", p_shift_id: 2, p_badge_number: undefined, p_process: undefined });
  });

  it("editar: só o que veio; linha nula apaga, e nada para alterar é erro", () => {
    expect(toUpdateCollaboratorArgs("c1", { process: null })).toEqual({ p_id: "c1", p_process: "" });
    expect(toUpdateCollaboratorArgs("c1", { badgeNumber: "" })).toEqual({ p_id: "c1", p_badge_number: "" });
    expect(() => toUpdateCollaboratorArgs("c1", {})).toThrow("Nada para alterar.");
  });

  it("falta: o horário do banco perde os segundos; sem permissão, o nome vem nulo", () => {
    expect(toHoraMinuto("12:30:00")).toBe("12:30");
    expect(toAbsence({
      id: null, production_date: "2026-10-16", shift_id: 1, kind: "left_early", at_time: null, note: null,
      collaborator_id: null, collaborator_name: null, is_mine: false,
    })).toEqual({
      id: null, date: "2026-10-16", shiftId: 1, kind: "left_early", time: null, note: null,
      collaboratorId: null, collaboratorName: null, mine: false,
    });
  });

  it("registrar falta: \"faltou\" nunca leva horário, e observação em branco não vai", () => {
    const args = toSaveAbsenceArgs({ date: "2026-10-16", shiftId: 1, collaboratorId: "c1", kind: "absent", time: "07:00", note: "  " });
    expect(args.p_at_time).toBeUndefined();
    expect(args.p_note).toBeUndefined();
    expect(toSaveAbsenceArgs({ date: "2026-10-16", shiftId: 1, collaboratorId: "c1", kind: "late", time: "06:40" }).p_at_time).toBe("06:40");
  });

  it("material: máquinas sem repetir, e \"mine\" pela pessoa da sessão", () => {
    expect(toSaveShortageArgs({ date: "2026-10-16", shiftId: 2, materialCode: " 19189479 ", materialDescription: "FILME", machineIds: [3, 3, 5] }))
      .toMatchObject({ p_material_code: "19189479", p_machine_ids: [3, 5] });
    const row = {
      id: "s1", production_date: "2026-10-16", shift_id: 2, material_code: "19189479", material_description: "FILME",
      note: null, machine_ids: [3], created_by: "u1", created_at: "",
    };
    expect(toShortage(row, "u1").mine).toBe(true);
    expect(toShortage(row, "u2").mine).toBe(false);
  });
});
