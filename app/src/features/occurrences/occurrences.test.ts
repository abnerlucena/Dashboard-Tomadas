import { describe, expect, it } from "vitest";
import {
  monthCounts,
  searchCollaborators,
  searchMaterials,
  sheetLines,
  tidyName,
  uniqueMaterials,
  validateCollaborator,
  type Absence,
  type Collaborator,
  type MaterialShortage,
} from "./occurrences";

const people: Collaborator[] = [
  { id: "c1", name: "Gabriel Martins", badge: "40211", shift: 1, process: "assembly", active: true },
  { id: "c2", name: "Ana Paula Ribeiro", badge: "40378", shift: 1, process: "packaging", active: true },
  { id: "c3", name: "Ângela Souza", badge: null, shift: 2, process: null, active: true },
  { id: "c4", name: "Luciana Prado", badge: "39987", shift: 1, process: null, active: false },
];

describe("tidyName", () => {
  it("arruma espaços e maiúsculas, com as preposições em minúsculo", () => {
    expect(tidyName("  joão   DA silva ")).toBe("João da Silva");
    expect(tidyName("ana paula dos santos")).toBe("Ana Paula dos Santos");
  });
});

describe("validateCollaborator", () => {
  const draft = { name: "Carla Mendes", badge: "", shift: 1 as const, process: null };
  it("aceita nome e sobrenome novos", () => {
    expect(validateCollaborator(draft, people)).toBeNull();
  });
  it("pede sobrenome", () => {
    expect(validateCollaborator({ ...draft, name: "Carla" }, people)?.name).toMatch(/sobrenome/);
  });
  it("recusa nome repetido, sem ligar para acento e maiúsculas, mas não a própria pessoa ao editar", () => {
    expect(validateCollaborator({ ...draft, name: "angela souza" }, people)?.name).toMatch(/Já existe/);
    expect(validateCollaborator({ ...draft, name: "Ângela Souza" }, people, "c3")).toBeNull();
  });
  it("cadastro só com números e sem repetir", () => {
    expect(validateCollaborator({ ...draft, badge: "40a" }, people)?.badge).toMatch(/só números/);
    expect(validateCollaborator({ ...draft, badge: "40211" }, people)?.badge).toMatch(/outra pessoa/);
  });
});

describe("searchCollaborators", () => {
  it("sem busca, só os ativos do turno; com 'outros turnos', todos os ativos, o turno primeiro", () => {
    expect(searchCollaborators(people, "", 1).map((c) => c.id)).toEqual(["c2", "c1"]);
    expect(searchCollaborators(people, "", 1, { allShifts: true }).map((c) => c.id)).toEqual(["c2", "c1", "c3"]);
  });
  it("com busca, acha em qualquer turno, sem acento, e pelo cadastro", () => {
    expect(searchCollaborators(people, "angela", 1).map((c) => c.id)).toEqual(["c3"]);
    expect(searchCollaborators(people, "40378", 3).map((c) => c.id)).toEqual(["c2"]);
  });
  it("não traz inativos nem quem já está no turno", () => {
    expect(searchCollaborators(people, "luciana", 1)).toEqual([]);
    expect(searchCollaborators(people, "", 1, { exclude: new Set(["c1"]) }).map((c) => c.id)).toEqual(["c2"]);
  });
});

describe("materiais", () => {
  const catalog = uniqueMaterials([
    { code: "19189479", description: "FILME PET+PE 0,5X270mm REF CONCEPT ITJ" },
    { code: "10045821", description: "CAIXA PAPELÃO ONDULADO" },
    { code: "19189479", description: "repetido" },
  ]);
  it("o catálogo não repete código", () => {
    expect(catalog).toHaveLength(2);
  });
  it("busca por código ou por parte da descrição, sem acento", () => {
    expect(searchMaterials(catalog, "1918").map((m) => m.code)).toEqual(["19189479"]);
    expect(searchMaterials(catalog, "papelao").map((m) => m.code)).toEqual(["10045821"]);
    expect(searchMaterials(catalog, "")).toEqual([]);
  });
});

describe("sheetLines", () => {
  it("monta o bloco como na planilha", () => {
    const shortages: MaterialShortage[] = [
      { id: "s1", date: "2026-03-27", shift: 1, materialCode: "19189479", materialDescription: "FILME PET+PE 0,5X270mm REF CONCEPT ITJ", machineIds: [], note: null, mine: false },
    ];
    const absences: Absence[] = [
      { id: "a1", date: "2026-03-27", shift: 1, collaboratorId: "c1", name: "Gabriel Martins", kind: "left_early", time: "14:30", note: null, mine: false },
      { id: "a2", date: "2026-03-27", shift: 1, collaboratorId: "c2", name: "Ana Paula Ribeiro", kind: "absent", time: null, note: "Atestado", mine: false },
    ];
    expect(sheetLines(shortages, absences)).toEqual({
      materials: ["19189479 - FILME PET+PE 0,5X270mm REF CONCEPT ITJ"],
      people: ["01 Colaborador saiu mais cedo às 14:30 – Gabriel Martins", "01 Colaborador faltou – Ana Paula Ribeiro"],
    });
  });
});

describe("monthCounts", () => {
  it("separa faltas de saídas e atrasos, só no mês pedido", () => {
    const a = (id: string, date: string, kind: Absence["kind"]): Absence => ({ id, date, shift: 1, collaboratorId: "c1", name: "Gabriel Martins", kind, time: null, note: null, mine: false });
    // a que perdeu o nome (colaborador inativado) não conta para ninguém
    const lost: Absence = { ...a("5", "2026-03-12", "absent"), collaboratorId: null, name: null };
    const counts = monthCounts([a("1", "2026-03-02", "absent"), a("2", "2026-03-10", "late"), a("3", "2026-03-11", "left_early"), a("4", "2026-02-27", "absent"), lost], "2026-03");
    expect(counts.get("c1")).toEqual({ absent: 1, other: 2 });
  });
});
