import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/Checkbox";
import { Skeleton } from "@/components/ui/Feedback";

export type SortDirection = "ascending" | "descending";
export interface SortState {
  columnId: string;
  direction: SortDirection;
}

export interface Column<T> {
  id: string;
  header: string;
  /** Rótulo visível diferente do acessível (opcional) */
  srHeader?: string;
  align?: "start" | "end";
  sortable?: boolean;
  className?: string;
  cell: (row: T) => ReactNode;
  footer?: ReactNode;
  skeleton?: ReactNode;
}

export type TableState = "ready" | "loading" | "empty" | "error";

interface DataTableProps<T> {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  getRowLabel: (row: T) => string;
  state?: TableState;
  /** false = sem coluna de seleção (ex.: grades de leitura) */
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  activeRowId?: string | null;
  onRowActivate?: (row: T) => void;
  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  emptyState?: ReactNode;
  errorState?: ReactNode;
  footerLead?: ReactNode;
  skeletonRows?: number;
}

/*
 * Tabela densa: linhas de 36px, cabeçalho em font.body.small/text.subtlest,
 * hover background.neutral.subtle.hovered, selecionada background.selected.
 * Container com radius.xlarge. Nenhuma coluna é fixa: ao rolar na
 * horizontal (mobile), a tabela inteira anda junto; a sombra na borda
 * direita indica que há mais colunas.
 */
const EMPTY = new Set<string>();

