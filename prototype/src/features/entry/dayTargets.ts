import { useEffect, useState } from "react";
import type { BaseDaMeta } from "../../../../src/lib/metas";
import { mensagemDeErro } from "../../../../src/lib/erros";
import { DATA_ORIGIN, MACHINES, META_EFFECTIVE_FROM, metaPerShift, toIsoDate } from "@/data/machines";
import { useAccess } from "@/features/access/AccessContext";
import { baseOf, crewOf } from "@/features/metas/metaBase";

/*
 * A meta que vale NA DATA apontada, não a de hoje. O apontamento guarda uma foto
 * da meta do seu dia (D08): quem lança um turno atrasado precisa ver a meta
 * daquele dia, senão a tela mostra uma conta e o banco grava outra.
 *
 * O número final do turno sai sempre de `metaDoTurno` (src/lib/metas.ts), com a
 * base e a lotação padrão daqui. Quem grava a meta de verdade é o banco
 * (`save_production_record` congela a meta do dia); a tela só mostra antes.
 */

export interface DayTarget {
  /** meta cadastrada (por turno, ou por pessoa na base per_operator) */
  cadastrada: number;
  base: BaseDaMeta;
  /** lotação padrão do posto; null = o banco não conhece */
  lotacao: number | null;
  /** desde quando vale este degrau ("2026-09-27"); vazio = não informado */
  since: string;
}

/**
 * Onde a meta é por pessoa, o nº de operadores é obrigatório (D54): o banco
 * recusa o apontamento sem ele. Espelha `exigeOperadores` de src/lib/metas.ts,
 * que está no branch da sessão do banco (claude/operadores-obrigatorios) e
 * ainda não chegou à main; quando chegar, importar de lá e apagar esta cópia.
 */
export const exigeOperadores = (base?: BaseDaMeta | null) => base === "per_operator";

export type DayTargets =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; byMachine: Record<string, DayTarget> };

/** Demonstração: as metas e bases da tela de Metas (dados fictícios) */
function demoTargets(): Record<string, DayTarget> {
  return Object.fromEntries(
    MACHINES.map((m) => [
      m.id,
      { cadastrada: m.hasTarget ? metaPerShift(m) : 0, base: baseOf(m.id), lotacao: crewOf(m.id), since: toIsoDate(META_EFFECTIVE_FROM) },
    ]),
  );
}

export function useDayTargets(date: string, attempt = 0): DayTargets {
  const { client, session } = useAccess();
  const live = DATA_ORIGIN === "backend" && !!client.reads;
  const [state, setState] = useState<DayTargets>(() => (live ? { status: "loading" } : { status: "ready", byMachine: demoTargets() }));

  useEffect(() => {
    if (!live || !client.reads) {
      setState({ status: "ready", byMachine: demoTargets() });
      return;
    }
    let alive = true;
    setState({ status: "loading" });
    const reads = client.reads;
    Promise.all([reads.targets.getMetasEm(date, session), reads.machines.getMachines(session)])
      .then(([targets, machines]) => {
        if (!alive) return;
        const all = machines.allMachines ?? machines.machines ?? [];
        const byMachine: Record<string, DayTarget> = {};
        for (const m of all) {
          byMachine[String(m.id)] = {
            cadastrada: targets.metas[m.id] ?? 0,
            base: targets.metasInfo[m.id]?.basis ?? "per_shift",
            lotacao: m.standardOperatorCount && m.standardOperatorCount > 0 ? m.standardOperatorCount : null,
            since: targets.metasInfo[m.id]?.vigenciaInicio ?? "",
          };
        }
        setState({ status: "ready", byMachine });
      })
      .catch((e) => alive && setState({ status: "error", message: mensagemDeErro(e, "Não foi possível carregar as metas do dia.") }));
    return () => {
      alive = false;
    };
    // A sessão muda de objeto a cada renovação de token; a data é o que importa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, client, date, attempt]);

  return state;
}
