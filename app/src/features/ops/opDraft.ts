import { MACHINES, type WorkOrder } from "@/data/machines";

/*
 * Campos de uma OP: cadastrar (com o número) e conferir uma OP "a conferir"
 * (sem o número, que veio do apontamento). Mesmas regras nos dois.
 */

export interface OpDraft {
  number: string;
  machineId: string;
  material: string;
  product: string;
  planned: string;
}

export const emptyDraft = (op?: WorkOrder): OpDraft => ({
  number: op ? op.id.replace("OP ", "") : "",
  machineId: op?.machineId ?? MACHINES[0]?.id ?? "",
  material: op?.material ?? "",
  product: op?.product ?? "",
  planned: op?.planned ? String(op.planned) : "",
});

export function opErrors(d: OpDraft, ops: WorkOrder[], withNumber: boolean) {
  const number = d.number.trim();
  const planned = Number(d.planned);
  const errors = {
    // D57: só números, até 15 dígitos (como no apontamento)
    number: !withNumber
      ? null
      : !/^\d{1,15}$/.test(number)
        ? "Use só números, até 15 dígitos"
        : ops.some((o) => o.id === `OP ${number}`)
          ? "Essa OP já está no sistema"
          : null,
    machine: d.machineId ? null : "Escolha a máquina",
    material: /^\d{1,18}$/.test(d.material) ? null : "Use só os números do código do material",
    product: d.product.trim() ? null : "Informe a descrição do material",
    planned: Number.isInteger(planned) && planned > 0 ? null : "Informe a quantidade pedida",
  };
  return { ...errors, any: Object.values(errors).some(Boolean) };
}
