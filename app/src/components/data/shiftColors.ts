// ─── Cor e legenda por turno ──────────────────────────────────
// Fora de StackedBar.tsx de propósito: um arquivo que exporta componente E
// constantes perde o recarregamento a quente (react-refresh).
import { SHIFTS, SHIFT_META, type Shift } from "@/data/machines";
import type { LegendItem } from "@/components/data/Chart";

/** Cor fixa por turno (paleta categórica validada) — a cor segue a entidade, nunca a posição */
export const SHIFT_FILL: Record<Shift, string> = {
  1: "bg-chart-categorical-1",
  2: "bg-chart-categorical-2",
  3: "bg-chart-categorical-3",
};

export const SHIFT_LEGEND: LegendItem[] = SHIFTS.map((s) => ({
  label: `${SHIFT_META[s].label} · ${SHIFT_META[s].hours}`,
  shape: "rect",
  colorClass: SHIFT_FILL[s],
}));
