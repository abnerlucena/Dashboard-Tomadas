import type { Session } from "../../../../src/lib/api";
import type { DataSource, MaterialShortageRecord, ShiftAbsenceRecord } from "../../../../src/lib/repositories/types";
import { ELAPSED_DATES, MACHINES, toIsoDate, type Shift } from "@/data/machines";
import { can } from "@/features/access/permissions";
import { isMaterialCode, tidyName, validateCollaborator, type Absence, type AbsenceKind, type Collaborator, type CollaboratorDraft, type MaterialShortage } from "./occurrences";

/*
 * As ocorrências vistas pelas telas: uma interface só, com duas fontes.
 * - Banco: o repositório `occurrences` do contrato (D70), com a conversão de
 *   formato (turno como número, máquinas como número) feita aqui.
 * - Demonstração: em memória, seguindo as MESMAS regras do banco (nome só para
 *   quem tem collaborators.manage, correção em 24 h por quem registrou,
 *   inativar tira o nome das faltas), para a tela se comportar igual.
 */

export interface AbsenceInput {
  id?: string;
  date: string;
  shift: Shift;
  collaboratorId: string;
  kind: AbsenceKind;
  time: string | null;
  note: string | null;
}

export interface ShortageInput {
  id?: string;
  date: string;
  shift: Shift;
  materialCode: string;
  materialDescription: string;
  machineIds: string[];
  note: string | null;
}

export interface OccurrencesApi {
  listCollaborators(): Promise<Collaborator[]>;
  /** devolve o id */
  createCollaborator(d: CollaboratorDraft): Promise<string>;
  updateCollaborator(id: string, d: CollaboratorDraft): Promise<void>;
  /** inativar devolve quantas faltas perderam o nome */
  setCollaboratorActive(id: string, active: boolean): Promise<number>;
  listShiftOccurrences(from: string, to: string): Promise<{ absences: Absence[]; shortages: MaterialShortage[] }>;
  saveAbsence(input: AbsenceInput): Promise<string>;
  removeAbsence(id: string): Promise<void>;
  saveShortage(input: ShortageInput): Promise<string>;
  removeShortage(id: string): Promise<void>;
}

const asShift = (n: number) => (n === 2 || n === 3 ? n : 1) as Shift;

/* ---------- Banco ---------- */

export const absenceFromRecord = (r: ShiftAbsenceRecord): Absence => ({
  id: r.id,
  date: r.date,
  shift: asShift(r.shiftId),
  collaboratorId: r.collaboratorId,
  name: r.collaboratorName,
  kind: r.kind,
  time: r.time,
  note: r.note,
  mine: r.mine,
});

export const shortageFromRecord = (r: MaterialShortageRecord): MaterialShortage => ({
  id: r.id,
  date: r.date,
  shift: asShift(r.shiftId),
  materialCode: r.materialCode,
  materialDescription: r.materialDescription,
  machineIds: r.machineIds.map(String),
  note: r.note,
  mine: r.mine,
});

export function backendApi(source: DataSource["occurrences"], getSession: () => Session | null): OccurrencesApi {
  // A sessão é lida a cada chamada: o token se renova sem trocar a fonte
  return {
    async listCollaborators() {
      const list = await source.listCollaborators(getSession());
      return list.map((c) => ({ id: c.id, name: c.name, badge: c.badgeNumber, shift: asShift(c.shiftId), process: c.process, active: c.active }));
    },
    createCollaborator: (d) =>
      source.createCollaborator(
        { name: tidyName(d.name), shiftId: d.shift, ...(d.badge.trim() ? { badgeNumber: d.badge.trim() } : {}), ...(d.process ? { process: d.process } : {}) },
        getSession(),
      ),
    // "" apaga o cadastro e null apaga a linha: o formulário manda sempre o estado inteiro
    updateCollaborator: (id, d) =>
      source.updateCollaborator(id, { name: tidyName(d.name), shiftId: d.shift, badgeNumber: d.badge.trim(), process: d.process }, getSession()),
    setCollaboratorActive: (id, active) => source.setCollaboratorActive(id, active, getSession()),
    async listShiftOccurrences(from, to) {
      const { absences, shortages } = await source.listShiftOccurrences(from, to, getSession());
      return { absences: absences.map(absenceFromRecord), shortages: shortages.map(shortageFromRecord) };
    },
    saveAbsence: (a) =>
      source.saveAbsence(
        { ...(a.id ? { id: a.id } : {}), date: a.date, shiftId: a.shift, collaboratorId: a.collaboratorId, kind: a.kind, time: a.time, note: a.note },
        getSession(),
      ),
    removeAbsence: (id) => source.removeAbsence(id, getSession()),
    saveShortage: (s) =>
      source.saveShortage(
        {
          ...(s.id ? { id: s.id } : {}),
          date: s.date,
          shiftId: s.shift,
          materialCode: s.materialCode,
          materialDescription: s.materialDescription,
          machineIds: s.machineIds.map(Number).filter((n) => Number.isFinite(n)),
          note: s.note,
        },
        getSession(),
      ),
    removeShortage: (id) => source.removeShortage(id, getSession()),
  };
}

