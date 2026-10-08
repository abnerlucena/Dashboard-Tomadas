import { goodQuantity, type ProductionOrder } from "@/data/machines";

/**
 * Produção do dia e % da meta diária. O total de unidades soma todas as
 * máquinas; o percentual compara só a produção das máquinas com meta com a meta
 * delas (os centros por demanda produzem, mas não têm meta), como o Dashboard.
 */
export function dayProgress(orders: ProductionOrder[], target: number, hasTarget: (machineId: string) => boolean) {
  const total = goodQuantity(orders);
  const withTarget = goodQuantity(orders.filter((o) => hasTarget(o.machineId)));
  return { total, percent: target ? Math.round((withTarget / target) * 100) : null };
}
