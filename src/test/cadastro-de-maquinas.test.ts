import { describe, it, expect } from "vitest";
import { toCreateMachineArgs, toUpdateMachineArgs } from "@/lib/repositories/supabase/adapters";

// Cadastro completo de máquinas (D63): a linha é obrigatória, e "tem meta"
// ausente fica para o banco deduzir (meta 0 = por demanda, D38).
describe("toCreateMachineArgs", () => {
  it("leva nome, linha e meta; o resto só se vier", () => {
    expect(toCreateMachineArgs({ name: " Embaladora nova ", process: "packaging", defaultMeta: 5000 })).toEqual({
      p_name: "Embaladora nova",
      p_process: "packaging",
      p_initial_target: 5000,
    });
  });

  it("não decide 'tem meta' sozinho: o banco deduz da meta", () => {
    expect("p_has_target" in toCreateMachineArgs({ name: "X", process: "assembly", defaultMeta: 0 })).toBe(false);
  });

  it("leva lotação, base e 'tem meta' quando vierem", () => {
    expect(toCreateMachineArgs({
      name: "Horizontal 3", process: "packaging", defaultMeta: 10000,
      hasMeta: true, standardOperatorCount: 4, basis: "per_shift_prorated",
    })).toMatchObject({ p_has_target: true, p_standard_operator_count: 4, p_basis: "per_shift_prorated" });
  });

  it("nome vazio é recusado antes de ir ao banco", () => {
    expect(() => toCreateMachineArgs({ name: "  ", process: "assembly", defaultMeta: 0 }))
      .toThrow("O nome da máquina é obrigatório.");
  });
});

describe("toUpdateMachineArgs", () => {
  it("só manda o que mudou", () => {
    expect(toUpdateMachineArgs(7, { standardOperatorCount: 3 })).toEqual({ p_id: 7, p_standard_operator_count: 3 });
  });

  it("sem nada para mudar é engano de quem chamou", () => {
    expect(() => toUpdateMachineArgs(7, {})).toThrow("Nada para alterar.");
  });
});
