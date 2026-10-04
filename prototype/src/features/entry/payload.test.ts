import { describe, expect, it } from "vitest";
import { planSaves, type EntryContext, type FormEntry } from "./payload";

const machines = [
  { id: "11", name: "Composé" },
  { id: "12", name: "Horizontal nº 1" },
];
const ctx: EntryContext = { date: "2026-10-03", shift: 2, overtime: false, savedBy: "Ana" };
const entry = (e: Partial<FormEntry>): FormEntry => ({ rows: [], note: "", people: "", ...e });

describe("planSaves", () => {
  it("manda só as máquinas com algo a gravar, com as ordens novas", () => {
    const plan = planSaves(
      {
        "11": entry({
          rows: [
            { op: "4510001", qty: "6000", rework: false },
            { op: "4510002", qty: "300", rework: true },
            { op: "", qty: "", rework: false },
          ],
        }),
        "12": entry({}),
      },
      {},
      machines,
      ctx,
    );
    expect(plan).toHaveLength(1);
    expect(plan[0].payload).toMatchObject({
      date: "2026-10-03",
      turno: "TURNO 2",
      machineId: 11,
      producao: 6000,
      ordensProducao: [
        { ordemId: "4510001", quantidade: 6000 },
        { ordemId: "4510002", quantidade: 300, retrabalho: true },
      ],
      // apontamento novo: vazio manda 0 (não informado, D48)
      operatorCount: 0,
    });
  });

  it("apontamento novo só com observação vale (máquina parada); só com pessoas, não", () => {
    const plan = planSaves({ "11": entry({ note: "Máquina parada: falta de material" }), "12": entry({ people: "3" }) }, {}, machines, ctx);
    expect(plan.map((p) => p.machineId)).toEqual(["11"]);
    expect(plan[0].payload.obs).toBe("Máquina parada: falta de material");
    expect(plan[0].payload.ordensProducao).toEqual([]);
  });

  it("no apontamento que já existe, não manda o nº de pessoas que não mudou (o banco mantém)", () => {
    const existing = { "11": { id: "r1", operatorCount: 4, notes: "Setup" } };
    const plan = planSaves(
      { "11": entry({ rows: [{ op: "4510003", qty: "100", rework: false }], people: "4", note: "Setup" }) },
      existing,
      machines,
      ctx,
    );
    expect(plan[0].payload).not.toHaveProperty("operatorCount");
    // observação igual à gravada: manda vazia, que o banco lê como "manter"
    expect(plan[0].payload.obs).toBe("");
    expect(plan[0].clearNoteOf).toBeUndefined();
    expect(plan[0].needsSave).toBe(true);
  });

  it("apagar o nº de pessoas manda 0; mudar manda o número", () => {
    const existing = { "11": { id: "r1", operatorCount: 4, notes: "" }, "12": { id: "r2", operatorCount: null, notes: "" } };
    const plan = planSaves({ "11": entry({ people: "" }), "12": entry({ people: "2" }) }, existing, machines, ctx);
    expect(plan.map((p) => [p.machineId, p.payload.operatorCount])).toEqual([
      ["11", 0],
      ["12", 2],
    ]);
  });

  it("apagar a observação gravada vai por updateObs", () => {
    const plan = planSaves(
      { "11": entry({ note: "  " }) },
      { "11": { id: "r1", operatorCount: null, notes: "Troca de molde" } },
      machines,
      ctx,
    );
    expect(plan).toHaveLength(1);
    expect(plan[0].clearNoteOf).toBe("r1");
    // nada mais mudou: não precisa chamar o salvar, só apagar a observação
    expect(plan[0].needsSave).toBe(false);
  });
});
