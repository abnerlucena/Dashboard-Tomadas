import type { Line, Shift } from "@/data/machines";

/*
 * Ocorrências do turno: materiais que faltaram e pessoas que faltaram, saíram
 * mais cedo ou chegaram atrasadas. Valem para o turno inteiro (data + turno),
 * como o bloco "Informações adicionais" da planilha de produção. A linha
 * Qualidade da planilha fica para depois.
 *
 * O formato abaixo é a proposta de contrato para a sessão de banco
 * (docs/database/notas/2026-10-15-ocorrencias-do-turno.md). Até o banco ter as
 * tabelas, só a demonstração grava.
 */

export interface Collaborator {
  id: string;
  /** nome e sobrenome, como a liderança chama a pessoa */
  name: string;
  /** número de cadastro da pessoa na empresa, só números (opcional) */
  badge: string | null;
  /** turno de costume: só ordena a lista do apontamento */
  shift: Shift;
  line: Line | null;
  /** quem sai da empresa é inativado, nunca apagado: as ocorrências antigas mantêm o nome */
  active: boolean;
}

export type AbsenceKind = "absent" | "left_early" | "late";

export interface Absence {
  id: string;
  /** dia do turno, aaaa-mm-dd */
  date: string;
  shift: Shift;
  collaboratorId: string;
  kind: AbsenceKind;
  /** "hh:mm": saída ou chegada (só nos dois últimos tipos, opcional) */
  time: string | null;
  note: string | null;
}

export interface MaterialShortage {
  id: string;
  date: string;
  shift: Shift;
  /** código do material, só números (até 18, como nas OPs) */
  materialCode: string;
  materialDescription: string;
  /** máquinas que ficaram sem o material (pode ser nenhuma, uma ou várias) */
  machineIds: string[];
  note: string | null;
}

export interface Material {
  code: string;
  description: string;
}

export const ABSENCE_META: Record<AbsenceKind, { label: string; sheet: string; timeLabel: string | null; appearance: "danger" | "warning" | "neutral" }> = {
  absent: { label: "Faltou", sheet: "faltou", timeLabel: null, appearance: "danger" },
  left_early: { label: "Saiu mais cedo", sheet: "saiu mais cedo", timeLabel: "Saiu às", appearance: "warning" },
  late: { label: "Chegou atrasado", sheet: "chegou atrasado", timeLabel: "Chegou às", appearance: "neutral" },
};
export const ABSENCE_KINDS = Object.keys(ABSENCE_META) as AbsenceKind[];

export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** "  ana   paula ribeiro " → "Ana Paula Ribeiro" (de, da, do, dos, das, e ficam minúsculos) */
export function tidyName(raw: string) {
  const small = new Set(["de", "da", "do", "dos", "das", "e"]);
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w, i) => (i > 0 && small.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

export interface CollaboratorDraft {
  name: string;
  badge: string;
  shift: Shift;
  line: Line | null;
}

/** Erros do cadastro; `null` = pode salvar */
export function validateCollaborator(d: CollaboratorDraft, all: Collaborator[], editingId?: string) {
  const name = tidyName(d.name);
  const badge = d.badge.trim();
  const errors: { name?: string; badge?: string } = {};
  if (!name) errors.name = "Escreva o nome da pessoa.";
  else if (name.split(" ").length < 2) errors.name = "Escreva nome e sobrenome, para não confundir pessoas com o mesmo nome.";
  else if (all.some((c) => c.id !== editingId && normalize(c.name) === normalize(name)))
    errors.name = "Já existe alguém com este nome. Confira a lista ou acrescente outro sobrenome.";
  if (badge && !/^\d{1,12}$/.test(badge)) errors.badge = "O cadastro tem só números.";
  else if (badge && all.some((c) => c.id !== editingId && c.badge === badge)) errors.badge = "Este cadastro já é de outra pessoa.";
  return errors.name || errors.badge ? errors : null;
}

/**
 * Busca do apontamento: por nome (sem acento) ou cadastro. Sem busca, só os
 * do turno (ou todos, se pedido); com busca, qualquer turno. O turno do
 * apontamento vem primeiro.
 */
export function searchCollaborators(all: Collaborator[], query: string, shift: Shift, opts: { allShifts?: boolean; exclude?: Set<string> } = {}) {
  const q = normalize(query);
  return all
    .filter((c) => c.active && !opts.exclude?.has(c.id))
    .filter((c) => (q ? normalize(c.name).includes(q) || (c.badge ?? "").includes(q) : opts.allShifts || c.shift === shift))
    .sort((a, b) => Number(a.shift !== shift) - Number(b.shift !== shift) || a.name.localeCompare(b.name, "pt-BR"));
}

/** Busca de material por código ou descrição */
export function searchMaterials(catalog: Material[], query: string, limit = 6) {
  const q = normalize(query);
  if (!q) return [];
  return catalog.filter((m) => m.code.includes(q) || normalize(m.description).includes(q)).slice(0, limit);
}

/** Catálogo sem repetir código, em ordem de código */
export function uniqueMaterials(list: Material[]) {
  const seen = new Map<string, Material>();
  for (const m of list) if (m.code && !seen.has(m.code)) seen.set(m.code, m);
  return [...seen.values()].sort((a, b) => a.description.localeCompare(b.description, "pt-BR"));
}

export const isMaterialCode = (s: string) => /^\d{1,18}$/.test(s.trim());

/**
 * O bloco "Informações adicionais" da planilha, linha por linha:
 * "19189479 - FILME PET+PE 0,5X270mm REF CONCEPT ITJ" e
 * "01 Colaborador saiu mais cedo – Gabriel Martins".
 */
export function sheetLines(shortages: MaterialShortage[], absences: Absence[], nameOf: (id: string) => string) {
  return {
    materials: shortages.map((s) => `${s.materialCode} - ${s.materialDescription}`),
    people: absences.map((a) => {
      const meta = ABSENCE_META[a.kind];
      return `01 Colaborador ${meta.sheet}${a.time ? ` às ${a.time}` : ""} – ${nameOf(a.collaboratorId)}`;
    }),
  };
}

/** Faltas e saídas/atrasos de cada pessoa no mês de `monthIso` (aaaa-mm) */
export function monthCounts(absences: Absence[], monthIso: string) {
  const out = new Map<string, { absent: number; other: number }>();
  for (const a of absences) {
    if (!a.date.startsWith(monthIso)) continue;
    const c = out.get(a.collaboratorId) ?? { absent: 0, other: 0 };
    if (a.kind === "absent") c.absent++;
    else c.other++;
    out.set(a.collaboratorId, c);
  }
  return out;
}
