import { describe, expect, it } from "vitest";
import type { Session } from "../../../../src/lib/api";
import type { DataSource } from "../../../../src/lib/repositories/types";
import { backendApi, demoApi, demoSeed } from "./occurrencesApi";

const gestor: Session = { token: "t", nome: "Rafael Souza", role: "user", userId: "u1", permissions: ["collaborators.manage", "production.create", "production.edit"] };
const operador: Session = { token: "t", nome: "Camila Duarte", role: "user", userId: "u2", permissions: ["production.create"] };
const DAY = demoSeed().absences[0].date;

describe("demonstração com as regras do banco (D70)", () => {
  it("o nome das faltas só chega para quem tem collaborators.manage", async () => {
    let who: Session = gestor;
    const api = demoApi(() => who);
    const comNome = await api.listShiftOccurrences(DAY, DAY);
    expect(comNome.absences.every((a) => a.name)).toBe(true);
    who = operador;
    const semNome = await api.listShiftOccurrences(DAY, DAY);
    expect(semNome.absences.every((a) => a.name === null && a.collaboratorId === null && a.note === null && a.time === null)).toBe(true);
    // registradas por outra pessoa, há tempo: sem id, ninguém além do gestor corrige
    expect(semNome.absences.every((a) => a.id === null)).toBe(true);
  });

  it("quem registrou pode desfazer em 24 h, mesmo sem ver o nome depois", async () => {
    const api = demoApi(() => operador);
    const id = await api.saveAbsence({ date: DAY, shift: 3, collaboratorId: "c12", kind: "late", time: "23:50", note: null });
    const mine = (await api.listShiftOccurrences(DAY, DAY)).absences.find((a) => a.id === id)!;
    expect(mine).toMatchObject({ mine: true, name: null, collaboratorId: null });
    await api.removeAbsence(id);
    expect((await api.listShiftOccurrences(DAY, DAY)).absences.some((a) => a.id === id)).toBe(false);
  });

  it("inativar tira o nome de todas as faltas da pessoa, sem volta, e diz quantas", async () => {
    const api = demoApi(() => gestor);
    const all = await api.listShiftOccurrences("2000-01-01", "2100-01-01");
    const deGabriel = all.absences.filter((a) => a.collaboratorId === "c1").length;
    expect(await api.setCollaboratorActive("c1", false)).toBe(deGabriel);
    expect(await api.setCollaboratorActive("c1", true)).toBe(0);
    const depois = await api.listShiftOccurrences("2000-01-01", "2100-01-01");
    expect(depois.absences.filter((a) => a.collaboratorId === "c1")).toHaveLength(0);
    // continuam contando, sem nome
    expect(depois.absences).toHaveLength(all.absences.length);
  });

  it("recusa a mesma pessoa duas vezes no turno, horário em \"faltou\" e o mesmo material repetido", async () => {
    const api = demoApi(() => gestor);
    const base = { date: DAY, shift: 3 as const, collaboratorId: "c13", note: null };
    await api.saveAbsence({ ...base, kind: "late", time: "23:40" });
    await expect(api.saveAbsence({ ...base, kind: "absent", time: null })).rejects.toThrow(/já está/);
    await expect(api.saveAbsence({ ...base, collaboratorId: "c12", kind: "absent", time: "23:00" })).rejects.toThrow(/não tem horário/);
    const m = { date: DAY, shift: 3 as const, materialCode: "12093344", materialDescription: "ETIQUETA", machineIds: [], note: null };
    await api.saveShortage(m);
    await expect(api.saveShortage(m)).rejects.toThrow(/já está nas faltas/);
  });

  it("só o gestor cadastra colaborador", async () => {
    await expect(demoApi(() => operador).createCollaborator({ name: "Nova Pessoa", badge: "", shift: 1, process: null })).rejects.toThrow(/gestor/);
  });
});

describe("conversão para o contrato do banco", () => {
  it("turno e máquinas viram número; cadastro vazio apaga", async () => {
    const calls: unknown[][] = [];
    const rec = (name: string) => async (...args: unknown[]) => {
      calls.push([name, ...args]);
      return "id1";
    };
    const source = {
      saveShortage: rec("saveShortage"),
      updateCollaborator: rec("updateCollaborator"),
    } as unknown as DataSource["occurrences"];
    const api = backendApi(source, () => gestor);
    await api.saveShortage({ date: "2026-10-15", shift: 2, materialCode: "1", materialDescription: "X", machineIds: ["11", "4"], note: null });
    await api.updateCollaborator("c1", { name: "ana  souza", badge: "", shift: 3, process: null });
    expect(calls[0][1]).toMatchObject({ shiftId: 2, machineIds: [11, 4] });
    expect(calls[1][2]).toEqual({ name: "Ana Souza", shiftId: 3, badgeNumber: "", process: null });
  });
});
