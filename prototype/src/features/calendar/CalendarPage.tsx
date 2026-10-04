import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Info, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Holiday } from "../../../../src/lib/api";
import { mensagemDeErro } from "../../../../src/lib/erros";
import { DATA_ORIGIN, NOW, SHIFTS, fromIsoDate, toIsoDate } from "@/data/machines";
import { reloadBackendData } from "@/data/fromBackend";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { Button, IconButton } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { DateField } from "@/components/ui/DateField";
import { EmptyState, ErrorMessage, Skeleton } from "@/components/ui/Feedback";
import { Lozenge } from "@/components/ui/Lozenge";
import { Modal } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextField } from "@/components/ui/TextField";
import { useAccess } from "@/features/access/AccessContext";
import { cn, plural, type Notify } from "@/lib/utils";
import { planDays, shiftsLabel, toEntry, type CalendarEntry, type HolidayKind } from "./calendarPlan";

/*
 * Calendário: feriados de SC e de Itajaí, paradas e férias coletivas, que o
 * gestor cadastra pelo site (calendar.manage). Contrato: calendar.getHolidays,
 * addHoliday (um dia por chamada), removeHoliday.
 *
 * - "Feriado" é contexto (D16): o dia sai dos dias úteis previstos, mas a
 *   produção apontada nele conta normalmente.
 * - "Dia anulado" tira o dia, ou só os turnos marcados, do cálculo da meta.
 *   O banco resolve isso na leitura (production_summary.is_excluded_day): vale
 *   também para apontamentos já feitos, e remover devolve a meta.
 * - Depois de gravar, recarrega os dados do banco: os dias úteis vêm daqui.
 */

const TYPE_META: Record<HolidayKind, { label: string; appearance: "information" | "warning"; hint: string }> = {
  feriado: {
    label: "Feriado",
    appearance: "information",
    hint: "O dia sai dos dias úteis do mês. Se a fábrica trabalhar, a produção conta normalmente.",
  },
  dia_anulado: {
    label: "Dia anulado",
    appearance: "warning",
    hint: "Parada da fábrica: o dia, ou os turnos marcados, sai do cálculo da meta, inclusive nos apontamentos já feitos.",
  },
};

const weekdayFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });
/** "seg", "ter"... (sem o ponto da abreviação) */
const weekday = (iso: string) => weekdayFmt.format(fromIsoDate(iso)).replace(".", "");
const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long" });
const shortDate = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);

/** Feriados de exemplo da demonstração (nacionais de 2026); gravar fica só nesta aba */
const DEMO: Holiday[] = [
  { id: "d1", date: "2026-01-01", label: "Confraternização Universal", type: "feriado", createdBy: "BrasilAPI" },
  { id: "d2", date: "2026-02-16", label: "Carnaval", type: "feriado", createdBy: "BrasilAPI" },
  { id: "d3", date: "2026-02-17", label: "Carnaval", type: "feriado", createdBy: "BrasilAPI" },
  { id: "d4", date: "2026-03-13", label: "Inventário", type: "dia_anulado", shiftIds: [3], createdBy: "Rafael Souza" },
  { id: "d5", date: "2026-04-03", label: "Sexta-feira Santa", type: "feriado", createdBy: "BrasilAPI" },
  { id: "d6", date: "2026-04-21", label: "Tiradentes", type: "feriado", createdBy: "BrasilAPI" },
  { id: "d7", date: "2026-05-01", label: "Dia do Trabalho", type: "feriado", createdBy: "BrasilAPI" },
  { id: "d8", date: "2026-06-15", label: "Aniversário de Itajaí", type: "feriado", createdBy: "Rafael Souza" },
];

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; entries: CalendarEntry[] };

const entriesOf = (list: Holiday[]) =>
  list
    .map(toEntry)
    .filter((e): e is CalendarEntry => !!e)
    .sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label, "pt-BR"));

