import { describe, expect, it } from "vitest";
import type { Machine, ProductionOrder } from "@/data/machines";
import { csvName, machinesCsv, ordersCsv } from "./exportCsv";

const m = (p: Partial<Machine>) =>
  ({
    name: "Composé",
    line: "Montagem",
    days: 15,
    produced: 223450,
    target: 264000,
    percent: 85,
    status: "attention",
    hasTarget: true,
    lastEntry: { date: new Date(2026, 8, 21), shift: 2 },
    ...p,
  }) as Machine;

describe("CSV do Dashboard", () => {
  it("abre no Excel: BOM, ponto e vírgula, cabeçalho e uma linha por máquina", () => {
    const csv = machinesCsv([m({}), m({ name: 'Prensa "Tox"; nova', hasTarget: false, target: 0, lastEntry: null })]);
    expect(csv.startsWith("﻿Máquina;Linha;")).toBe(true);
    const lines = csv.trim().split("\r\n");
    expect(lines[1]).toBe("Composé;Montagem;15;223450;264000;85;Atenção;21/09/2026 · Turno 2");
    expect(lines[2]).toBe('"Prensa ""Tox""; nova";Montagem;15;223450;;;Por demanda;');
  });

  it("apontamentos da máquina em ordem de data e turno", () => {
    const o = (date: Date, shift: 1 | 2, opId: string) =>
      ({
        date,
        shift,
        opId,
        quantity: 100,
        rework: false,
        operator: "Ana",
        recordedAt: new Date(2026, 8, 21, 14, 5),
        note: null,
      }) as unknown as ProductionOrder;
    const csv = ordersCsv(m({}), [o(new Date(2026, 8, 21), 2, "OP 2"), o(new Date(2026, 8, 20), 1, "OP 1")]);
    const lines = csv.trim().split("\r\n");
    expect(lines[1]).toBe("Composé;20/09/2026;Turno 1;1;100;Não;Ana;14:05;");
    expect(lines[2].split(";")[3]).toBe("2");
  });

  it("nome do arquivo sem acento nem espaço", () => {
    expect(csvName("dash", "máquinas", "setembro de 2026")).toBe("dash-maquinas-setembro-de-2026.csv");
  });
});
