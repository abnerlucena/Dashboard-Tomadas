import type { Machine as ApiMachine } from "../../../../src/lib/api";
import type { MachineChanges, MachineProcess, MetaInfoRaw, NewMachineInput } from "../../../../src/lib/repositories/types";
import type { BaseDaMeta } from "../../../../src/lib/metas";
import { lineOf } from "@/data/fromBackend";
import type { Line } from "@/data/machines";

/*
 * Regras da tela de cadastro de máquinas que não dependem de React.
 * Contrato (D63): machines.getMachines (todas, com `allMachines`),
 * createMachine, updateMachine e toggleMachine.
 * - A linha (`process`) é obrigatória no cadastro.
 * - Meta 0 = por demanda; o banco recusa as combinações contraditórias.
 * - A base "conforme a lotação" exige a lotação padrão.
 * - Editar muda nome, linha e lotação. Meta e base têm vigência: mudam em Metas.
 * - A lotação não se apaga, só se troca: é o divisor da meta rateada (D47).
 */

export interface RegistryMachine {
  id: string;
  name: string;
  line: Line;
  /** linha no banco; null = máquina antiga sem linha (a tela deduz pelo nome) */
  process: MachineProcess | null;
  hasMeta: boolean;
  /** meta por turno vigente hoje (0 = sem meta) */
  metaPerShift: number;
  basis: BaseDaMeta;
  /** lotação padrão do posto; null = não informada */
  crew: number | null;
  active: boolean;
}

export const PROCESS_LABEL: Record<MachineProcess, string> = { assembly: "Montagem", packaging: "Embalagem" };

/** Linha de tela → linha do banco. Granel é agrupamento de tela: as bancadas a granel embalam */
export const processOfLine = (line: Line): MachineProcess => (line === "Montagem" ? "assembly" : "packaging");

export function fromApi(machines: ApiMachine[], metasInfo: Record<number, MetaInfoRaw>): RegistryMachine[] {
  return sortMachines(
    machines.map((m) => ({
      id: String(m.id),
      name: m.name,
      line: lineOf(m.name, m.process),
      process: m.process ?? null,
      hasMeta: m.hasMeta,
      metaPerShift: m.defaultMeta ?? 0,
      basis: metasInfo[m.id]?.basis ?? "per_shift",
      crew: m.standardOperatorCount ?? null,
      // O contrato fala o formato da planilha: "ativo" / "inativo"
      active: !m.status || m.status === "ativo",
    })),
  );
}

/** Ativas primeiro; dentro de cada grupo, por nome */
export const sortMachines = (list: RegistryMachine[]) =>
  [...list].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "pt-BR"));

/** Para comparar nomes: sem acento, sem caixa, espaços simples ("Horizontal  Nº1" = "horizontal nº1") */
export const nameKey = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
export const cleanName = (s: string) => s.trim().replace(/\s+/g, " ");

/** O que a pessoa preenche. No editar, meta e base não aparecem */
export interface MachineDraft {
  name: string;
  /** "" = ainda não escolhida */
  process: MachineProcess | "";
  meta: string;
  basis: BaseDaMeta;
  crew: string;
}

export const newDraft = (): MachineDraft => ({ name: "", process: "", meta: "", basis: "per_shift", crew: "" });

export const draftOf = (m: RegistryMachine): MachineDraft => ({
  name: m.name,
  process: m.process ?? processOfLine(m.line),
  meta: String(m.metaPerShift),
  basis: m.basis,
  crew: m.crew ? String(m.crew) : "",
});

export interface DraftErrors {
  name: string | null;
  process: string | null;
  meta: string | null;
  crew: string | null;
  any: boolean;
}

/**
 * `editing` = a máquina que está sendo corrigida (o nome dela não conta como
 * repetido; a lotação dela não pode ser apagada). O banco também recusa nome
 * repetido; conferir antes poupa a ida e diz qual é.
 */
export function validateDraft(d: MachineDraft, existing: RegistryMachine[], editing?: RegistryMachine): DraftErrors {
  const key = nameKey(d.name);
  const twin = key ? existing.find((m) => m.id !== editing?.id && nameKey(m.name) === key) : undefined;
  const meta = d.meta.trim();
  const crew = d.crew.trim();
  const withMeta = !editing && /^\d+$/.test(meta) && Number(meta) > 0;
  const errors = {
    name: !key
      ? "Informe o nome da máquina"
      : key.length > 80
        ? "Use no máximo 80 caracteres"
        : twin
          ? `Já existe: ${twin.name}${twin.active ? "" : " (inativa; reative em vez de cadastrar de novo)"}`
          : null,
    process: d.process ? null : "Escolha a linha",
    meta: editing
      ? null
      : !meta
        ? "Informe a meta por turno (0 se não tiver meta)"
        : !/^\d+$/.test(meta)
          ? "Use um número inteiro, sem pontos"
          : null,
    crew:
      crew && (!/^\d+$/.test(crew) || Number(crew) < 1 || Number(crew) > 99)
        ? "De 1 a 99 pessoas"
        : !crew && editing?.crew
          ? "A lotação não se apaga: informe outro número"
          : !crew && withMeta && d.basis === "per_shift_prorated"
            ? "Para a meta conforme a lotação, informe a lotação padrão"
            : null,
  };
  return { ...errors, any: Object.values(errors).some(Boolean) };
}

/** Cadastro: a meta 0 vai como "por demanda" (sem base) */
export function toNewInput(d: MachineDraft): NewMachineInput {
  const meta = Number(d.meta);
  return {
    name: cleanName(d.name),
    process: d.process as MachineProcess,
    defaultMeta: meta,
    hasMeta: meta > 0,
    ...(meta > 0 && d.basis !== "per_shift" ? { basis: d.basis } : {}),
    ...(d.crew.trim() ? { standardOperatorCount: Number(d.crew) } : {}),
  };
}

/** Editar: só o que mudou; null = nada a salvar */
export function changesOf(d: MachineDraft, m: RegistryMachine): MachineChanges | null {
  const c: MachineChanges = {};
  if (cleanName(d.name) !== m.name) c.name = cleanName(d.name);
  if (d.process && d.process !== m.process) c.process = d.process;
  const crew = d.crew.trim() ? Number(d.crew) : null;
  if (crew !== null && crew !== m.crew) c.standardOperatorCount = crew;
  return Object.keys(c).length ? c : null;
}
