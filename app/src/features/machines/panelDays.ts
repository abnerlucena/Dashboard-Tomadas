import { goodQuantity, toIsoDate, type ProductionOrder } from "@/data/machines";

export interface DayGroup {
  /** dia local ("2026-03-27"): toISOString passaria para UTC e trocaria o dia fora do fuso de Brasília */
  key: string;
  date: Date;
  /** produção do dia: só a boa, o retrabalho continua listado com a marca (D11) */
  total: number;
  orders: ProductionOrder[];
}

/** Ordens do painel agrupadas por dia, do mais recente para o mais antigo */
export function ordersByDay(orders: ProductionOrder[]): DayGroup[] {
  const map = new Map<string, ProductionOrder[]>();
  for (const o of orders) {
    const key = toIsoDate(o.date);
    map.set(key, [...(map.get(key) ?? []), o]);
  }
  return [...map.entries()]
    .map(([key, list]) => ({ key, date: list[0].date, total: goodQuantity(list), orders: list }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}
