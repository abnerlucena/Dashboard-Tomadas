import { CalendarDays, ClipboardList, Download, History, MoreHorizontal, Plus } from "lucide-react";
import { LINE_ACCENT, STATUS_META, type Machine } from "@/data/machines";
import { formatNumber, formatShortDate } from "@/lib/utils";
import type { Column } from "@/components/data/DataTable";
import { SegmentedBar } from "@/components/data/SegmentedBar";
import { Sparkline } from "@/components/data/Sparkline";
import { IconButton } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Feedback";
import { Lozenge } from "@/components/ui/Lozenge";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/Menu";
import { TagGroup } from "@/components/ui/Tag";

interface ColumnOptions {
  onOpenOrders: (m: Machine) => void;
  onAction: (action: string, m: Machine) => void;
  totals: { produced: number; target: number; percent: number };
}

export function machineColumns({ onOpenOrders, onAction, totals }: ColumnOptions): Column<Machine>[] {
  return [
    {
      id: "name",
      header: "Máquina",
      sortable: true,
      className: "min-w-column-name",
      cell: (m) => <span className="font-medium text-default">{m.name}</span>,
      skeleton: <Skeleton className="h-150 w-1000 xs:w-full" />,
    },
    {
      id: "lines",
      header: "Linha",
      cell: (m) => <TagGroup items={m.lines} accentFor={(l) => LINE_ACCENT[l] ?? "gray"} />,
      skeleton: (
        <span className="flex gap-050">
          <Skeleton className="h-lozenge w-800" />
          <Skeleton className="h-lozenge w-500" />
        </span>
      ),
    },
    {
      id: "days",
      header: "Dias",
      align: "end",
      sortable: true,
      cell: (m) => <span className="tabular-nums text-subtle">{m.days}</span>,
      skeleton: <Skeleton className="h-150 w-300" />,
    },
    {
      id: "produced",
      header: "Produção",
      align: "end",
      sortable: true,
      cell: (m) => <span className="font-medium tabular-nums text-default">{formatNumber(m.produced)}</span>,
      footer: (
        <>
          Soma <span className="font-semibold tabular-nums text-default">{formatNumber(totals.produced)}</span>
        </>
      ),
      skeleton: <Skeleton className="h-150 w-600" />,
    },
    {
      id: "target",
      header: "Meta",
      align: "end",
      sortable: true,
      cell: (m) => <span className="tabular-nums text-subtle">{formatNumber(m.target)}</span>,
      footer: <span className="tabular-nums">{formatNumber(totals.target)}</span>,
      skeleton: <Skeleton className="h-150 w-600" />,
    },
    {
      id: "percent",
      header: "Atingimento",
      sortable: true,
      cell: (m) => (
        <span className="flex items-center gap-100">
          <SegmentedBar percent={m.percent} status={m.status} label={`Atingimento de ${m.name}`} />
          <span aria-hidden className="min-w-500 text-right font-medium tabular-nums text-default">
            {m.percent}%
          </span>
          <Lozenge appearance={STATUS_META[m.status].appearance}>{STATUS_META[m.status].label}</Lozenge>
        </span>
      ),
      footer: (
        <>
          Geral <span className="font-semibold tabular-nums text-default">{totals.percent}%</span>
        </>
      ),
      skeleton: (
        <span className="flex items-center gap-150">
          <Skeleton className="h-segment-height w-1000" />
          <Skeleton className="h-lozenge w-600" />
        </span>
      ),
    },
    {
      id: "trend",
      header: "Tendência",
      srHeader: " (últimos 14 dias úteis)",
      cell: (m) => (
        <Sparkline points={m.trend} threshold={m.dailyTarget} label={`Produção diária de ${m.name}`} />
      ),
      skeleton: <Skeleton className="h-sparkline-height w-1000" />,
    },
    {
      id: "last",
      header: "Último apontamento",
      cell: (m) =>
        m.lastEntry ? (
          <span className="flex items-center gap-075">
            <CalendarDays aria-hidden className="size-icon-small text-icon-subtle" />
            <span className="tabular-nums text-default">{formatShortDate(m.lastEntry.date)}</span>
            <span className="text-subtlest">Turno {m.lastEntry.shift}</span>
          </span>
        ) : (
          <span className="text-subtlest">Sem apontamento</span>
        ),
      skeleton: <Skeleton className="h-150 w-1000" />,
    },
    {
      id: "actions",
      header: "",
      srHeader: "Ações",
      align: "end",
      className: "w-500 pr-150",
      cell: (m) => (
        <span className="flex justify-end" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <Menu>
            <MenuTrigger asChild>
              <IconButton
                icon={MoreHorizontal}
                label={`Ações para ${m.name}`}
                spacing="compact"
                showTooltip={false}
                className="data-[state=open]:bg-neutral-subtle-pressed"
              />
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem icon={ClipboardList} onSelect={() => onOpenOrders(m)}>
                Ver ordens de produção
              </MenuItem>
              <MenuItem icon={Plus} onSelect={() => onAction("entry", m)}>
                Novo apontamento
              </MenuItem>
              <MenuItem icon={History} onSelect={() => onAction("history", m)}>
                Histórico da máquina
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={Download} onSelect={() => onAction("export", m)}>
                Exportar dados
              </MenuItem>
            </MenuContent>
          </Menu>
        </span>
      ),
      skeleton: <Skeleton className="size-control-compact" />,
    },
  ];
}
