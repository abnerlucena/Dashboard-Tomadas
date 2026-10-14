import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface BarItem {
  id: string;
  label: string;
  value: number;
  /** texto do valor (ex.: "27,5%") — o número sempre aparece em texto */
  display: string;
  /** conteúdo extra ao lado do valor (lozenge, variação…) */
  accessory?: ReactNode;
  /** sobrescreve a cor da barra (ex.: acima do limite) */
  barClass?: string;
}

interface BarListProps {
  items: BarItem[];
  /** valor que corresponde à barra cheia (padrão: o maior valor) */
  max?: number;
  /** linha de referência (ex.: limite de 10%) */
  reference?: { value: number; label: string };
  barClass?: string;
  label: string;
  /** coluna de rótulo mais larga, para nomes longos */
  wideLabels?: boolean;
}

/**
 * Barras horizontais de uma série: rótulo | trilho | valor. Espessura ≤ 24px,
 * ponta de 4px arredondada e base reta. Referência tracejada opcional.
 */
export function BarList({ items, max, reference, barClass = "bg-chart-brand", label, wideLabels }: BarListProps) {
  const grid = wideLabels ? "grid-cols-attainment-wide" : "grid-cols-attainment";
  const top = Math.max(max ?? 0, ...items.map((i) => i.value), reference?.value ?? 0) || 1;
  const refLeft = reference ? `${(reference.value / top) * 100}%` : null;

  return (
    <figure className="flex flex-col" aria-label={label}>
      {reference && (
        <div aria-hidden className={cn("grid pb-050", grid)}>
          <span />
          <span className="relative mr-150 h-200">
            <span className="absolute -translate-x-1/2 whitespace-nowrap font-body-small text-subtlest" style={{ left: refLeft! }}>
              {reference.label}
            </span>
          </span>
          <span />
        </div>
      )}
      <ul className="flex flex-col">
        {items.map((item) => (
          <li key={item.id} className={cn("grid items-center py-075", grid)}>
            <span title={item.label} className="truncate pr-100 text-default">
              {item.label}
            </span>
            <span className="relative mr-150 flex h-250 items-center">
              {refLeft && (
                <span aria-hidden className="absolute inset-y-0 border-l border-dashed border-chart-target" style={{ left: refLeft }} />
              )}
              <span
                aria-hidden
                className={cn("h-full rounded-r-small", item.barClass ?? barClass)}
                style={{ width: `${(item.value / top) * 100}%` }}
              />
            </span>
            <span className="flex items-center gap-100">
              <span className="font-medium tabular-nums text-default">{item.display}</span>
              {item.accessory}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
