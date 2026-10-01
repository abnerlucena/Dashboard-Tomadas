import { CalendarPlus, ChevronLeft, ChevronRight, ClipboardList, MessageSquare, MoreHorizontal, Pencil, Repeat, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ALL_ORDERS,
  DATA_END,
  DATA_ORIGIN,
  DATA_START,
  MACHINES,
  SHIFTS,
  SHIFT_META,
  STATUS_META,
  endOfMonth,
  fromIsoDate,
  goodQuantity,
  isWeekendDate as isWeekend,
  machineById,
  opLabel,
  sameDay,
  statusFor,
  targetOn,
  toIsoDate,
  type ProductionOrder,
  type Shift,
} from "@/data/machines";
import { cn, formatCompactShort, formatLongDate, formatNumber, type Notify } from "@/lib/utils";
import { DataTable, type Column } from "@/components/data/DataTable";
import { MonthCalendar } from "@/components/data/MonthCalendar";
import { StackedBar } from "@/components/data/StackedBar";
import { SHIFT_FILL } from "@/components/data/shiftColors";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { Button, IconButton } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { EmptyState } from "@/components/ui/Feedback";
import { Lozenge } from "@/components/ui/Lozenge";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from "@/components/ui/Menu";
import { Modal } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextArea, TextField } from "@/components/ui/TextField";
import { DateField } from "@/components/ui/DateField";
import { Tooltip } from "@/components/ui/Tooltip";
import { useAccess } from "@/features/access/AccessContext";

const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const monthTitle = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** Dia a abrir ao trocar de mês: o último com dados, ou o último dia útil do mês */
function landingDay(year: number, month: number) {
  if (year === DATA_END.getFullYear() && month === DATA_END.getMonth()) return DATA_END;
  let d = new Date(year, month + 1, 0);
  while (isWeekend(d)) d = addDays(d, -1);
  return d < DATA_START ? DATA_START : d;
}

type Dialog =
  | { kind: "delete"; ids: string[] }
  | { kind: "move"; ids: string[]; day: string }
  | { kind: "edit"; order: ProductionOrder; draft: { qty: string; shift: Shift; rework: boolean; note: string } }
  | null;

