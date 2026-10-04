import { describe, expect, it } from "vitest";
import { fromApi, nameKey, validateNew } from "./registry";

const api = [
  { id: 12, name: "Embaladora horizontal nº 1", hasMeta: true, defaultMeta: 9200, status: "ativo", standardOperatorCount: 4 },
  { id: 30, name: "Prensa antiga", hasMeta: false, defaultMeta: 0, status: "inativo" },
  { id: 11, name: "Máquina de tomadas Composé", hasMeta: true, defaultMeta: 11000 },
];

describe("fromApi", () => {
  it("traduz o contrato, com a base da meta e ativas primeiro", () => {
    const list = fromApi(api, { 12: { updatedBy: "", updatedAt: "", vigenciaInicio: "", basis: "per_shift_prorated" } });
    expect(list.map((m) => m.id)).toEqual(["12", "11", "30"]);
    expect(list[0]).toMatchObject({ line: "Embalagem", basis: "per_shift_prorated", crew: 4, active: true, metaPerShift: 9200 });
    expect(list[1]).toMatchObject({ line: "Montagem", basis: "per_shift", crew: null, active: true });
    expect(list[2].active).toBe(false);
  });
});

describe("validateNew", () => {
  const existing = fromApi(api, {});
  it("aceita nome novo e meta inteira, inclusive 0", () => {
    expect(validateNew("Bancada B", "0", existing)).toEqual({ name: null, meta: null });
  });
  it("recusa nome repetido, ignorando acento, caixa e espaços", () => {
    expect(validateNew("  maquina de TOMADAS  compose ", "100", existing).name).toBe("Já existe: Máquina de tomadas Composé");
    expect(validateNew("Prensa Antiga", "100", existing).name).toMatch(/inativa; reative/);
  });
  it("recusa vazio e número com ponto", () => {
    expect(validateNew(" ", "", existing)).toEqual({
      name: "Informe o nome da máquina",
      meta: "Informe a meta por turno (0 se não tiver meta)",
    });
    expect(validateNew("X", "9.200", existing).meta).toMatch(/inteiro/);
  });
});

describe("nameKey", () => {
  it("normaliza para comparar", () => {
    expect(nameKey(" Horizontal  Nº1 ")).toBe(nameKey("horizontal nº1"));
  });
});
