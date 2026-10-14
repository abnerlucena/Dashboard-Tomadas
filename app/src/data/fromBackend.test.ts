import { describe, expect, it } from "vitest";
import type { ProdRecord } from "../../../src/lib/api";
import { buildBackendData, lineOf, parseDay, parseMoment, shiftOf, type BackendInput } from "./fromBackend";
import * as data from "./machines";

const rec = (r: Partial<ProdRecord>): ProdRecord => ({
  date: "2026-09-15",
  turno: "TURNO 1",
  machineId: 1,
  machineName: "Máquina de tomadas Composé (Aumaq)",
  meta: 11000,
  producao: 0,
  savedBy: "Ana",
  savedAt: "15/09/2026, 14:05:00",
  ...r,
});

const input = (records: ProdRecord[], extra: Partial<BackendInput> = {}): BackendInput => ({
  records,
  machines: [
    { id: 1, name: "Máquina de tomadas Composé (Aumaq)", hasMeta: true, defaultMeta: 11000, status: "ativo" },
    { id: 2, name: "Bancada de embalagem A Granél", hasMeta: true, defaultMeta: 25000, status: "ativo", standardOperatorCount: 3 },
    { id: 3, name: "Embaladora kit parafusos nº 1", hasMeta: false, defaultMeta: 0, status: "ativo" },
    { id: 4, name: "Prensa desativada", hasMeta: false, defaultMeta: 0, status: "inativo" },
  ],
  metas: { 1: 11000, 2: 25000 },
  metasInfo: { 2: { updatedBy: "", updatedAt: "", vigenciaInicio: "", basis: "per_operator" } },
  history: [],
  holidays: [],
  now: new Date(2026, 8, 30, 10, 0),
  ...extra,
});

describe("formatos do contrato", () => {
  it("lê as datas do banco e da planilha", () => {
    expect(parseDay("2026-09-21")).toEqual(new Date(2026, 8, 21));
    expect(parseDay("21/09/2026")).toEqual(new Date(2026, 8, 21));
    expect(parseDay("")).toBeNull();
    expect(parseMoment("20/09/2026, 10:30:00")).toEqual(new Date(2026, 8, 20, 10, 30, 0));
    expect(parseMoment("")).toBeNull();
    expect(shiftOf("TURNO 3")).toBe(3);
    expect(shiftOf("TURNO 4")).toBeNull();
  });

  it("agrupa por linha pelo nome, com os kits de parafuso na montagem", () => {
    expect(lineOf("Bancada de embalagem A Granél")).toBe("Granel");
    expect(lineOf("Embaladora horizontal nº 1")).toBe("Embalagem");
    expect(lineOf("Embaladora kit parafusos nº 1")).toBe("Montagem");
    expect(lineOf("Prensa Tox")).toBe("Montagem");
  });

  it("usa a linha do banco quando vem, e Granel continua pelo nome", () => {
    expect(lineOf("Embaladora kit parafusos nº 1", "packaging")).toBe("Embalagem");
    expect(lineOf("Embaladora horizontal nº 1", "assembly")).toBe("Montagem");
    expect(lineOf("Bancada de embalagem A Granél", "packaging")).toBe("Granel");
  });
});

