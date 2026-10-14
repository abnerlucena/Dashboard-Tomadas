import { useSyncExternalStore } from "react";
import { dependeDaLotacao, metaDoTurno, type BaseDaMeta, type MetaDoTurno } from "../../../../src/lib/metas";
import { BASELINE, computeProcess } from "@/features/capacity/capacityModel";

/*
 * Base da meta (D39, D47, D53), lotação padrão e capacidade de cada máquina,
 * para as telas de Metas e Apontamento.
 *
 * A CONTA da meta não mora aqui: é `metaDoTurno` de src/lib/metas.ts, a mesma
 * regra do `least(...)` da view production_summary (D48, D49). Se a tela
 * calculasse por conta própria, ela e o relatório divergiriam.
 *
 * Os VALORES de partida são de demonstração. Com o backend:
 * - base         → data.targets.getMetas(...).metasInfo[id].basis
 * - lotação      → machines.standard_operator_count
 * - capacidade   → continua vindo do simulador (é teto, não meta — D40)
 */

export const BASE_OPTIONS: Array<{ value: BaseDaMeta; label: string; hint: string }> = [
  { value: "per_shift", label: "Por turno", hint: "A lotação não muda nada" },
  { value: "per_shift_prorated", label: "Conforme a lotação", hint: "Rateia pela gente que veio, com teto na lotação padrão" },
  { value: "per_operator", label: "Por pessoa", hint: "Multiplica pela gente que veio" },
];
export const baseLabel = (b: BaseDaMeta) => BASE_OPTIONS.find((o) => o.value === b)!.label;

/** Lotação padrão: a maior equipe de um turno na planilha de capacidade */
const CREW: Record<string, number> = Object.fromEntries(
  BASELINE.processes.map((p) => [p.id, Math.max(...p.people)]).filter(([, n]) => (n as number) > 0),
);
export const crewOf = (machineId: string): number | null => CREW[machineId] ?? null;

/**
 * Capacidade por turno do simulador. NÃO é meta (D40): serve de alarme, nunca
 * de fonte. As metas acordadas ficam entre 62% e 86% da capacidade técnica,
 * sem fator único (nota de 01/10, § 5).
 * - technical: peças/min × tempo útil — passar disto é fisicamente impossível
 * - withEfficiency: × eficiência — o que o simulador chama de "meta por turno"
 */
export interface Capacity {
  technical: number;
  withEfficiency: number;
}
export function capacitiesOf(scenario: typeof BASELINE): Record<string, Capacity> {
  return Object.fromEntries(
    scenario.processes
      .filter((p) => p.rate != null)
      .map((p) => {
        const r = computeProcess(scenario, p);
        return [p.id, { technical: Math.round(r.technical), withEfficiency: Math.round(r.perShift) }];
      }),
  );
}
const CAPACITY = capacitiesOf(BASELINE);
export const baselineCapacity = (machineId: string): Capacity | null => CAPACITY[machineId] ?? null;

/* ---------- Base vigente de cada máquina (estado compartilhado pelas telas) ---------- */
// Demonstração: horizontais rateiam pela lotação; a bancada a granel é por pessoa; o resto, por turno
const INITIAL_BASES: Record<string, BaseDaMeta> = { e3: "per_shift_prorated", e4: "per_shift_prorated", e9: "per_operator" };
let bases: Record<string, BaseDaMeta> = INITIAL_BASES;
/** A base com que os números de março foram fechados (a meta mensal original vale só com ela) */
export const initialBaseOf = (machineId: string): BaseDaMeta => INITIAL_BASES[machineId] ?? "per_shift";
const listeners = new Set<() => void>();

export const baseOf = (machineId: string): BaseDaMeta => bases[machineId] ?? "per_shift";

/** Grava as bases ALTERADAS. Máquina fora do mapa mantém a que tinha (nota de 01/10, § 4.1). */
export function saveBases(changed: Record<string, BaseDaMeta>) {
  bases = { ...bases, ...changed };
  listeners.forEach((l) => l());
}

export function useBases(): Record<string, BaseDaMeta> {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => bases,
  );
}

/** Meta do turno desta máquina, pela regra única de src/lib/metas.ts */
export function shiftMeta(machineId: string, cadastrada: number, base: BaseDaMeta, pessoas?: number | string | null): MetaDoTurno {
  return metaDoTurno({ cadastrada, base, pessoas, lotacaoPadrao: crewOf(machineId) });
}

export { dependeDaLotacao };
