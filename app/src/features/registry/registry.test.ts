import { describe, expect, it } from "vitest";
import { changesOf, draftOf, fromApi, nameKey, newDraft, toNewInput, validateDraft, type MachineDraft } from "./registry";

const api = [
  {
    id: 12,
    name: "Embaladora horizontal nº 1",
    hasMeta: true,
    defaultMeta: 9200,
    status: "ativo",
    standardOperatorCount: 4,
    process: "packaging" as const,
  },
  { id: 30, name: "Prensa antiga", hasMeta: false, defaultMeta: 0, status: "inativo" },
  { id: 11, name: "Máquina de tomadas Composé", hasMeta: true, defaultMeta: 11000, process: "assembly" as const },
];
const existing = fromApi(api, { 12: { updatedBy: "", updatedAt: "", vigenciaInicio: "", basis: "per_shift_prorated" } });
const draft = (d: Partial<MachineDraft>): MachineDraft => ({ ...newDraft(), name: "Bancada B", process: "packaging", meta: "0", ...d });

describe("fromApi", () => {
  it("traduz o contrato, com a linha, a base e ativas primeiro", () => {
    expect(existing.map((m) => m.id)).toEqual(["12", "11", "30"]);
    expect(existing[0]).toMatchObject({ line: "Embalagem", process: "packaging", basis: "per_shift_prorated", crew: 4, active: true });
    expect(existing[2]).toMatchObject({ process: null, active: false });
  });
});

describe("cadastrar", () => {
  it("aceita meta 0 (por demanda) e manda sem base", () => {
    expect(validateDraft(draft({}), existing).any).toBe(false);
    expect(toNewInput(draft({}))).toEqual({ name: "Bancada B", process: "packaging", defaultMeta: 0, hasMeta: false });
  });

  it("com meta, base e lotação", () => {
    const d = draft({ name: "  Horizontal  nº 3 ", meta: "8000", basis: "per_shift_prorated", crew: "3" });
    expect(toNewInput(d)).toEqual({
      name: "Horizontal nº 3",
      process: "packaging",
      defaultMeta: 8000,
      hasMeta: true,
      basis: "per_shift_prorated",
      standardOperatorCount: 3,
    });
  });

  it("linha obrigatória; conforme a lotação exige a lotação", () => {
    expect(validateDraft(draft({ process: "" }), existing).process).toBe("Escolha a linha");
    expect(validateDraft(draft({ meta: "8000", basis: "per_shift_prorated" }), existing).crew).toMatch(/lotação padrão/);
    expect(validateDraft(draft({ meta: "0", basis: "per_shift_prorated" }), existing).crew).toBeNull();
  });

  it("recusa nome repetido, ignorando acento, caixa e espaços", () => {
    expect(validateDraft(draft({ name: "  maquina de TOMADAS  compose " }), existing).name).toBe("Já existe: Máquina de tomadas Composé");
    expect(validateDraft(draft({ name: "Prensa Antiga" }), existing).name).toMatch(/inativa; reative/);
  });

  it("recusa vazio e número com ponto", () => {
    const e = validateDraft(draft({ name: " ", meta: "" }), existing);
    expect([e.name, e.meta]).toEqual(["Informe o nome da máquina", "Informe a meta por turno (0 se não tiver meta)"]);
    expect(validateDraft(draft({ meta: "9.200" }), existing).meta).toMatch(/inteiro/);
  });
});

describe("editar", () => {
  const horizontal = existing[0];
  it("o próprio nome não é repetido; manda só o que mudou", () => {
    const d = draftOf(horizontal);
    expect(validateDraft(d, existing, horizontal).any).toBe(false);
    expect(changesOf(d, horizontal)).toBeNull();
    expect(changesOf({ ...d, name: "Horizontal nº 1", crew: "5" }, horizontal)).toEqual({
      name: "Horizontal nº 1",
      standardOperatorCount: 5,
    });
  });

  it("a lotação não se apaga", () => {
    expect(validateDraft({ ...draftOf(horizontal), crew: "" }, existing, horizontal).crew).toMatch(/não se apaga/);
  });

  it("máquina antiga sem linha: a linha deduzida vai para o banco", () => {
    const prensa = existing[2];
    expect(changesOf(draftOf(prensa), prensa)).toEqual({ process: "assembly" });
  });
});

describe("nameKey", () => {
  it("normaliza para comparar", () => {
    expect(nameKey(" Horizontal  Nº1 ")).toBe(nameKey("horizontal nº1"));
  });
});