/* ---------- Demonstração (em memória, mesmas regras) ---------- */

interface StoredAbsence extends Omit<Absence, "id" | "name" | "mine"> {
  id: string;
  by: string;
  at: number;
}
interface StoredShortage extends Omit<MaterialShortage, "mine"> {
  by: string;
  at: number;
}

const DAY_MS = 24 * 3600 * 1000;

export function demoApi(getSession: () => Session | null, seed = demoSeed()): OccurrencesApi {
  const collaborators = seed.collaborators.map((c) => ({ ...c }));
  let absences = seed.absences.map((a) => ({ ...a }));
  let shortages = seed.shortages.map((s) => ({ ...s }));
  let seq = 1000;
  const me = () => getSession()?.userId ?? getSession()?.nome ?? "";
  const manager = () => can(getSession(), "collaborators.manage");
  const fresh = (at: number, by: string) => by === me() && Date.now() - at < DAY_MS;
  const fail = (msg: string): never => {
    throw new Error(msg);
  };
  const needManager = () => manager() || fail("Só o gestor cadastra e altera colaboradores.");

  return {
    async listCollaborators() {
      return collaborators.map((c) => ({ ...c }));
    },
    async createCollaborator(d) {
      needManager();
      const errors = validateCollaborator(d, collaborators);
      if (errors) fail(errors.name ?? errors.badge ?? "Confira o cadastro.");
      const id = `c${++seq}`;
      collaborators.push({ id, name: tidyName(d.name), badge: d.badge.trim() || null, shift: d.shift, process: d.process, active: true });
      return id;
    },
    async updateCollaborator(id, d) {
      needManager();
      const errors = validateCollaborator(d, collaborators, id);
      if (errors) fail(errors.name ?? errors.badge ?? "Confira o cadastro.");
      const c = collaborators.find((x) => x.id === id) ?? fail("Colaborador não encontrado.");
      Object.assign(c, { name: tidyName(d.name), badge: d.badge.trim() || null, shift: d.shift, process: d.process });
    },
    async setCollaboratorActive(id, active) {
      needManager();
      const c = collaborators.find((x) => x.id === id) ?? fail("Colaborador não encontrado.");
      c.active = active;
      if (active) return 0;
      // Saiu da empresa: as faltas dele continuam contando, sem o nome e sem a observação (D70)
      let lost = 0;
      absences = absences.map((a) => (a.collaboratorId === id ? (lost++, { ...a, collaboratorId: null, note: null }) : a));
      return lost;
    },
    async listShiftOccurrences(from, to) {
      const named = manager();
      const nameOf = new Map(collaborators.map((c) => [c.id, c.name]));
      return {
        absences: absences
          .filter((a) => a.date >= from && a.date <= to)
          .map((a) => {
            const mine = a.by === me();
            return named
              ? { ...a, name: a.collaboratorId ? (nameOf.get(a.collaboratorId) ?? null) : null, mine }
              : { ...a, id: fresh(a.at, a.by) ? a.id : null, collaboratorId: null, name: null, time: null, note: null, mine };
          }),
        shortages: shortages.filter((s) => s.date >= from && s.date <= to).map((s) => ({ ...s, mine: s.by === me() })),
      };
    },
    async saveAbsence(input) {
      const c = collaborators.find((x) => x.id === input.collaboratorId) ?? fail("Escolha a pessoa na lista.");
      if (!c.active) fail("Este colaborador está inativo.");
      if (input.kind === "absent" && input.time) fail("\"Faltou\" não tem horário.");
      if (absences.some((a) => a.id !== input.id && a.date === input.date && a.shift === input.shift && a.collaboratorId === input.collaboratorId))
        fail(`${c.name} já está na falta de pessoas deste turno.`);
      const row = { date: input.date, shift: input.shift, collaboratorId: input.collaboratorId, kind: input.kind, time: input.time, note: input.note };
      if (input.id) {
        const old = absences.find((a) => a.id === input.id) ?? fail("Ocorrência não encontrada.");
        if (!manager() && !fresh(old.at, old.by)) fail("Só o gestor corrige depois de 24 horas.");
        Object.assign(old, row);
        return old.id;
      }
      const id = `a${++seq}`;
      absences.push({ ...row, id, by: me(), at: Date.now() });
      return id;
    },
    async removeAbsence(id) {
      const old = absences.find((a) => a.id === id) ?? fail("Ocorrência não encontrada.");
      if (!manager() && !fresh(old.at, old.by)) fail("Só o gestor corrige depois de 24 horas.");
      absences = absences.filter((a) => a.id !== id);
    },
    async saveShortage(input) {
      if (!isMaterialCode(input.materialCode)) fail("O código do material tem só números, até 18.");
      if (shortages.some((s) => s.id !== input.id && s.date === input.date && s.shift === input.shift && s.materialCode === input.materialCode))
        fail("Este material já está nas faltas deste turno. Corrija o que já foi registrado.");
      const row = {
        date: input.date,
        shift: input.shift,
        materialCode: input.materialCode,
        materialDescription: input.materialDescription,
        machineIds: input.machineIds,
        note: input.note,
      };
      const editor = can(getSession(), "production.edit");
      if (input.id) {
        const old = shortages.find((s) => s.id === input.id) ?? fail("Material não encontrado.");
        if (!editor && !fresh(old.at, old.by)) fail("Só quem pode editar apontamentos corrige depois de 24 horas.");
        Object.assign(old, row);
        return old.id;
      }
      const id = `s${++seq}`;
      shortages.push({ ...row, id, by: me(), at: Date.now() });
      return id;
    },
    async removeShortage(id) {
      const old = shortages.find((s) => s.id === id) ?? fail("Material não encontrado.");
      if (!can(getSession(), "production.edit") && !fresh(old.at, old.by)) fail("Só quem pode editar apontamentos corrige depois de 24 horas.");
      shortages = shortages.filter((s) => s.id !== id);
    },
  };
}

