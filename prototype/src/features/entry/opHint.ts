import { OP_STAGE_META, type WorkOrder } from "@/data/machines";

/*
 * O número digitado no Apontamento é uma OP liberada desta máquina? (D62)
 * O banco aceita qualquer número válido: OP não cadastrada entra e nasce "a
 * conferir"; OP de outra máquina não é barrada. Por isso a tela só AVISA.
 */

/** OPs que recebem apontamento nesta máquina: as em produção */
export const releasedFor = (ops: WorkOrder[], machineId: string) =>
  ops.filter((op) => op.machineId === machineId && op.stage === "running");

/** Aviso para o número digitado; null = OP liberada desta máquina (ou campo vazio) */
export function opHint(number: string, machineId: string, ops: WorkOrder[], machineName: (id: string) => string): string | null {
  const n = number.trim();
  if (!n) return null;
  const op = ops.find((o) => o.id === `OP ${n}`);
  if (!op) return "OP ainda não cadastrada: entra como “a conferir”";
  if (op.machineId !== machineId) return `Esta OP é da ${machineName(op.machineId)}`;
  if (op.stage === "running") return null;
  return `OP ${OP_STAGE_META[op.stage].label.toLowerCase()}`;
}
