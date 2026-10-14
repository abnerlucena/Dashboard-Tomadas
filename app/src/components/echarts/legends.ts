// ─── Legendas dos gráficos ────────────────────────────────────
// Fora do index de propósito: lá só ficam componentes, para não perder o
// recarregamento a quente (react-refresh).
import type { LegendItem } from "@/components/data/Chart";

/* Legendas em HTML (acima do gráfico): o formato espelha a marca */
export const BURNUP_LEGEND: LegendItem[] = [
  { label: "Realizado acumulado", shape: "line", colorClass: "bg-chart-brand" },
  { label: "Meta acumulada", shape: "dashed", colorClass: "border-chart-target" },
];

export const DAILY_LEGEND: LegendItem[] = [
  { label: "Acima da meta diária", shape: "rect", colorClass: "bg-chart-brand" },
  { label: "Abaixo da meta diária", shape: "rect", colorClass: "bg-chart-neutral" },
  { label: "Meta diária", shape: "dashed", colorClass: "border-chart-target" },
];