/* ---------- Dados de demonstração (fictícios) ---------- */

export function demoSeed() {
  const collaborators: Collaborator[] = (
    [
      ["Gabriel Martins", "40211", 1, "assembly"],
      ["Ana Paula Ribeiro", "40378", 1, "packaging"],
      ["Ana Clara Souza", "40512", 1, "packaging"],
      ["Bruno Henrique Costa", "40144", 1, "assembly"],
      ["Juliana Ferreira", null, 1, null],
      ["Marcos Vinícius Alves", "40299", 1, "packaging"],
      ["Fernanda Oliveira", "40455", 1, "assembly"],
      ["Patrícia Lopes", "40633", 2, "assembly"],
      ["Rafael Nunes", "40701", 2, "packaging"],
      ["Carla Mendes", "40688", 2, "packaging"],
      ["Thiago Rocha", "40719", 2, "assembly"],
      ["Diego Santos", "40822", 3, "packaging"],
      ["Eduardo Pereira", "40850", 3, "assembly"],
      ["Luciana Prado", "39987", 1, "assembly", false],
    ] as Array<[string, string | null, Shift, Collaborator["process"], boolean?]>
  ).map(([name, badge, shift, process, active], i) => ({ id: `c${i + 1}`, name, badge, shift, process, active: active ?? true }));

  /** Os últimos dias com dados, do mais recente para trás; registrados há tempo por outra pessoa */
  const recent = (n: number) => toIsoDate(ELAPSED_DATES[Math.max(0, ELAPSED_DATES.length - 1 - n)]);
  const machineIds = (...parts: string[]) => parts.flatMap((part) => MACHINES.find((m) => m.name.includes(part))?.id ?? []);
  const old = { by: "seed", at: 0 };

  const absences: StoredAbsence[] = (
    [
      [0, 1, "c1", "left_early", "14:30", "Consulta médica"],
      [0, 1, "c2", "absent", null, null],
      [1, 1, "c6", "absent", null, "Atestado"],
      [2, 2, "c9", "late", "15:10", null],
      [3, 1, "c6", "absent", null, null],
      [4, 1, "c4", "left_early", "12:00", null],
      [5, 2, "c9", "absent", null, null],
      [6, 1, "c1", "late", "05:40", null],
      [8, 1, "c1", "left_early", "13:00", null],
    ] as Array<[number, Shift, string, AbsenceKind, string | null, string | null]>
  ).map(([d, shift, collaboratorId, kind, time, note], i) => ({ id: `a${i + 1}`, date: recent(d), shift, collaboratorId, kind, time, note, ...old }));

  const shortages: StoredShortage[] = (
    [
      [0, 1, "19189479", "FILME PET+PE 0,5X270mm REF CONCEPT ITJ", machineIds("horizontal nº 1", "horizontal nº 2"), null],
      [2, 1, "10045821", "CAIXA PAPELÃO ONDULADO 300X200X150", [], "Chegou às 10h"],
      [4, 2, "19189479", "FILME PET+PE 0,5X270mm REF CONCEPT ITJ", machineIds("horizontal nº 1"), null],
    ] as Array<[number, Shift, string, string, string[], string | null]>
  ).map(([d, shift, materialCode, materialDescription, ids, note], i) => ({
    id: `s${i + 1}`,
    date: recent(d),
    shift,
    materialCode,
    materialDescription,
    machineIds: ids,
    note,
    ...old,
  }));

  return { collaborators, absences, shortages };
}

/** Consumíveis de embalagem que não aparecem como material de OP (só na demonstração) */
export const DEMO_CONSUMABLES = [
  { code: "19189479", description: "FILME PET+PE 0,5X270mm REF CONCEPT ITJ" },
  { code: "10045821", description: "CAIXA PAPELÃO ONDULADO 300X200X150" },
  { code: "12093344", description: "ETIQUETA ADESIVA 100X50 BRANCA" },
  { code: "16620058", description: "SACO PLÁSTICO PE 150X250" },
  { code: "15500712", description: "PARAFUSO M3X8 PHILIPS ZB" },
];
