import { useCallback, useMemo, useState, type ReactNode } from "react";
import { DATA_ORIGIN, ELAPSED_DATES, MACHINES, toIsoDate, type Shift } from "@/data/machines";
import { useOps } from "@/features/ops/OpsStore";
import { tidyName, uniqueMaterials, type Absence, type Collaborator, type CollaboratorDraft, type Material, type MaterialShortage } from "./occurrences";
import { OccurrencesCtx, type OccurrencesState } from "./OccurrencesStore";

/**
 * Fonte das ocorrências do turno e do cadastro de colaboradores.
 * Na demonstração, em memória (some ao recarregar a página). Com o banco, fica
 * indisponível até a sessão de banco entregar as tabelas (nota de 15/10/2026):
 * as telas escondem a seção e o menu Colaboradores.
 */
export function OccurrencesProvider({ children }: { children: ReactNode }) {
  const { ops } = useOps();
  const demo = DATA_ORIGIN === "demo";
  const [collaborators, setCollaborators] = useState<Collaborator[]>(() => (demo ? SEED_COLLABORATORS : []));
  const [absences, setAbsences] = useState<Absence[]>(() => (demo ? seedAbsences() : []));
  const [shortages, setShortages] = useState<MaterialShortage[]>(() => (demo ? seedShortages() : []));

  const materials = useMemo(
    () =>
      uniqueMaterials([
        ...ops.map((op) => ({ code: op.material, description: op.product.toUpperCase() })),
        ...(demo ? CONSUMABLES : []),
        ...shortages.map((s) => ({ code: s.materialCode, description: s.materialDescription })),
      ]),
    [ops, shortages, demo],
  );

  const addCollaborator = useCallback(async (d: CollaboratorDraft) => {
    const c: Collaborator = { id: `c${Date.now()}`, name: tidyName(d.name), badge: d.badge.trim() || null, shift: d.shift, line: d.line, active: true };
    setCollaborators((list) => [...list, c]);
    return c;
  }, []);
  const updateCollaborator = useCallback(async (id: string, d: CollaboratorDraft) => {
    setCollaborators((list) => list.map((c) => (c.id === id ? { ...c, name: tidyName(d.name), badge: d.badge.trim() || null, shift: d.shift, line: d.line } : c)));
  }, []);
  const setCollaboratorActive = useCallback(async (id: string, active: boolean) => {
    setCollaborators((list) => list.map((c) => (c.id === id ? { ...c, active } : c)));
  }, []);
  const saveAbsence = useCallback(async (a: Omit<Absence, "id"> & { id?: string }) => {
    setAbsences((list) => (a.id ? list.map((x) => (x.id === a.id ? { ...a, id: a.id! } : x)) : [...list, { ...a, id: `a${Date.now()}` }]));
  }, []);
  const removeAbsence = useCallback(async (id: string) => setAbsences((list) => list.filter((x) => x.id !== id)), []);
  const saveShortage = useCallback(async (s: Omit<MaterialShortage, "id"> & { id?: string }) => {
    setShortages((list) => (s.id ? list.map((x) => (x.id === s.id ? { ...s, id: s.id! } : x)) : [...list, { ...s, id: `s${Date.now()}` }]));
  }, []);
  const removeShortage = useCallback(async (id: string) => setShortages((list) => list.filter((x) => x.id !== id)), []);

  const value = useMemo<OccurrencesState>(
    () => ({
      available: demo,
      collaborators,
      absences,
      shortages,
      materials,
      addCollaborator,
      updateCollaborator,
      setCollaboratorActive,
      saveAbsence,
      removeAbsence,
      saveShortage,
      removeShortage,
    }),
    [demo, collaborators, absences, shortages, materials, addCollaborator, updateCollaborator, setCollaboratorActive, saveAbsence, removeAbsence, saveShortage, removeShortage],
  );
  return <OccurrencesCtx.Provider value={value}>{children}</OccurrencesCtx.Provider>;
}