export function CalendarPage({ notify }: { notify: Notify }) {
  const { can, session, client } = useAccess();
  const live = DATA_ORIGIN === "backend";
  // No modo Apps Script, só leitura (como Metas e Histórico)
  const writable = !live || (!!client.reads && client.kind !== "gas");
  const canManage = can("calendar.manage") && writable;
  const todayIso = toIsoDate(live ? new Date() : NOW);

  const [load, setLoad] = useState<Load>(() => (live ? { status: "loading" } : { status: "ready", entries: entriesOf(DEMO) }));
  const [attempt, setAttempt] = useState(0);
  const [year, setYear] = useState(() => Number(todayIso.slice(0, 4)));
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<CalendarEntry[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchEntries = useCallback(async () => {
    if (!client.reads) return;
    const r = await client.reads.calendar.getHolidays(session);
    return entriesOf((r.holidays ?? []) as Holiday[]);
    // A sessão muda de objeto a cada renovação de token; a leitura é a mesma
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  useEffect(() => {
    if (!live) return;
    let alive = true;
    setLoad({ status: "loading" });
    fetchEntries()
      .then((entries) => alive && setLoad({ status: "ready", entries: entries ?? [] }))
      .catch((e) => alive && setLoad({ status: "error", message: mensagemDeErro(e, "Não foi possível carregar o calendário.") }));
    return () => {
      alive = false;
    };
  }, [live, fetchEntries, attempt]);

  /** Depois de gravar: a lista desta tela e os dias úteis das outras */
  const refresh = async () => {
    if (!client.reads) return;
    try {
      const [entries] = await Promise.all([fetchEntries(), reloadBackendData(client.reads, session)]);
      setLoad({ status: "ready", entries: entries ?? [] });
    } catch {
      notify("Salvo, mas a tela não atualizou", "Recarregue a página para ver o calendário novo.", "error");
    }
  };

  const entries = load.status === "ready" ? load.entries : [];
  const ofYear = entries.filter((e) => e.date.startsWith(String(year)));
  const months = useMemo(() => {
    const byMonth = new Map<number, CalendarEntry[]>();
    for (const e of ofYear) {
      const m = Number(e.date.slice(5, 7)) - 1;
      byMonth.set(m, [...(byMonth.get(m) ?? []), e]);
    }
    return [...byMonth.entries()];
  }, [ofYear]);
  const years = entries.map((e) => Number(e.date.slice(0, 4)));
  const upcoming = entries.filter((e) => e.date >= todayIso);
  const next = upcoming[0];
  const selectedEntries = ofYear.filter((e) => selected.has(e.id));

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <>
      <PageHeader
        title="Calendário"
        description="Feriados, paradas e férias coletivas. Os dias cadastrados saem dos dias úteis do mês, e a meta prevista se ajusta."
        actions={
          canManage ? (
            <>
              {selectedEntries.length > 0 && (
                <Button appearance="subtle" iconBefore={Trash2} onClick={() => setRemoving(selectedEntries)}>
                  Remover {plural(selectedEntries.length, "dia", "dias")}
                </Button>
              )}
              <Button appearance="primary" iconBefore={CalendarPlus} onClick={() => setAdding(true)} isDisabled={load.status !== "ready"}>
                Cadastrar
              </Button>
            </>
          ) : (
            <Lozenge>Somente leitura</Lozenge>
          )
        }
      />
      <PageBody>
        <div className="flex flex-wrap items-center justify-between gap-200">
          <div className="flex items-center gap-050" role="group" aria-label="Ano">
            <IconButton icon={ChevronLeft} label="Ano anterior" onClick={() => setYear((y) => y - 1)} />
            <span className="min-w-500 text-center font-heading-small tabular-nums" aria-live="polite">
              {year}
            </span>
            <IconButton icon={ChevronRight} label="Próximo ano" onClick={() => setYear((y) => y + 1)} />
            {year !== Number(todayIso.slice(0, 4)) && (
              <Button appearance="subtle" spacing="compact" onClick={() => setYear(Number(todayIso.slice(0, 4)))}>
                Este ano
              </Button>
            )}
          </div>
          {load.status === "ready" && (
            <p className="text-subtle">
              {next
                ? `Próximo: ${next.label}, ${weekday(next.date)} ${shortDate(next.date)}${next.date.slice(0, 4) !== String(year) ? `/${next.date.slice(0, 4)}` : ""}`
                : "Nenhum dia cadastrado daqui para a frente."}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-x-300 gap-y-100">
          {(Object.keys(TYPE_META) as HolidayKind[]).map((t) => (
            <p key={t} className="flex min-w-0 flex-1 basis-kpi-min items-start gap-100 text-subtle">
              <Lozenge appearance={TYPE_META[t].appearance}>{TYPE_META[t].label}</Lozenge>
              <span className="font-body-small">{TYPE_META[t].hint}</span>
            </p>
          ))}
        </div>

        {load.status === "loading" && (
          <div className="flex flex-col gap-150" aria-busy="true" aria-label="Carregando o calendário">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-500 w-full" />
            ))}
          </div>
        )}

        {load.status === "error" && (
          <ErrorMessage
            title="Não foi possível carregar o calendário"
            actions={
              <Button iconBefore={RefreshCw} onClick={() => setAttempt((n) => n + 1)}>
                Tentar de novo
              </Button>
            }
          >
            {load.message}
          </ErrorMessage>
        )}

        {load.status === "ready" && months.length === 0 && (
          <EmptyState
            icon={CalendarDays}
            title={`Nada cadastrado em ${year}`}
            hint={
              years.length > 0
                ? `Há dias cadastrados em ${[...new Set(years)].sort().join(", ")}.`
                : "Cadastre os feriados de Santa Catarina e de Itajaí e as paradas da fábrica."
            }
            action={canManage ? { label: "Cadastrar", icon: CalendarPlus, onClick: () => setAdding(true) } : undefined}
          />
        )}

        {months.map(([month, list]) => (
          <section key={month} aria-labelledby={`mes-${month}`} className="flex flex-col gap-100">
            <h2 id={`mes-${month}`} className="font-heading-small capitalize text-default">
              {monthName.format(new Date(year, month, 1))}
              <span className="ml-100 font-body-small font-normal normal-case text-subtlest">{plural(list.length, "dia", "dias")}</span>
            </h2>
            <ul className="flex flex-col divide-y rounded-large border">
              {list.map((e) => {
                const past = e.date < todayIso;
                return (
                  <li key={e.id} className={cn("flex items-center gap-150 px-150 py-100", selected.has(e.id) && "bg-selected")}>
                    {canManage && (
                      <Checkbox
                        label={`Selecionar ${e.label}, ${shortDate(e.date)}`}
                        checked={selected.has(e.id)}
                        onChange={() => toggle(e.id)}
                      />
                    )}
                    <span className={cn("flex w-500 shrink-0 flex-col items-center leading-tight", past && "text-subtlest")}>
                      <span className="font-heading-small tabular-nums">{e.date.slice(8, 10)}</span>
                      <span className="font-body-small">{weekday(e.date)}</span>
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-050">
                      <span className={cn("truncate font-medium", past ? "text-subtle" : "text-default")}>
                        {e.label || "Sem descrição"}
                      </span>
                      <span className="flex flex-wrap items-center gap-075">
                        {e.isEvent ? (
                          <Lozenge>Evento</Lozenge>
                        ) : (
                          <Lozenge appearance={TYPE_META[e.type].appearance}>{TYPE_META[e.type].label}</Lozenge>
                        )}
                        <span className="font-body-small text-subtle">{shiftsLabel(e.shiftIds)}</span>
                        {e.createdBy && <span className="font-body-small text-subtlest">· {e.createdBy}</span>}
                      </span>
                    </span>
                    {canManage && (
                      <IconButton icon={Trash2} label={`Remover ${e.label}, ${shortDate(e.date)}`} onClick={() => setRemoving([e])} />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </PageBody>

      {adding && (
        <AddDialog
          existing={entries}
          today={todayIso}
          onClose={() => setAdding(false)}
          onSave={async (days, label, type, shiftIds) => {
            if (!live || !client.reads) {
              const added = days.map((date, i) => ({
                id: `n${Date.now()}-${i}`,
                date,
                label,
                type,
                isEvent: false,
                shiftIds,
                createdBy: session?.nome ?? "",
              }));
              setLoad({ status: "ready", entries: [...entries, ...added].sort((a, b) => a.date.localeCompare(b.date)) });
              return { saved: days.length };
            }
            // Um dia por chamada; para no primeiro erro e diz quantos já foram
            let saved = 0;
            try {
              for (const date of days) {
                await client.reads.calendar.addHoliday(date, label, type, session, shiftIds.length ? shiftIds : undefined);
                saved++;
              }
            } catch (e) {
              if (saved > 0) await refresh();
              return { saved, error: mensagemDeErro(e) };
            }
            await refresh();
            return { saved };
          }}
          onDone={(saved, label, first) => {
            setAdding(false);
            setYear(Number(first.slice(0, 4)));
            notify("Calendário atualizado", `${label}: ${plural(saved, "dia cadastrado", "dias cadastrados")}.`);
          }}
        />
      )}

      {removing && (
        <RemoveDialog
          entries={removing}
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            if (!live || !client.reads) {
              const ids = new Set(removing.map((e) => e.id));
              setLoad({ status: "ready", entries: entries.filter((e) => !ids.has(e.id)) });
            } else {
              let removed = 0;
              try {
                for (const e of removing) {
                  await client.reads.calendar.removeHoliday(e.id, session);
                  removed++;
                }
              } catch (e) {
                if (removed > 0) await refresh();
                notify(
                  "Não foi possível remover",
                  `${removed > 0 ? `${plural(removed, "dia removido", "dias removidos")} antes do erro. ` : ""}${mensagemDeErro(e)}`,
                  "error",
                );
                setRemoving(null);
                setSelected(new Set());
                return;
              }
              await refresh();
            }
            notify("Calendário atualizado", `${plural(removing.length, "dia removido", "dias removidos")}.`);
            setRemoving(null);
            setSelected(new Set());
          }}
        />
      )}
    </>
  );
}

/* ---------- Cadastrar ---------- */

interface AddDialogProps {
  existing: CalendarEntry[];
  today: string;
  onClose: () => void;
  onSave: (days: string[], label: string, type: HolidayKind, shiftIds: number[]) => Promise<{ saved: number; error?: string }>;
  onDone: (saved: number, label: string, first: string) => void;
}

function AddDialog({ existing, today, onClose, onSave, onDone }: AddDialogProps) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<HolidayKind>("feriado");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState("");
  const [skipWeekends, setSkipWeekends] = useState(true);
  const [whole, setWhole] = useState(true);
  const [shiftIds, setShiftIds] = useState<number[]>([]);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shifts = whole ? [] : shiftIds;
  const plan = planDays({ from, to, skipWeekends, type, shiftIds: shifts, existing });
  const isRange = !!to && to !== from;
  const labelError = touched && !label.trim() ? "Descreva o dia (ex.: Aniversário de Itajaí)" : null;
  const shiftError = touched && !whole && shiftIds.length === 0 ? "Marque ao menos um turno" : null;
  const invalid = !label.trim() || (!whole && shiftIds.length === 0) || !!plan.error;

  const summary = [
    plan.add.length > 0 &&
      (plan.add.length === 1
        ? `Cadastra ${shortDate(plan.add[0])}`
        : `Cadastra ${plan.add.length} dias, de ${shortDate(plan.add[0])} a ${shortDate(plan.add[plan.add.length - 1])}`),
    plan.weekends > 0 && `pula ${plural(plan.weekends, "dia", "dias")} de fim de semana`,
    plan.duplicates.length > 0 &&
      `${plural(plan.duplicates.length, "dia já cadastrado", "dias já cadastrados")} fica${plan.duplicates.length > 1 ? "m" : ""} como está`,
  ].filter(Boolean);

  const save = async () => {
    setTouched(true);
    if (invalid) return;
    setSaving(true);
    setError(null);
    const r = await onSave(plan.add, label.trim(), type, shifts);
    setSaving(false);
    if (r.error) {
      setError(r.saved > 0 ? `${plural(r.saved, "dia foi cadastrado", "dias foram cadastrados")} antes do erro. ${r.error}` : r.error);
      return;
    }
    onDone(r.saved, label.trim(), plan.add[0]);
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && !saving && onClose()}
      title="Cadastrar no calendário"
      primary={{
        label: plan.add.length > 1 ? `Cadastrar ${plan.add.length} dias` : "Cadastrar",
        onClick: save,
        isLoading: saving,
        isDisabled: touched && invalid,
      }}
    >
      <div className="flex flex-col gap-200">
        <TextField
          label="Descrição"
          isRequired
          value={label}
          maxLength={120}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => label && setTouched(true)}
          placeholder="Ex.: Aniversário de Itajaí, Férias coletivas"
          error={labelError}
          autoFocus
        />
        <div className="flex flex-col gap-050">
          <span className="font-body-small font-semibold text-subtle">Tipo</span>
          <SegmentedControl
            label="Tipo"
            iconOnly={false}
            size="control"
            value={type}
            onChange={(v) => setType(v as HolidayKind)}
            options={(Object.keys(TYPE_META) as HolidayKind[]).map((t) => ({ value: t, label: TYPE_META[t].label }))}
          />
          <p className="font-body-small text-subtlest">{TYPE_META[type].hint}</p>
        </div>
        <div className="grid grid-cols-1 gap-150 s:grid-cols-2">
          <DateField label={isRange ? "De" : "Data"} isRequired value={from} onChange={setFrom} today={today} />
          <DateField label="Até (opcional)" value={to} onChange={setTo} min={from} today={today} helper="Para férias coletivas e pontes" />
        </div>
        {to && (
          <div className="flex flex-wrap items-center justify-between gap-100">
            {isRange ? (
              <label className="flex items-center gap-100 text-default">
                <Checkbox label="Pular sábados e domingos" checked={skipWeekends} onChange={(e) => setSkipWeekends(e.target.checked)} />
                Pular sábados e domingos
              </label>
            ) : (
              <span />
            )}
            <Button appearance="subtle" spacing="compact" onClick={() => setTo("")}>
              Só um dia
            </Button>
          </div>
        )}
        <div className="flex flex-col gap-100">
          <span className="font-body-small font-semibold text-subtle">Vale para</span>
          <SegmentedControl
            label="Vale para"
            iconOnly={false}
            size="control"
            value={whole ? "dia" : "turnos"}
            onChange={(v) => setWhole(v === "dia")}
            options={[
              { value: "dia", label: "Dia inteiro" },
              { value: "turnos", label: "Só alguns turnos" },
            ]}
          />
          {!whole && (
            <div className="flex flex-wrap gap-200">
              {SHIFTS.map((s) => (
                <label key={s} className="flex items-center gap-100 text-default">
                  <Checkbox
                    label={`Turno ${s}`}
                    checked={shiftIds.includes(s)}
                    onChange={(e) => setShiftIds((ids) => (e.target.checked ? [...ids, s].sort() : ids.filter((x) => x !== s)))}
                  />
                  Turno {s}
                </label>
              ))}
            </div>
          )}
          {shiftError && <p className="font-body-small text-danger">{shiftError}</p>}
        </div>
        <div role="status" className={cn("flex gap-100 rounded-medium p-150", plan.error ? "bg-warning" : "bg-information")}>
          <Info aria-hidden className={cn("mt-025 size-icon-small shrink-0", plan.error ? "text-icon-warning" : "text-icon-information")} />
          <p className="text-default">
            {plan.error ?? `${summary.join("; ")}.`}
            {!plan.error && type === "dia_anulado" && " Apontamentos que já existem nesses dias deixam de contar para a meta."}
          </p>
        </div>
        {error && <ErrorMessage title="Não foi possível cadastrar">{error}</ErrorMessage>}
      </div>
    </Modal>
  );
}

/* ---------- Remover ---------- */

function RemoveDialog({ entries, onClose, onConfirm }: { entries: CalendarEntry[]; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const one = entries.length === 1 ? entries[0] : null;
  return (
    <Modal
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      title={one ? "Remover do calendário?" : `Remover ${entries.length} dias do calendário?`}
      primary={{
        label: "Remover",
        appearance: "danger",
        isLoading: busy,
        onClick: async () => {
          setBusy(true);
          await onConfirm();
        },
      }}
    >
      {one ? (
        <p>
          <strong>{one.label}</strong>, {weekday(one.date)} {shortDate(one.date)}/{one.date.slice(0, 4)} (
          {shiftsLabel(one.shiftIds).toLowerCase()}).
        </p>
      ) : (
        <ul className="flex list-disc flex-col gap-025 pl-250">
          {entries.map((e) => (
            <li key={e.id}>
              {shortDate(e.date)} · {e.label}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-150 text-subtle">
        {one ? "O dia volta a contar como dia útil." : "Os dias voltam a contar como dias úteis."}
        {entries.some((e) => e.type === "dia_anulado" && !e.isEvent) && " Os apontamentos desses dias voltam a contar para a meta."}
      </p>
    </Modal>
  );
}