export function HistoryPage({ notify }: { notify: Notify }) {
  const [orders, setOrders] = useState<ProductionOrder[]>(ALL_ORDERS);
  // O que cada perfil pode corrigir (a tela esconde; quem barra de verdade é o banco).
  // Com dados do banco, por ora, só leitura: as correções ainda não gravam lá.
  const { can: canDo, session } = useAccess();
  const readOnly = DATA_ORIGIN === "backend";
  const can = (p: Parameters<typeof canDo>[0]) => !readOnly && canDo(p);
  const canEdit = (o: ProductionOrder) => can("production.edit") || (can("production.edit_own") && o.operator === session?.nome);
  const canDelete = can("production.delete");
  const canBulkEdit = can("production.bulk_edit");
  const canBulkDelete = can("production.bulk_delete");
  /** Limites de navegação: da janela de dados até o fim do mês do último dado (dias futuros aparecem, sem ação) */
  const LAST_DAY = endOfMonth(DATA_END);
  /** Meta do dia: com o banco, a soma das metas dos turnos apontados; na demonstração, a meta diária da fábrica */
  const dayTarget = (d: Date) => targetOn(MACHINES, d);
  // Dia aberto (data completa: o calendário navega entre os meses da janela de dados)
  const [date, setDate] = useState<Date>(DATA_END);
  const year = date.getFullYear();
  const month = date.getMonth();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<Dialog>(null);
  // Filtro de turno da tabela do dia (o resumo do dia continua com todos)
  const [shiftFilter, setShiftFilter] = useState<Shift | "all">("all");

  const byDay = useMemo(() => {
    const map = new Map<string, ProductionOrder[]>();
    for (const o of orders) map.set(toIsoDate(o.date), [...(map.get(toIsoDate(o.date)) ?? []), o]);
    return map;
  }, [orders]);

  const allDayOrders = (byDay.get(toIsoDate(date)) ?? []).slice().sort((a, b) => a.shift - b.shift || a.machineId.localeCompare(b.machineId));
  const dayOrders = shiftFilter === "all" ? allDayOrders : allDayOrders.filter((o) => o.shift === shiftFilter);
  // Produção = só a boa (D11); o retrabalho continua listado, com a marca
  const dayTotal = goodQuantity(allDayOrders);
  const visibleTotal = goodQuantity(dayOrders);
  const byShift = Object.fromEntries(SHIFTS.map((sh) => [sh, goodQuantity(allDayOrders.filter((o) => o.shift === sh))])) as Record<Shift, number>;
  const openTarget = dayTarget(date);
  const dayPct = openTarget ? Math.round((dayTotal / openTarget) * 100) : 0;
  const isFuture = date > DATA_END;

  const selectDate = (d: Date) => {
    setDate(d);
    setSelected(new Set());
  };
  // Dia útil anterior/seguinte (pula fim de semana e atravessa meses), dentro da janela de dados
  const stepDay = (dir: 1 | -1) => {
    let d = addDays(date, dir);
    while (d >= DATA_START && d <= LAST_DAY && isWeekend(d)) d = addDays(d, dir);
    return d >= DATA_START && d <= LAST_DAY ? d : null;
  };
  const prevDay = stepDay(-1);
  const nextDay = stepDay(1);
  // Mês anterior/seguinte, se ainda estiver dentro da janela
  const prevMonth = new Date(year, month, 0) >= DATA_START ? landingDay(year, month - 1) : null;
  const nextMonth = new Date(year, month + 1, 1) <= DATA_END ? landingDay(year, month + 1) : null;

  /* ---------- Ações (estado local; "Desfazer" restaura a lista anterior) ---------- */
  const apply = (next: ProductionOrder[], title: string, description: string) => {
    const previous = orders;
    setOrders(next);
    setSelected(new Set());
    setDialog(null);
    notify(title, description, "success", { label: "Desfazer", onClick: () => setOrders(previous) });
  };
  const plural = (n: number) => `${n} ${n === 1 ? "apontamento" : "apontamentos"}`;

  const remove = (ids: string[]) => apply(orders.filter((o) => !ids.includes(o.id)), `${plural(ids.length)} ${ids.length === 1 ? "excluído" : "excluídos"}`, formatLongDate(date));
  const changeShift = (ids: string[], shift: Shift) =>
    apply(
      orders.map((o) => (ids.includes(o.id) ? { ...o, shift } : o)),
      `${plural(ids.length)} ${ids.length === 1 ? "movido" : "movidos"} para o ${SHIFT_META[shift].label.toLowerCase()}`,
      formatLongDate(date),
    );
  const moveTo = (ids: string[], target: string) => {
    const newDate = fromIsoDate(target);
    const recorded = (o: ProductionOrder) => new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate(), o.recordedAt.getHours(), o.recordedAt.getMinutes());
    apply(
      orders.map((o) => (ids.includes(o.id) ? { ...o, date: newDate, recordedAt: recorded(o) } : o)),
      `${plural(ids.length)} ${ids.length === 1 ? "movido" : "movidos"} para ${formatLongDate(newDate)}`,
      `Antes em ${formatLongDate(date)}`,
    );
  };
  const saveEdit = () => {
    if (dialog?.kind !== "edit") return;
    const { order, draft } = dialog;
    apply(
      orders.map((o) =>
        o.id === order.id
          ? {
              ...o,
              quantity: Number(draft.qty),
              shift: draft.shift,
              rework: draft.rework,
              reworkReason: draft.rework ? (o.reworkReason ?? "Não informado") : null,
              note: draft.note.trim() ? { id: o.note?.id ?? `n-${o.id}`, text: draft.note.trim(), author: o.note?.author ?? o.operator } : null,
            }
          : o,
      ),
      "Apontamento atualizado",
      `${order.opId} · ${machineById(order.machineId).name}`,
    );
  };

  const moveError =
    dialog?.kind === "move"
      ? !dialog.day
        ? "Escolha uma data"
        : isWeekend(fromIsoDate(dialog.day))
          ? "Escolha um dia útil"
          : fromIsoDate(dialog.day) > DATA_END
            ? "Não é possível apontar em datas futuras"
            : sameDay(fromIsoDate(dialog.day), date)
              ? "Escolha uma data diferente da atual"
              : null
      : null;
  const editError =
    dialog?.kind === "edit" && (!/^\d+$/.test(dialog.draft.qty) || Number(dialog.draft.qty) <= 0) ? "Use um número inteiro maior que zero" : null;

  const columns: Column<ProductionOrder>[] = [
    {
      // Nome pode quebrar em duas linhas: a tabela cabe na largura sem rolagem lateral
      id: "machine",
      header: "Máquina",
      cell: (o) => (
        <span className="block w-column-name whitespace-normal py-075 font-medium text-default">{machineById(o.machineId).name}</span>
      ),
    },
    {
      id: "shift",
      header: "Turno",
      cell: (o) => (
        // o cabeçalho já diz "Turno": na célula, só a cor e o número
        <span className="flex items-center gap-075" aria-label={SHIFT_META[o.shift].label}>
          <span aria-hidden className={cn("size-dot rounded-full", SHIFT_FILL[o.shift])} />
          <span aria-hidden className="tabular-nums">{o.shift}</span>
        </span>
      ),
    },
    {
      // OP em cima, material (código + descrição) embaixo: o material anda com a OP
      id: "op",
      header: "OP e material",
      cell: (o) => (
        <span className="flex flex-col py-075" title={o.material ? `${o.opId} · material ${o.material} · ${o.product}` : undefined}>
          <span className="font-code text-default">{opLabel(o)}</span>
          {/* Material: o banco ainda não guarda (lacuna 1) */}
          {o.material && (
            <span className="flex items-baseline gap-075 font-body-small text-subtlest">
              <span className="font-code">{o.material}</span>
              <span className="max-w-column-text truncate">{o.product}</span>
            </span>
          )}
        </span>
      ),
    },
    {
      id: "qty",
      header: "Quantidade",
      align: "end",
      cell: (o) => <span className="font-medium tabular-nums text-default">{formatNumber(o.quantity)}</span>,
      footer: <span className="font-semibold tabular-nums text-default">{formatNumber(visibleTotal)}</span>,
    },
    {
      // Retrabalho e observação juntos: a maioria dos apontamentos não tem nenhum dos dois
      id: "events",
      header: "Ocorrências",
      cell: (o) =>
        o.rework || o.note ? (
          <span className="flex items-center gap-100">
            {o.rework && (
              <Tooltip content={`Motivo: ${o.reworkReason ?? "não informado"}`}>
                <span tabIndex={0}>
                  <Lozenge appearance="warning">Retrabalho</Lozenge>
                </span>
              </Tooltip>
            )}
            {o.note && (
              <Tooltip content={o.note.text}>
                <span
                  tabIndex={0}
                  aria-label={`Observação: ${o.note.text}`}
                  className={cn("flex items-center gap-075 text-subtle", o.rework ? "max-w-1000" : "max-w-column-text")}
                >
                  <MessageSquare aria-hidden className="size-icon-small shrink-0 text-icon-subtle" />
                  <span className="truncate">{o.note.text}</span>
                </span>
              </Tooltip>
            )}
          </span>
        ) : (
          <span className="text-subtlest">–</span>
        ),
    },
    {
      id: "by",
      header: "Registrado por",
      cell: (o) => (
        <span className="flex flex-col py-075">
          <span className="text-subtle">{o.operator}</span>
          <span className="font-body-small tabular-nums text-subtlest">{time.format(o.recordedAt)}</span>
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      srHeader: "Ações",
      align: "end",
      className: "w-500 pr-150",
      cell: (o) =>
        canEdit(o) || canDelete ? (
          <Menu>
            <MenuTrigger asChild>
              <IconButton icon={MoreHorizontal} label={`Ações para ${o.opId}`} spacing="compact" showTooltip={false} />
            </MenuTrigger>
            <MenuContent align="end">
              {canEdit(o) && (
                <>
                  <MenuItem
                    icon={Pencil}
                    onSelect={() =>
                      setDialog({ kind: "edit", order: o, draft: { qty: String(o.quantity), shift: o.shift, rework: o.rework, note: o.note?.text ?? "" } })
                    }
                  >
                    Editar
                  </MenuItem>
                  <MenuItem icon={CalendarPlus} onSelect={() => setDialog({ kind: "move", ids: [o.id], day: "" })}>
                    Mover para outra data
                  </MenuItem>
                </>
              )}
              {canEdit(o) && canDelete && <MenuSeparator />}
              {canDelete && (
                <MenuItem icon={Trash2} onSelect={() => setDialog({ kind: "delete", ids: [o.id] })}>
                  Excluir
                </MenuItem>
              )}
            </MenuContent>
          </Menu>
        ) : null,
    },
  ];

  const ids = [...selected];

  return (
    <>
      <PageHeader
        title="Histórico"
        description={
          readOnly
            ? "Confira os apontamentos de cada dia. Escolha um dia no calendário ou navegue pelas setas. Correções, por enquanto, pelo sistema atual."
            : "Confira e corrija os apontamentos de cada dia. Escolha um dia no calendário ou navegue pelas setas."
        }
      />
      <PageBody>
        {/* Calendário em cima, na largura toda; o dia escolhido abre embaixo, com a tabela sem rolagem lateral */}
        <div className="flex flex-col gap-400">
          <section aria-label={`Calendário de ${monthTitle.format(date)}`} className="rounded-large bg-surface-raised p-250 shadow-raised">
            <MonthCalendar
              year={year}
              month={month}
              selected={date.getDate()}
              today={year === DATA_END.getFullYear() && month === DATA_END.getMonth() ? DATA_END.getDate() : undefined}
              onSelect={(d) => selectDate(new Date(year, month, d))}
              header={
                <div className="flex items-center gap-100">
                  <h2 aria-live="polite" className="font-heading-small text-default first-letter:uppercase">
                    {monthTitle.format(date)}
                  </h2>
                  {/* Os meses disponíveis vêm da janela de dados (DATA_START → DATA_END) */}
                  <span className="flex gap-050">
                    <IconButton
                      icon={ChevronLeft}
                      label={prevMonth ? "Mês anterior" : "Mês anterior (sem dados)"}
                      spacing="compact"
                      isDisabled={!prevMonth}
                      onClick={() => prevMonth && selectDate(prevMonth)}
                    />
                    <IconButton
                      icon={ChevronRight}
                      label={nextMonth ? "Próximo mês" : "Próximo mês (sem dados)"}
                      spacing="compact"
                      isDisabled={!nextMonth}
                      onClick={() => nextMonth && selectDate(nextMonth)}
                    />
                  </span>
                </div>
              }
              getDay={(d) => {
                const day = new Date(year, month, d);
                const list = byDay.get(toIsoDate(day)) ?? [];
                const total = goodQuantity(list);
                const weekend = isWeekend(day);
                const future = day > DATA_END;
                const target = dayTarget(day);
                const pct = target ? Math.round((total / target) * 100) : 0;
                const st = total && target ? statusFor(pct) : null;
                const when = formatLongDate(day);
                return {
                  caption: total ? formatCompactShort(total) : undefined,
                  percent: st ? pct : undefined,
                  status: st,
                  muted: weekend || future || day < DATA_START,
                  label: st
                    ? `${when}: ${formatNumber(total)} unidades, ${pct}% da meta diária, ${STATUS_META[st].label}`
                    : total
                      ? `${when}: ${formatNumber(total)} unidades, sem meta no dia`
                      : `${when}: ${weekend ? "fim de semana" : future ? "dia futuro" : "sem apontamento"}`,
                };
              }}
            />
          </section>

          {/* ---------- Apontamentos do dia ---------- */}
          <section aria-labelledby="day-title" className="flex min-w-0 flex-col gap-200">
            <div className="flex flex-wrap items-end justify-between gap-200">
              <div className="flex min-w-0 flex-col gap-050">
                <div className="flex items-center gap-100">
                  <IconButton
                    icon={ChevronLeft}
                    label="Dia útil anterior"
                    spacing="compact"
                    isDisabled={!prevDay}
                    onClick={() => prevDay && selectDate(prevDay)}
                  />
                  <IconButton
                    icon={ChevronRight}
                    label="Próximo dia útil"
                    spacing="compact"
                    isDisabled={!nextDay}
                    onClick={() => nextDay && selectDate(nextDay)}
                  />
                  <h2 id="day-title" aria-live="polite" className="font-heading-medium text-default first-letter:uppercase">
                    {formatLongDate(date)}
                  </h2>
                </div>
                {allDayOrders.length > 0 && (
                  <p className="flex flex-wrap items-center gap-100 text-subtle">
                    <span>
                      <span className="font-semibold tabular-nums text-default">{formatNumber(dayTotal)}</span> unidades em {plural(allDayOrders.length)}
                    </span>
                    {openTarget > 0 ? (
                      <Lozenge appearance={STATUS_META[statusFor(dayPct)].appearance}>
                        {dayPct}% da meta diária · {STATUS_META[statusFor(dayPct)].label}
                      </Lozenge>
                    ) : (
                      <Lozenge appearance="neutral">sem meta no dia</Lozenge>
                    )}
                  </p>
                )}
              </div>
              {allDayOrders.length > 0 && (
                <div className="flex flex-wrap items-center gap-200">
                  {/* Divisão do dia por turno; o turno filtrado fica em destaque */}
                  <span className="flex items-center gap-100">
                    <span className="font-body-small text-subtlest">Por turno</span>
                    <StackedBar values={byShift} label={`Produção de ${formatLongDate(date)} por turno`} highlight={shiftFilter === "all" ? null : shiftFilter} />
                  </span>
                  <SegmentedControl
                    label="Filtrar apontamentos por turno"
                    iconOnly={false}
                    value={String(shiftFilter)}
                    onChange={(v) => {
                      setShiftFilter(v === "all" ? "all" : (Number(v) as Shift));
                      setSelected(new Set());
                    }}
                    options={[{ value: "all", label: "Todos" }, ...SHIFTS.map((sh) => ({ value: String(sh), label: SHIFT_META[sh].label }))]}
                  />
                </div>
              )}
            </div>

            {/* Barra de ações em lote */}
            {selected.size > 0 && (
              <div role="toolbar" aria-label="Ações em lote" className="flex flex-wrap items-center gap-100 rounded-large bg-selected px-150 py-100">
                <span className="font-medium text-selected">{selected.size} {selected.size === 1 ? "selecionado" : "selecionados"}</span>
                <span className="mx-050 h-200 border-l border-selected" aria-hidden />
                {canBulkEdit && (
                  <Menu>
                    <MenuTrigger asChild>
                      <Button appearance="subtle" spacing="compact" iconBefore={Repeat}>
                        Alterar turno
                      </Button>
                    </MenuTrigger>
                    <MenuContent>
                      <MenuLabel>Mover para o turno</MenuLabel>
                      <MenuRadioGroup value="" onValueChange={(v) => changeShift(ids, Number(v) as Shift)}>
                        {SHIFTS.map((s) => (
                          <MenuRadioItem key={s} value={String(s)}>
                            {SHIFT_META[s].label} · {SHIFT_META[s].hours}
                          </MenuRadioItem>
                        ))}
                      </MenuRadioGroup>
                    </MenuContent>
                  </Menu>
                )}
                {canBulkEdit && (
                  <Button appearance="subtle" spacing="compact" iconBefore={CalendarPlus} onClick={() => setDialog({ kind: "move", ids, day: "" })}>
                    Mover para outra data
                  </Button>
                )}
                {canBulkDelete && (
                  <Button appearance="subtle" spacing="compact" iconBefore={Trash2} onClick={() => setDialog({ kind: "delete", ids })}>
                    Excluir
                  </Button>
                )}
                <IconButton icon={X} label="Cancelar seleção" spacing="compact" className="ml-auto" onClick={() => setSelected(new Set())} />
              </div>
            )}

            <DataTable
              caption={`Apontamentos de ${formatLongDate(date)}`}
              columns={columns}
              rows={dayOrders}
              getRowId={(o) => o.id}
              getRowLabel={(o) => `${o.opId}, ${machineById(o.machineId).name}, ${SHIFT_META[o.shift].label}, ${formatNumber(o.quantity)} unidades`}
              state={dayOrders.length ? "ready" : "empty"}
              // Seleção só serve para ações em lote
              selectable={canBulkEdit || canBulkDelete}
              selectedIds={selected}
              onSelectionChange={setSelected}
              footerLead={shiftFilter === "all" ? plural(dayOrders.length) : `${plural(dayOrders.length)} no ${SHIFT_META[shiftFilter].label.toLowerCase()}`}
              emptyState={
                <EmptyState
                  icon={ClipboardList}
                  title={
                    isWeekend(date)
                      ? "Fim de semana"
                      : isFuture
                        ? "Dia ainda não chegou"
                        : allDayOrders.length && shiftFilter !== "all"
                          ? `Nenhum apontamento no ${SHIFT_META[shiftFilter].label.toLowerCase()}`
                          : "Nenhum apontamento neste dia"
                  }
                  hint={
                    isWeekend(date) || isFuture
                      ? `Escolha um dia útil até ${formatLongDate(DATA_END)} para ver os apontamentos.`
                      : allDayOrders.length && shiftFilter !== "all"
                        ? "Escolha outro turno ou Todos para ver os demais apontamentos do dia."
                        : "Nenhuma máquina registrou produção neste dia."
                  }
                  action={
                    !isWeekend(date) && !isFuture
                      ? { label: "Fazer apontamento", onClick: () => (window.location.hash = "/apontamento") }
                      : undefined
                  }
                />
              }
            />
          </section>
        </div>
      </PageBody>

      {/* ---------- Diálogos ---------- */}
      <Modal
        open={dialog?.kind === "delete"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Excluir ${dialog?.kind === "delete" ? plural(dialog.ids.length) : ""}?`}
        primary={{ label: "Excluir", appearance: "danger", onClick: () => dialog?.kind === "delete" && remove(dialog.ids) }}
      >
        A produção deixa de contar nos indicadores de {formatLongDate(date)}. Você pode desfazer logo depois pela notificação.
      </Modal>

      <Modal
        open={dialog?.kind === "move"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Mover para outra data"
        primary={{
          label: "Mover",
          onClick: () => dialog?.kind === "move" && !moveError && moveTo(dialog.ids, dialog.day),
        }}
      >
        <p className="mb-200 text-subtle">
          {dialog?.kind === "move" && plural(dialog.ids.length)} de {formatLongDate(date)}. O turno e as quantidades não mudam.
        </p>
        <DateField
          label="Nova data"
          min={toIsoDate(DATA_START)}
          max={toIsoDate(DATA_END)}
          today={toIsoDate(DATA_END)}
          isRequired
          value={dialog?.kind === "move" ? dialog.day : ""}
          onChange={(day) => dialog?.kind === "move" && setDialog({ ...dialog, day })}
          error={dialog?.kind === "move" && dialog.day ? moveError : null}
        />
      </Modal>

      <Modal
        open={dialog?.kind === "edit"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog?.kind === "edit" ? `Editar ${dialog.order.opId}` : ""}
        primary={{ label: "Salvar", onClick: () => !editError && saveEdit() }}
      >
        {dialog?.kind === "edit" && (
          <div className="flex flex-col gap-200">
            <p className="text-subtle">
              {machineById(dialog.order.machineId).name} · {formatLongDate(dialog.order.date)}
            </p>
            <TextField
              label="Quantidade"
              inputMode="numeric"
              value={dialog.draft.qty}
              onChange={(e) => setDialog({ ...dialog, draft: { ...dialog.draft, qty: e.target.value.replace(/[^\d]/g, "") } })}
              error={editError}
              elemAfter="un."
              inputClassName="tabular-nums"
              isRequired
            />
            <div className="flex flex-col gap-050">
              <span className="font-body-small font-semibold text-subtle">Turno</span>
              <SegmentedControl
                label="Turno"
                iconOnly={false}
                value={String(dialog.draft.shift)}
                onChange={(v) => setDialog({ ...dialog, draft: { ...dialog.draft, shift: Number(v) as Shift } })}
                options={SHIFTS.map((s) => ({ value: String(s), label: SHIFT_META[s].label }))}
              />
            </div>
            <label className="flex items-center gap-075 text-default">
              <Checkbox
                label="Retrabalho"
                checked={dialog.draft.rework}
                onChange={(e) => setDialog({ ...dialog, draft: { ...dialog.draft, rework: e.target.checked } })}
              />
              <span aria-hidden>OP de retrabalho</span>
            </label>
            <TextArea
              label="Observação"
              maxLength={500}
              value={dialog.draft.note}
              onChange={(e) => setDialog({ ...dialog, draft: { ...dialog.draft, note: e.target.value } })}
            />
          </div>
        )}
      </Modal>
    </>
  );
}
