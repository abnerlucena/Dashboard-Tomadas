import { BarChart3, Table2 } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Feedback";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

/* ---------- Legenda: o formato espelha a marca (barra = bloco, linha = traço) ---------- */
export interface LegendItem {
  label: string;
  shape: "rect" | "line" | "dashed";
  /** classe de fundo (rect/line) ou de borda (dashed) */
  colorClass: string;
}

export function Legend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-200 gap-y-050", className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-075 font-body-small text-subtle">
          {item.shape === "rect" && <span aria-hidden className={cn("size-100 rounded-xsmall", item.colorClass)} />}
          {item.shape === "line" && <span aria-hidden className={cn("h-splitter-line w-250 rounded-full", item.colorClass)} />}
          {item.shape === "dashed" && <span aria-hidden className={cn("w-250 border-t-thick border-dashed", item.colorClass)} />}
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/* ---------- Tabela simples (visão acessível de cada gráfico) ---------- */
export function MiniTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: Array<{ header: string; align?: "start" | "end" }>;
  rows: ReactNode[][];
}) {
  return (
    <div className="scrollbar-thin max-h-chart-large overflow-auto rounded-large border">
      <table className="w-full border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-surface-raised">
          <tr className="h-row-header">
            {columns.map((c) => (
              <th
                key={c.header}
                scope="col"
                className={cn(
                  "whitespace-nowrap px-150 font-body-small font-medium text-subtlest",
                  c.align === "end" ? "text-right" : "text-left",
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="h-row border-t">
              {row.map((cell, i) => (
                <td
                  key={i}
                  className={cn(
                    "whitespace-nowrap px-150 tabular-nums",
                    columns[i].align === "end" ? "text-right" : "text-left",
                    i === 0 ? "text-default" : "text-subtle",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Cartão de gráfico ---------- */
interface ChartCardProps {
  title: string;
  subtitle?: string;
  legend?: LegendItem[];
  table: ReactNode;
  isLoading?: boolean;
  /** Recarregando: mantém o quadro anterior com opacidade reduzida (sem skeleton, sem salto) */
  isRefetching?: boolean;
  className?: string;
  children: ReactNode;
}

export function ChartCard({ title, subtitle, legend, table, isLoading, isRefetching, className, children }: ChartCardProps) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={cn("flex min-w-0 flex-col gap-200 rounded-large bg-surface-raised p-250 shadow-raised", className)}
    >
      <header className="flex flex-wrap items-start justify-between gap-150">
        <div className="min-w-0">
          <h3 id={titleId} className="font-heading-small text-default">
            {title}
          </h3>
          {subtitle && <p className="mt-025 font-body-small text-subtlest">{subtitle}</p>}
        </div>
        <SegmentedControl
          label={`Modo de exibição: ${title}`}
          value={view}
          onChange={(v) => setView(v as "chart" | "table")}
          options={[
            { value: "chart", label: "Gráfico", icon: BarChart3 },
            { value: "table", label: "Tabela", icon: Table2 },
          ]}
        />
      </header>
      {legend && view === "chart" && !isLoading && <Legend items={legend} />}
      {isLoading ? (
        <Skeleton className="h-chart w-full rounded-medium" />
      ) : (
        <div
          aria-busy={isRefetching || undefined}
          className={cn("transition-opacity duration-menu ease-out", isRefetching && "opacity-refetch")}
        >
          {view === "chart" ? children : table}
        </div>
      )}
    </section>
  );
}
