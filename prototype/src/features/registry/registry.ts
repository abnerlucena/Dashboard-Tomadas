import type { Machine as ApiMachine } from "../../../../src/lib/api";
import type { MetaInfoRaw } from "../../../../src/lib/repositories/types";
import type { BaseDaMeta } from "../../../../src/lib/metas";
import { lineOf } from "@/data/fromBackend";
import type { Line } from "@/data/machines";

/*
 * Regras da tela de cadastro de máquinas que não dependem de React.
 * Contrato: machines.getMachines (todas, com `allMachines`), addMachine(nome,
 * meta por turno) e toggleMachine(id).
 */

export interface RegistryMachine {
  id: string;
  name: string;
  line: Line;
  hasMeta: boolean;
  /** meta por turno vigente hoje (0 = sem meta) */
  metaPerShift: number;
  basis: BaseDaMeta;
  /** lotação padrão do posto; null = não informada */
  crew: number | null;
  active: boolean;
}

export function fromApi(machines: ApiMachine[], metasInfo: Record<number, MetaInfoRaw>): RegistryMachine[] {
  return sortMachines(
    machines.map((m) => ({
      id: String(m.id),
      name: m.name,
      line: lineOf(m.name),
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

export interface NewMachineErrors {
  name: string | null;
  meta: string | null;
}

/** O banco também recusa nome repetido (23505); conferir antes poupa a ida e diz qual é */
export function validateNew(name: string, meta: string, existing: RegistryMachine[]): NewMachineErrors {
  const key = nameKey(name);
  const twin = key ? existing.find((m) => nameKey(m.name) === key) : undefined;
  const v = meta.trim();
  return {
    name: !key
      ? "Informe o nome da máquina"
      : key.length > 80
        ? "Use no máximo 80 caracteres"
        : twin
          ? `Já existe: ${twin.name}${twin.active ? "" : " (inativa; reative em vez de cadastrar de novo)"}`
          : null,
    meta: !v ? "Informe a meta por turno (0 se não tiver meta)" : !/^\d+$/.test(v) ? "Use um número inteiro, sem pontos" : null,
  };
}