describe("buildBackendData", () => {
  it("centro inativo só entra se apontou, e marcado como inativo", () => {
    expect(buildBackendData(input([])).machines.map((m) => m.id)).not.toContain("4");
    const d = buildBackendData(input([rec({ id: "r9", machineId: 4, machineName: "Prensa desativada", meta: 0, producao: 500 })]));
    expect(d.machines.find((m) => m.id === "4")?.inactive).toBe(true);
    expect(d.machines.find((m) => m.id === "1")?.inactive).toBeUndefined();
  });

  it("separa produção boa e retrabalho e completa o que as ordens não explicam", () => {
    const d = buildBackendData(
      input([
        rec({
          id: "r1",
          producao: 9000,
          goodQuantity: 9000,
          reworkQuantity: 300,
          ordensProducao: [
            { ordemId: "4510001", quantidade: 6000 },
            { ordemId: "4510002", quantidade: 300, retrabalho: true, obs: "Rebarba" },
          ],
          obs: "Troca de molde",
        }),
      ]),
    );
    const m = d.machines.find((x) => x.id === "1")!;
    const good = m.orders.filter((o) => !o.rework);
    expect(good.map((o) => [o.opId, o.quantity])).toEqual([
      ["4510001", 6000],
      ["", 3000],
    ]);
    expect(m.orders.filter((o) => o.rework).map((o) => o.quantity)).toEqual([300]);
    // A observação do apontamento vai na primeira linha sem observação
    expect(m.orders[0].note?.text).toBe("Troca de molde");
    expect(m.orders[1].note?.text).toBe("Rebarba");
    // sem o campo próprio (OP gravada antes da D66), a observação da OP de retrabalho serve de motivo
    expect(m.orders[1].reworkReason).toBe("Rebarba");
    expect(m.orders[0].reworkReason).toBeNull();
    expect(m.orders[0].recordedAt).toEqual(new Date(2026, 8, 15, 14, 5, 0));
  });

  it("o motivo do retrabalho vem do campo próprio (D66), não da observação", () => {
    const d = buildBackendData(
      input([
        rec({
          id: "r2",
          producao: 6000,
          goodQuantity: 6000,
          reworkQuantity: 300,
          ordensProducao: [
            { ordemId: "4510001", quantidade: 6000 },
            { ordemId: "4510002", quantidade: 300, retrabalho: true, obs: "lote 12", motivoRetrabalho: "Cor fora do padrão" },
          ],
        }),
      ]),
    );
    const m = d.machines.find((x) => x.id === "1")!;
    const rework = m.orders.find((o) => o.rework)!;
    expect(rework.reworkReason).toBe("Cor fora do padrão");
    expect(rework.note?.text).toBe("lote 12");
    // e volta igual quando o apontamento é corrigido no Histórico
    expect(rework.record?.orders?.[1].reason).toBe("Cor fora do padrão");
  });

  it("guarda a meta só dos turnos que contam para meta", () => {
    const d = buildBackendData(
      input([
        rec({ id: "a", meta: 11000, producao: 10000 }),
        rec({ id: "b", turno: "TURNO 3", meta: 0, producao: 2000, workMode: "overtime" }),
      ]),
    );
    const m = d.machines.find((x) => x.id === "1")!;
    expect(m.targets).toEqual([{ date: new Date(2026, 8, 15), shift: 1, target: 11000 }]);
    // T3 só em hora extra não faz o centro "de 3 turnos"
    expect(m.regime).toBe(2);
    expect(m.dailyTarget).toBe(22000);
  });

  it("usa metaDoTurno com a lotação padrão para a meta de um dia normal", () => {
    const d = buildBackendData(input([]));
    const granel = d.machines.find((x) => x.id === "2")!;
    // por pessoa, 3 pessoas de lotação, 2 turnos
    expect(granel.dailyTarget).toBe(25000 * 3 * 2);
    expect(granel.line).toBe("Granel");
  });

  it("monta a janela de dados e os dias úteis sem feriado de dia inteiro, mais os dias com produção", () => {
    const d = buildBackendData(
      input([rec({ id: "x", date: "2026-08-03", producao: 1 }), rec({ id: "y", date: "2026-09-19", producao: 1 })], {
        holidays: [
          { id: "h1", date: "2026-09-07", label: "Independência", type: "feriado" },
          { id: "h2", date: "2026-09-08", label: "Parada T3", type: "dia_anulado", shiftIds: [3] },
        ],
      }),
    );
    expect(d.dataStart).toEqual(new Date(2026, 7, 3));
    expect(d.dataEnd).toEqual(new Date(2026, 8, 19));
    const iso = d.workingDates.map(data.toIsoDate);
    expect(iso[0]).toBe("2026-08-03");
    expect(iso).not.toContain("2026-09-07"); // feriado
    expect(iso).toContain("2026-09-08"); // só o T3 parou
    expect(iso).toContain("2026-09-19"); // sábado com produção
    expect(iso).not.toContain("2026-09-20"); // domingo sem produção
    expect(iso[iso.length - 1]).toBe("2026-09-30");
  });

  it("mostra centros ativos sem apontamento e esconde inativos sem apontamento", () => {
    const ids = buildBackendData(input([])).machines.map((m) => m.id);
    expect(ids).toEqual(expect.arrayContaining(["1", "2", "3"]));
    expect(ids).not.toContain("4");
  });
});

describe("installBackendData", () => {
  it("troca o conjunto e recorta somando as metas apontadas", () => {
    const d = buildBackendData(
      input([
        rec({ id: "1", date: "2026-09-14", meta: 11000, goodQuantity: 9900, producao: 9900 }),
        rec({ id: "2", date: "2026-09-15", meta: 11000, goodQuantity: 12100, producao: 12100, reworkQuantity: 500 }),
        rec({ id: "3", date: "2026-09-15", turno: "TURNO 2", meta: 0, goodQuantity: 1000, producao: 1000, workMode: "overtime" }),
        rec({ id: "4", date: "2026-08-20", meta: 11000, goodQuantity: 5500, producao: 5500 }),
      ]),
    );
    data.installBackendData(d);

    expect(data.DATA_ORIGIN).toBe("backend");
    expect(data.PERIOD_LABEL).toBe("setembro de 2026");
    expect(data.MONTH_RANGE.from).toEqual(new Date(2026, 8, 1));

    const m = data.machineById("1");
    // setembro: produção boa 9.900 + 12.100 + 1.000 (hora extra conta na produção, não na meta)
    expect(m.produced).toBe(23000);
    expect(m.target).toBe(22000);
    expect(m.percent).toBe(105);
    expect(m.byShift[2]).toBe(1000);
    expect(m.targetByShift[2]).toBe(0);

    const week = data.scopeMachine(m, 1, { from: new Date(2026, 8, 15), to: new Date(2026, 8, 15) });
    expect(week.produced).toBe(12100);
    expect(week.target).toBe(11000);

    // Setembro vai até o dia 15: compara com 1 a 15 de agosto, e o apontamento de 20/08 fica fora
    expect(data.PREVIOUS_MONTH_PRODUCED).toBe(0);
    expect(data.PREVIOUS_MONTH_LABEL).toBe("agosto até o dia 15");
    expect(data.targetOn(data.MACHINES, new Date(2026, 8, 15))).toBe(11000);
    // o histórico vê todos os apontamentos da janela, inclusive o de agosto
    expect(data.ALL_ORDERS.some((o) => o.date.getMonth() === 7)).toBe(true);
    expect(data.WORK_ORDERS).toEqual([]);
  });
});
