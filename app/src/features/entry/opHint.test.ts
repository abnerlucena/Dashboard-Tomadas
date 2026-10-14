import { describe, expect, it } from "vitest";
import type { WorkOrder } from "@/data/machines";
import { opHint, releasedFor } from "./opHint";

const op = (id: string, machineId: string, stage: WorkOrder["stage"]) => ({ id: `OP ${id}`, machineId, stage }) as WorkOrder;
const ops = [op("100", "11", "running"), op("200", "11", "paused"), op("300", "12", "running"), op("400", "11", "waiting")];
const name = (id: string) => (id === "12" ? "Horizontal nº 1" : "Composé");

describe("OPs liberadas no Apontamento", () => {
  it("só as em produção da máquina", () => {
    expect(releasedFor(ops, "11").map((o) => o.id)).toEqual(["OP 100"]);
  });

  it("avisa, sem barrar", () => {
    expect(opHint("100", "11", ops, name)).toBeNull();
    expect(opHint("", "11", ops, name)).toBeNull();
    expect(opHint("999", "11", ops, name)).toMatch(/a conferir/);
    expect(opHint("300", "11", ops, name)).toBe("Esta OP é da Horizontal nº 1");
    expect(opHint("200", "11", ops, name)).toBe("OP pausada");
    expect(opHint("400", "11", ops, name)).toBe("OP aguardando liberação");
  });
});