/* ---------- Dados de demonstração (fictícios) ---------- */

const SEED_COLLABORATORS: Collaborator[] = (
  [
    ["Gabriel Martins", "40211", 1, "Montagem"],
    ["Ana Paula Ribeiro", "40378", 1, "Embalagem"],
    ["Ana Clara Souza", "40512", 1, "Granel"],
    ["Bruno Henrique Costa", "40144", 1, "Montagem"],
    ["Juliana Ferreira", null, 1, null],
    ["Marcos Vinícius Alves", "40299", 1, "Embalagem"],
    ["Fernanda Oliveira", "40455", 1, "Montagem"],
    ["Patrícia Lopes", "40633", 2, "Montagem"],
    ["Rafael Nunes", "40701", 2, "Granel"],
    ["Carla Mendes", "40688", 2, "Embalagem"],
    ["Thiago Rocha", "40719", 2, "Montagem"],
    ["Diego Santos", "40822", 3, "Embalagem"],
    ["Eduardo Pereira", "40850", 3, "Montagem"],
    ["Luciana Prado", "39987", 1, "Montagem", false],
  ] as Array<[string, string | null, Shift, Collaborator["line"], boolean?]>
).map(([name, badge, shift, line, active], i) => ({ id: `c${i + 1}`, name, badge, shift, line, active: active ?? true }));

/** Consumíveis de embalagem que não aparecem como material de OP */
const CONSUMABLES: Material[] = [
  { code: "19189479", description: "FILME PET+PE 0,5X270mm REF CONCEPT ITJ" },
  { code: "10045821", description: "CAIXA PAPELÃO ONDULADO 300X200X150" },
  { code: "12093344", description: "ETIQUETA ADESIVA 100X50 BRANCA" },
  { code: "16620058", description: "SACO PLÁSTICO PE 150X250" },
  { code: "15500712", description: "PARAFUSO M3X8 PHILIPS ZB" },
];

/** Os últimos dias com dados, do mais recente para trás */
const recent = (n: number) => toIsoDate(ELAPSED_DATES[Math.max(0, ELAPSED_DATES.length - 1 - n)]);
const machineIds = (...parts: string[]) => parts.flatMap((part) => MACHINES.find((m) => m.name.includes(part))?.id ?? []);

function seedAbsences(): Absence[] {
  const rows: Array<[number, Shift, string, Absence["kind"], string | null, string | null]> = [
    [0, 1, "c1", "left_early", "14:30", "Consulta médica"],
    [0, 1, "c2", "absent", null, null],
    [1, 1, "c6", "absent", null, "Atestado"],
    [2, 2, "c9", "late", "15:10", null],
    [3, 1, "c6", "absent", null, null],
    [4, 1, "c4", "left_early", "12:00", null],
    [5, 2, "c9", "absent", null, null],
    [6, 1, "c1", "late", "05:40", null],
    [8, 1, "c1", "left_early", "13:00", null],
  ];
  return rows.map(([d, shift, collaboratorId, kind, time, note], i) => ({ id: `a${i + 1}`, date: recent(d), shift, collaboratorId, kind, time, note }));
}

function seedShortages(): MaterialShortage[] {
  const rows: Array<[number, Shift, string, string, string[], string | null]> = [
    [0, 1, "19189479", "FILME PET+PE 0,5X270mm REF CONCEPT ITJ", machineIds("horizontal nº 1", "horizontal nº 2"), null],
    [2, 1, "10045821", "CAIXA PAPELÃO ONDULADO 300X200X150", [], "Chegou às 10h"],
    [4, 2, "19189479", "FILME PET+PE 0,5X270mm REF CONCEPT ITJ", machineIds("horizontal nº 1"), null],
  ];
  return rows.map(([d, shift, materialCode, materialDescription, machines, note], i) => ({
    id: `s${i + 1}`,
    date: recent(d),
    shift,
    materialCode,
    materialDescription,
    machineIds: machines,
    note,
  }));
}