export function DataTable<T>({
  caption,
  columns,
  rows,
  getRowId,
  getRowLabel,
  state = "ready",
  selectable = true,
  selectedIds = EMPTY,
  onSelectionChange = () => {},
  activeRowId,
  onRowActivate,
  sort,
  onSortChange,
  emptyState,
  errorState,
  footerLead,
  skeletonRows = 6,
}: DataTableProps<T>) {
  const [moreRight, setMoreRight] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Sombra de overflow na borda direita enquanto houver colunas escondidas
  const measure = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setMoreRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);
  const ids = rows.map(getRowId);
  const allSelected = ids.length > 0 && ids.every((id) => selectedIds.has(id));
  const someSelected = !allSelected && ids.some((id) => selectedIds.has(id));
  const isReady = state === "ready";
  // Rodapé só quando há o que mostrar (total ou contagem)
  const hasFooter = footerLead != null || columns.some((c) => c.footer != null);

  const toggleAll = () => onSelectionChange(allSelected ? new Set() : new Set(ids));
  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const cycleSort = (columnId: string) => {
    if (!onSortChange) return;
    if (sort?.columnId !== columnId) onSortChange({ columnId, direction: "descending" });
    else if (sort.direction === "descending") onSortChange({ columnId, direction: "ascending" });
    else onSortChange(null);
  };

  const onRowKeyDown = (e: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    const target = e.currentTarget;
    if (e.target !== target) return; // teclas dentro de checkbox/menus seguem o fluxo normal
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onRowActivate?.(row);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const sibling = (e.key === "ArrowDown" ? target.nextElementSibling : target.previousElementSibling) as
        | HTMLElement
        | null;
      sibling?.focus();
    }
  };

  const selectCell = "w-500 p-0";

  const alignClass = (col: Column<T>) => (col.align === "end" ? "text-right" : "text-left");

  return (
    <div className="relative overflow-hidden rounded-xlarge border bg-surface">
      {moreRight && (
        <span aria-hidden className="clip-shadow-left pointer-events-none absolute inset-y-0 right-0 z-sticky w-px shadow-overflow" />
      )}
      <div ref={scrollerRef} className="scrollbar-thin overflow-x-auto" onScroll={measure}>
        <table className="w-full border-collapse" aria-busy={state === "loading" || undefined}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="h-row-header">
              {selectable && (
              <th scope="col" className={selectCell}>
                <span className="flex w-500 justify-center">
                <Checkbox
                  label="Selecionar todas as linhas"
                  checked={allSelected}
                  isIndeterminate={someSelected}
                  onChange={toggleAll}
                  disabled={!isReady}
                />
                </span>
              </th>
              )}
              {columns.map((col, i) => {
                const isSorted = sort?.columnId === col.id;
                return (
                  <th
                    key={col.id}
                    scope="col"
                    aria-sort={isSorted ? sort!.direction : col.sortable ? "none" : undefined}
                    className={cn(
                      "whitespace-nowrap px-100 font-body-small font-medium text-subtlest",
                      alignClass(col),
                      !selectable && i === 0 && "pl-200",
                      col.className,
                    )}
                  >
                    {col.sortable && isReady ? (
                      <button
                        type="button"
                        onClick={() => cycleSort(col.id)}
                        className={cn(
                          "group -mx-050 inline-flex items-center gap-050 rounded-small px-050 py-025 transition-colors duration-hover ease-out hover:bg-neutral-subtle-hovered hover:text-default",
                          col.align === "end" && "flex-row-reverse",
                          isSorted && "text-default",
                        )}
                      >
                        {col.header}
                        {isSorted ? (
                          sort!.direction === "descending" ? (
                            <ArrowDown aria-hidden className="size-icon-small text-icon" />
                          ) : (
                            <ArrowUp aria-hidden className="size-icon-small text-icon" />
                          )
                        ) : (
                          <ArrowUpDown
                            aria-hidden
                            className="size-icon-small text-icon-subtlest opacity-0 transition-opacity duration-hover ease-out group-hover:opacity-100 group-focus-visible:opacity-100"
                          />
                        )}
                      </button>
                    ) : (
                      <span>{col.header}</span>
                    )}
                    {col.srHeader && <span className="sr-only">{col.srHeader}</span>}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {state === "loading" &&
              Array.from({ length: skeletonRows }, (_, r) => (
                <tr key={r} className="h-row border-t">
                  {selectable && (
                    <td className={selectCell}>
                      <span className="flex w-500 justify-center">
                        <Skeleton className="size-checkbox rounded-xsmall" />
                      </span>
                    </td>
                  )}
                  {columns.map((col, i) => (
                    <td key={col.id} className={cn("px-100", !selectable && i === 0 && "pl-200")}>
                      <span className={cn("flex", col.align === "end" && "justify-end")}>
                        {col.skeleton ?? <Skeleton className="h-150 w-1000" />}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}


            {isReady &&
              rows.map((row) => {
                const id = getRowId(row);
                const isSelected = selectedIds.has(id);
                const isActive = activeRowId === id;
                // Marca à esquerda da linha aberta no painel
                const activeMark = isActive && (
                  <span aria-hidden className="absolute inset-y-0 left-0 w-splitter-line bg-icon-brand" />
                );
                return (
                  <tr
                    key={id}
                    tabIndex={onRowActivate ? 0 : undefined}
                    aria-selected={selectable ? isSelected : undefined}
                    aria-current={isActive || undefined}
                    aria-label={getRowLabel(row)}
                    onClick={() => onRowActivate?.(row)}
                    onKeyDown={(e) => onRowKeyDown(e, row)}
                    className={cn(
                      "group/row h-row border-t transition-colors duration-hover ease-out focus-visible:outline-offset-inset",
                      onRowActivate && "cursor-pointer",
                      isSelected || isActive ? "bg-selected" : "hover:bg-neutral-subtle-hovered",
                    )}
                  >
                    {selectable && (
                    <td className={cn("relative", selectCell)} onClick={(e) => e.stopPropagation()}>
                      {activeMark}
                      <span className="flex w-500 justify-center">
                        <Checkbox
                          label={`Selecionar ${getRowLabel(row)}`}
                          checked={isSelected}
                          onChange={() => toggleOne(id)}
                        />
                      </span>
                    </td>
                    )}
                    {columns.map((col, i) => (
                      <td
                        key={col.id}
                        className={cn(
                          "whitespace-nowrap px-100",
                          alignClass(col),
                          !selectable && i === 0 && "relative pl-200",
                          col.className,
                        )}
                      >
                        {!selectable && i === 0 && activeMark}
                        {col.cell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
          </tbody>

          {isReady && hasFooter && (
            <tfoot>
              <tr className="h-row border-t bg-surface-sunken">
                {selectable && <td className={selectCell} />}
                {columns.map((col, i) => (
                  <td
                    key={col.id}
                    className={cn(
                      "whitespace-nowrap px-100 font-body-small text-subtle",
                      alignClass(col),
                      !selectable && i === 0 && "pl-200",
                    )}
                  >
                    {i === 0 ? footerLead : col.footer}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {/*
       * Vazio e erro ficam fora da área que rola de lado: numa tabela mais larga
       * que a tela (celular), a mensagem acompanha a largura visível do cartão.
       */}
      {state === "empty" && <div className="border-t">{emptyState}</div>}
      {state === "error" && <div className="border-t p-200">{errorState}</div>}
    </div>
  );
}
