// ─── Legendas dos gráficos ────────────────────────────────────
// Fora do index de propósito: lá só ficam componentes, para não perder o
// recarregamento a quente (react-refresh).
import type { LegendItem } from "@/components/data/Chart";

/* Legendas em HTML (acima do gráfico): o formato espelha a marca */
/** Acumulado: cada leitura compara a mesma base dos dois lados */
export const BURNUP_LEGEND = {
  recorded: [
    { label: "Produção que conta", shape: "line", colorClass: "bg-chart-brand" },
    { label: "Meta dos turnos apontados", shape: "dashed", colorClass: "border-chart-target" },
  ],
  calendar: [
    { label: "Produção total", shape: "line", colorClass: "bg-chart-brand" },
    { label: "Meta do calendário", shape: "dotted", colorClass: "border-chart-target" },
  ],
} satisfies Record<string, LegendItem[]>;

export const DAILY_LEGEND: LegendItem[] = [
  { label: "Acima da meta diária", shape: "rect", colorClass: "bg-chart-brand" },
  { label: "Abaixo da meta diária", shape: "rect", colorClass: "bg-chart-neutral" },
  { label: "Meta diária", shape: "dashed", colorClass: "border-chart-target" },
];
