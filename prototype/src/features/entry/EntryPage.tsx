import { ChevronDown, CircleAlert, History, MessageSquarePlus, Plus, RefreshCw, RotateCcw, Save, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProdRecord } from "../../../../src/lib/api";
import { mensagemDeErro } from "../../../../src/lib/erros";
import { exigeOperadores, metaDoTurno } from "../../../../src/lib/metas";
import {
  DATA_END,
  DATA_ORIGIN,
  DATA_START,
  LINE_ACCENT,
  MACHINE_GROUPS,
  MACHINES,
  REWORK_REASONS,
  SHIFTS,
  SHIFT_META,
  STATUS_META,
  endOfMonth,
  machineById,
  opLabel,
  statusFor,
  toIsoDate,
  type Machine,
  type Shift,
} from "@/data/machines";
import { reloadBackendData } from "@/data/fromBackend";
import { cn, formatNumber, readToken, type Notify } from "@/lib/utils";
import { useAccess } from "@/features/access/AccessContext";
import { useOps } from "@/features/ops/OpsStore";
import { opHint, releasedFor } from "./opHint";
import { shiftAt } from "@/features/tv/tvMetrics";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { SegmentedBar } from "@/components/data/SegmentedBar";
import { Button, IconButton } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { EmptyState, ErrorMessage } from "@/components/ui/Feedback";
import { Lozenge } from "@/components/ui/Lozenge";
import { Modal } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TagGroup } from "@/components/ui/Tag";
import { TextArea, TextField } from "@/components/ui/TextField";
import { DateField } from "@/components/ui/DateField";
import { baseLabel } from "@/features/metas/metaBase";
import { useDayTargets, type DayTarget } from "./dayTargets";
import { planSaves, type ExistingRecord } from "./payload";

/* ---------- Modelo do formulário ---------- */
interface OpRow {
  key: string;
  op: string;
  qty: string;
  rework: boolean;
  /** motivo do retrabalho, escrito por quem aponta */
  reason: string;
}
interface MachineEntry {
  /** ordens NOVAS deste lançamento: salvar acrescenta às já gravadas (D30) */
  rows: OpRow[];
  note: string;
  noteOpen: boolean;
  /**
   * Nº de operadores no posto, em TODA máquina (D12, D52). Vazio = não
   * informado; ao salvar vira 0, que é o que apaga um valor gravado antes.
   */
  people: string;
  /** o banco recusou o último salvar desta máquina (o que foi digitado continua aqui) */
  error?: string;
}
type Form = Record<string, MachineEntry>;

/** O que já está gravado para a máquina neste dia, turno e regime: aparece, mas não se edita aqui */
interface Existing extends ExistingRecord {
  good: number;
  rework: number;
  ops: string[];
}

let rowSeq = 0;
const newRow = (op = "", qty = "", rework = false): OpRow => ({ key: `r${rowSeq++}`, op, qty, rework, reason: "" });

/**
 * Formulário vazio para a data/turno/regime, com o que já foi apontado ao lado.
 * As ordens gravadas NÃO voltam para os campos: salvar de novo acrescenta (D30),
 * e reenviar as mesmas ordens as duplicaria. Corrigir o que já está gravado é no
 * Histórico. A observação e o nº de pessoas, que são do apontamento, voltam.
 */
function loadForm(date: string, shift: Shift, overtime: boolean): { form: Form; existing: Record<string, Existing> } {
  const form: Form = {};
  const existing: Record<string, Existing> = {};
  for (const m of MACHINES) {
    const orders = (m.backend?.orders ?? m.orders).filter(
      (o) => toIsoDate(o.date) === date && o.shift === shift && (o.record?.overtime ?? false) === overtime,
    );
    const record = orders.find((o) => o.record)?.record;
    if (orders.length)
      existing[m.id] = {
        id: record?.id ?? "",
        operatorCount: record?.operatorCount ?? null,
        notes: record ? record.notes : (orders.find((o) => o.note)?.note?.text ?? ""),
        good: orders.reduce((s, o) => s + (o.rework ? 0 : o.quantity), 0),
        rework: orders.reduce((s, o) => s + (o.rework ? o.quantity : 0), 0),
        ops: [...new Set(orders.filter((o) => o.quantity > 0).map(opLabel))],
      };
    const ex = existing[m.id];
    form[m.id] = {
      rows: [newRow()],
      note: ex?.notes ?? "",
      noteOpen: !!ex?.notes,
      people: ex?.operatorCount ? String(ex.operatorCount) : "",
    };
  }
  return { form, existing };
}

/** Dia e turno de agora: o T3 da madrugada pertence ao dia em que começou */
function currentShift(now = new Date()): { date: string; shift: Shift } {
  const shift = shiftAt(now);
  const day = shift === 3 && now.getHours() < 12 ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1) : now;
  return { date: toIsoDate(day), shift };
}

/**
 * Meta do turno da máquina na data apontada, pela base e pelas pessoas
 * informadas (a conta é a de src/lib/metas.ts, teto D49). Hora extra não tem
 * meta (D27); sem meta cadastrada na data, também não.
 */
function shiftGoal(m: Machine, target: DayTarget | undefined, people: string, overtime: boolean) {
  const base = target?.base ?? "per_shift";
  const crew = target?.lotacao ?? null;
  const turn = metaDoTurno({ cadastrada: m.hasTarget ? (target?.cadastrada ?? 0) : 0, base, pessoas: people, lotacaoPadrao: crew });
  const hasMeta = m.hasTarget && !overtime && turn.valor > 0;
  return { base, crew, turn, hasMeta, meta: hasMeta ? turn.valor : 0 };
}

/** Acima disto, a quantidade pede conferência (um zero a mais é o erro mais comum) */
const TOO_HIGH = 2;

// Nº da OP: só números, até 15 dígitos (D57). O banco recusa o resto, e uma OP ruim barra o apontamento inteiro
const OP_PATTERN = /^\d{1,15}$/;
const qtyOf = (r: OpRow) => (r.qty.trim() === "" ? 0 : Number(r.qty));

function rowErrors(r: OpRow) {
  const qty = r.qty.trim();
  const errors: { op?: string; qty?: string; reason?: string } = {};
  if (qty !== "" && (!Number.isInteger(Number(qty)) || Number(qty) < 0)) errors.qty = "Use um número inteiro";
  if (qtyOf(r) > 0 && !r.op.trim()) errors.op = "Informe o número da OP";
  else if (r.op.trim() && !OP_PATTERN.test(r.op.trim())) errors.op = "Use só números, até 15 dígitos";
  // Retrabalho sem motivo deixa o gráfico "Motivos de retrabalho" sem informação
  if (r.rework && qtyOf(r) > 0 && !r.reason.trim()) errors.reason = "Escreva o motivo do retrabalho";
  return errors;
}

interface EntryPageProps {
  notify: Notify;
}

export function EntryPage({ notify }: EntryPageProps) {
  const { client, session } = useAccess();
  // Com o banco, grava de verdade; na demonstração, só simula
  const live = DATA_ORIGIN === "backend";
  const start = useMemo(() => (live ? currentShift() : { date: toIsoDate(DATA_END), shift: 1 as Shift }), [live]);
  const [date, setDate] = useState(start.date);
  const [shift, setShift] = useState<Shift>(start.shift);
  const [overtime, setOvertime] = useState(false);
  const [loaded, setLoaded] = useState(() => loadForm(start.date, start.shift, false));
  const form = loaded.form;
  const existing = loaded.existing;
  const setForm = (fn: (f: Form) => Form) => setLoaded((l) => ({ ...l, form: fn(l.form) }));
  const [targetsAttempt, setTargetsAttempt] = useState(0);
  const targets = useDayTargets(date, targetsAttempt);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<{ date: string; shift: Shift; overtime: boolean } | null>(null);
  // "Descartar alterações" apaga o que foi digitado: pede confirmação, como trocar a data ou o turno
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // Quantidade acima de 2× a meta: pergunta uma vez antes de salvar, sem impedir
  const [confirmHigh, setConfirmHigh] = useState<string[] | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  type Context = { date: string; shift: Shift; overtime: boolean };
  const switchContext = (next: Context) => {
    // Trocar data/turno/regime com alterações não salvas pede confirmação
    if (dirty) return setPending(next);
    applyContext(next);
  };
  const applyContext = (next: Context) => {
    setDate(next.date);
    setShift(next.shift);
    setOvertime(next.overtime);
    setLoaded(loadForm(next.date, next.shift, next.overtime));
    setDirty(false);
    setSavedAt(null);
    setShowErrors(false);
    setPending(null);
  };

  const update = (machineId: string, fn: (e: MachineEntry) => MachineEntry) => {
    setForm((f) => ({ ...f, [machineId]: { ...fn(f[machineId]), error: undefined } }));
    setDirty(true);
    setSavedAt(null);
  };

  // Produção boa do turno: o que já está gravado + o que está sendo lançado (retrabalho fica fora, D11)
  const totals = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(form).map(([id, e]) => [id, (existing[id]?.good ?? 0) + e.rows.reduce((s, r) => s + (r.rework ? 0 : qtyOf(r)), 0)]),
      ),
    [form, existing],
  );
  const filled = Object.values(totals).filter((t) => t > 0).length;
  const errorCount = Object.values(form)
    .flatMap((e) => e.rows)
    .reduce((n, r) => n + Object.keys(rowErrors(r)).length, 0);

  const save = useCallback(async (checked = false) => {
    if (saving) return;
    if (live && targets.status === "loading") return;
    if (errorCount > 0) {
      setShowErrors(true);
      notify(
        "Corrija os campos destacados",
        `${errorCount} ${errorCount === 1 ? "campo precisa" : "campos precisam"} de ajuste antes de salvar.`,
        "error",
      );
      // leva o foco ao primeiro campo inválido
      window.setTimeout(() => bodyRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus(), 0);
      return;
    }
    const [y, mo, d] = date.split("-");
    const when = `${SHIFT_META[shift].label}${overtime ? " · hora extra" : ""} · ${d}/${mo}/${y}`;
    const plan = planSaves(form, existing, MACHINES, { date, shift, overtime, savedBy: session?.nome ?? "" });
    // Meta por pessoa sem o nº de operadores: o banco recusaria no fim (D54); avisa antes, com o nome da máquina
    const missingPeople = plan
      .filter((p) => targets.status === "ready" && exigeOperadores(targets.byMachine[p.machineId]?.base) && !form[p.machineId].people.trim())
      .map((p) => machineById(p.machineId).name);
    if (missingPeople.length) {
      setShowErrors(true);
      notify("Informe o nº de operadores", `${missingPeople.join(", ")}: a meta é por pessoa, e o número é obrigatório.`, "error");
      window.setTimeout(() => bodyRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus(), 0);
      return;
    }
    if (!plan.length) {
      notify("Nada para salvar", "Lance a quantidade de pelo menos uma OP, ou mude a observação ou o nº de operadores.", "error");
      return;
    }
    if (!checked) {
      const high = plan
        .map((p) => machineById(p.machineId))
        .filter((m) => {
          const g = shiftGoal(m, targets.status === "ready" ? targets.byMachine[m.id] : undefined, form[m.id].people, overtime);
          return g.hasMeta && totals[m.id] > g.meta * TOO_HIGH;
        })
        .map((m) => m.name);
      if (high.length) return setConfirmHigh(high);
    }
    setConfirmHigh(null);
    setSaving(true);

    // Demonstração: simula e mantém o que foi digitado
    if (!live || !client.reads) {
      window.setTimeout(() => {
        setSaving(false);
        setDirty(false);
        setShowErrors(false);
        setSavedAt(new Date());
        notify("Apontamento salvo", `${plan.length} ${plan.length === 1 ? "máquina" : "máquinas"} · ${when}`);
      }, readToken("--ds-motion-duration-skeleton") / 2);
      return;
    }

    // Com o banco: uma máquina por vez. Se uma falhar, as outras seguem, e o que
    // falhou continua no formulário com o motivo ao lado.
    const reads = client.reads;
    const failed: Record<string, string> = {};
    for (const p of plan) {
      try {
        if (p.needsSave) await reads.production.saveEntries([p.payload], { workMode: overtime ? "overtime" : "regular" }, session);
        if (p.clearNoteOf) await reads.production.updateObs({ id: p.clearNoteOf } as ProdRecord, "", session);
      } catch (e) {
        failed[p.machineId] = mensagemDeErro(e, "Não foi possível salvar esta máquina.");
      }
    }
    let refreshed = true;
    try {
      await reloadBackendData(reads, session);
    } catch {
      refreshed = false;
    }
    const fresh = loadForm(date, shift, overtime);
    for (const [id, message] of Object.entries(failed)) fresh.form[id] = { ...form[id], error: message };
    setLoaded(fresh);
    setSaving(false);

    const ok = plan.length - Object.keys(failed).length;
    const failedCount = Object.keys(failed).length;
    setShowErrors(false);
    setDirty(failedCount > 0);
    setSavedAt(ok > 0 && !failedCount ? new Date() : null);
    if (!failedCount) notify("Apontamento salvo", `${ok} ${ok === 1 ? "máquina" : "máquinas"} · ${when}`);
    else if (ok) notify(`${ok} salvas, ${failedCount} com erro`, "As máquinas com erro continuam no formulário, com o motivo ao lado.", "error");
    else notify("Nada foi salvo", failed[plan[0].machineId], "error");
    if (!refreshed) notify("Salvo, mas a tela não atualizou", "Recarregue a página para ver os números novos.", "error");
  }, [saving, live, targets, errorCount, notify, date, shift, overtime, form, existing, session, client, totals]);

  // Ctrl+S salva
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  // Apontar atrasado é permitido (D10): de 31 dias atrás (ou do primeiro dado) até hoje
  const todayIso = toIsoDate(new Date());
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 31);
  const minDate = live && monthAgo < DATA_START ? monthAgo : DATA_START;

  const q = search.trim().toLowerCase();
  // Máquina desativada no cadastro só aparece se já tem apontamento neste dia e turno (para mostrar o gravado)
  const listed = (m: Machine) => !m.inactive || !!existing[m.id];
  const listedCount = MACHINES.filter(listed).length;
  const groups = MACHINE_GROUPS.map((g) => ({
    ...g,
    machines: g.machineIds.map(machineById).filter((m) => listed(m) && (!q || m.name.toLowerCase().includes(q))),
  })).filter((g) => g.machines.length > 0);

  const status = savedAt ? (
    <Lozenge appearance="success">
      Salvo às {savedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
    </Lozenge>
  ) : dirty ? (
    <Lozenge appearance="warning">Alterações não salvas</Lozenge>
  ) : null;

  return (
    <>
      <PageHeader
        title="Apontamento"
        lozenge={status}
        description="Registre a produção de cada máquina no turno. Uma máquina pode ter várias OPs, e o que você lança soma ao que já foi gravado."
        actions={
          <>
            <Button
              appearance="subtle"
              iconBefore={RotateCcw}
              isDisabled={!dirty}
              onClick={() => setConfirmDiscard(true)}
            >
              Descartar alterações
            </Button>
            <Button appearance="primary" iconBefore={Save} isLoading={saving} onClick={() => void save()} title="Ctrl+S">
              Salvar apontamento
            </Button>
          </>
        }
      />

      <PageBody>
        {targets.status === "error" && (
          <ErrorMessage
            title="Não foi possível carregar as metas deste dia"
            actions={
              <Button iconBefore={RefreshCw} onClick={() => setTargetsAttempt((n) => n + 1)}>
                Tentar de novo
              </Button>
            }
          >
            {targets.message} Dá para lançar e salvar: quem grava a meta do apontamento é o banco. Só a porcentagem desta tela fica sem
            referência.
          </ErrorMessage>
        )}
        {/* ---------- Contexto: data, turno, busca, progresso ---------- */}
        <div className="flex flex-wrap items-start gap-x-300 gap-y-200 rounded-large bg-surface-sunken p-200">
          <DateField
            label="Data"
            value={date}
            min={toIsoDate(minDate)}
            max={live ? todayIso : toIsoDate(endOfMonth(DATA_END))}
            today={live ? todayIso : toIsoDate(DATA_END)}
            onChange={(d) => switchContext({ date: d, shift, overtime })}
            className="w-1000 min-w-column-name"
          />
          <div className="flex flex-col gap-050">
            <span id="entry-shift" className="font-body-small font-semibold text-subtle">
              Turno <span className="font-normal text-subtlest">· {SHIFT_META[shift].hours}</span>
            </span>
            <SegmentedControl
              label="Turno"
              size="control"
              iconOnly={false}
              value={String(shift)}
              onChange={(v) => switchContext({ date, shift: Number(v) as Shift, overtime })}
              options={SHIFTS.map((s) => ({ value: String(s), label: SHIFT_META[s].label }))}
            />
          </div>
          <div className="flex flex-col gap-050">
            <span id="entry-mode" className="font-body-small font-semibold text-subtle">
              Regime <span className="font-normal text-subtlest">· hora extra fica fora da meta</span>
            </span>
            <SegmentedControl
              label="Regime"
              size="control"
              iconOnly={false}
              value={overtime ? "overtime" : "regular"}
              onChange={(v) => switchContext({ date, shift, overtime: v === "overtime" })}
              options={[
                { value: "regular", label: "Normal" },
                { value: "overtime", label: "Hora extra" },
              ]}
            />
          </div>
          <TextField
            label="Filtrar máquinas"
            placeholder="Nome da máquina"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            elemAfter={<Search aria-hidden className="size-icon-small" />}
            className="min-w-column-name flex-1"
          />
          <div className="flex min-w-column-name flex-col gap-050" aria-live="polite">
            <span className="font-body-small font-semibold text-subtle">Máquinas com produção</span>
            <span className="flex h-control flex-col justify-center gap-050">
              <span className="font-body-small text-subtle">
                <span className="font-semibold tabular-nums text-default">{filled}</span> de {listedCount}
              </span>
            <span
              role="progressbar"
              aria-label="Máquinas com produção"
              aria-valuenow={filled}
              aria-valuemin={0}
              aria-valuemax={listedCount}
              className="flex h-075 overflow-hidden rounded-full bg-neutral"
            >
              <span className="h-full rounded-full bg-brand-bold" style={{ width: `${(filled / Math.max(listedCount, 1)) * 100}%` }} />
              </span>
            </span>
          </div>
        </div>

        {/* ---------- Máquinas por linha ---------- */}
        <div ref={bodyRef} className="flex flex-col gap-300">
          {groups.length === 0 && (
            <div className="rounded-xlarge border">
              <EmptyState
                icon={Search}
                title="Nenhuma máquina encontrada"
                hint={`Nada corresponde a "${search}".`}
                action={{ label: "Limpar filtro", onClick: () => setSearch("") }}
              />
            </div>
          )}
          {groups.map((g) => {
            const isCollapsed = collapsed.has(g.id);
            const groupFilled = g.machines.filter((m) => totals[m.id] > 0).length;
            return (
              <section key={g.id} aria-labelledby={`grp-${g.id}`}>
                <h2>
                  <button
                    id={`grp-${g.id}`}
                    type="button"
                    aria-expanded={!isCollapsed}
                    aria-controls={`grp-body-${g.id}`}
                    onClick={() =>
                      setCollapsed((c) => {
                        const n = new Set(c);
                        if (n.has(g.id)) n.delete(g.id);
                        else n.add(g.id);
                        return n;
                      })
                    }
                    className="ds-pressable -mx-100 flex items-center gap-100 rounded-medium px-100 py-050 hover:bg-neutral-subtle-hovered"
                  >
                    <ChevronDown
                      aria-hidden
                      className={cn("size-icon-small text-icon-subtle transition-transform duration-menu ease-out", isCollapsed && "-rotate-90")}
                    />
                    <span className="font-heading-small text-default">{g.label}</span>
                    <span className="font-body-small tabular-nums text-subtlest">
                      {groupFilled} de {g.machines.length} preenchidas
                    </span>
                  </button>
                </h2>
                {!isCollapsed && (
                  <ul id={`grp-body-${g.id}`} className="mt-100 flex flex-col overflow-hidden rounded-xlarge border">
                    {g.machines.map((m) => (
                      <MachineEntryRow
                        key={m.id}
                        machineId={m.id}
                        entry={form[m.id]}
                        existing={existing[m.id]}
                        target={targets.status === "ready" ? targets.byMachine[m.id] : undefined}
                        overtime={overtime}
                        total={totals[m.id]}
                        showErrors={showErrors}
                        onChange={(fn) => update(m.id, fn)}
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </PageBody>

      <Modal
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Descartar alterações?"
        primary={{
          label: "Descartar",
          appearance: "danger",
          onClick: () => {
            setConfirmDiscard(false);
            applyContext({ date, shift, overtime });
          },
        }}
        cancelLabel="Continuar editando"
      >
        O que foi digitado para {SHIFT_META[shift].label.toLowerCase()} de {date.split("-").reverse().join("/")} e ainda não foi salvo será
        apagado. O que já está gravado não muda.
      </Modal>

      <Modal
        open={confirmHigh != null}
        onOpenChange={(o) => !o && setConfirmHigh(null)}
        title="Conferir as quantidades?"
        primary={{ label: "Salvar assim", isLoading: saving, onClick: () => void save(true) }}
        cancelLabel="Corrigir"
      >
        {confirmHigh?.length === 1 ? "Esta máquina passou" : "Estas máquinas passaram"} de {TOO_HIGH}× a meta do turno: {confirmHigh?.join(", ")}.
        Se foi um zero a mais, corrija antes de salvar.
      </Modal>

      <Modal
        open={pending != null}
        onOpenChange={(o) => !o && setPending(null)}
        title="Descartar alterações?"
        primary={{ label: "Descartar e trocar", appearance: "danger", onClick: () => pending && applyContext(pending) }}
        cancelLabel="Continuar editando"
      >
        Há apontamentos não salvos para {SHIFT_META[shift].label.toLowerCase()} de {date.split("-").reverse().join("/")}. Se
        trocar a data ou o turno agora, eles serão perdidos.
      </Modal>
    </>
  );
}

/* ---------- Uma máquina: OPs, total, % da meta do turno, observação ---------- */
function MachineEntryRow({
  machineId,
  entry,
  existing,
  target,
  overtime,
  total,
  showErrors,
  onChange,
}: {
  machineId: string;
  entry: MachineEntry;
  existing: Existing | undefined;
  /** meta que vale na data apontada; undefined = ainda carregando ou indisponível */
  target: DayTarget | undefined;
  overtime: boolean;
  total: number;
  showErrors: boolean;
  onChange: (fn: (e: MachineEntry) => MachineEntry) => void;
}) {
  const m = machineById(machineId);
  const { ops, status: opsStatus } = useOps();
  // OPs liberadas (em produção) nesta máquina: o campo sugere os números (D62)
  const openOps = releasedFor(ops, m.id);
  const hintFor = (op: string) => (opsStatus === "ready" && op.length >= 4 ? opHint(op, m.id, ops, (id) => machineById(id)?.name ?? "outra máquina") : null);
  const listId = `ops-${m.id}`;
  const releasedNumbers = openOps.map((op) => op.id.replace("OP ", ""));
  // Meta do turno NA DATA apontada
  const { base, crew, turn, hasMeta, meta } = shiftGoal(m, target, entry.people, overtime);
  const peopleHelp = !m.hasTarget
    ? "Só registra a presença: centro por demanda, sem meta."
    : overtime
      ? "Só registra a presença: hora extra fica fora da meta."
      : !turn.dependeDaLotacao
      ? "Só registra a presença: a meta desta máquina não muda com o nº de pessoas."
      : base === "per_operator"
        ? `A meta é por pessoa: ${formatNumber(turn.cadastrada)} × pessoas.`
        : `A meta acompanha o nº de pessoas${crew ? `, até a lotação padrão de ${crew}` : ""}. Gente a mais não aumenta a meta.`;
  const percent = meta ? Math.round((total / meta) * 100) : 0;
  const status = statusFor(percent);
  const tooHigh = hasMeta && total > meta * TOO_HIGH;
  const peopleRequired = exigeOperadores(target?.base);

  const setRow = (key: string, patch: Partial<OpRow>) =>
    onChange((e) => ({ ...e, rows: e.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));

  return (
    <li className="flex flex-col gap-200 border-t p-200 first:border-t-0 l:flex-row l:items-start">
      {/* Identificação e resultado */}
      <div className="flex min-w-0 flex-col gap-100 l:w-column-name l:shrink-0">
        <h3 className="font-heading-xsmall text-default">{m.name}</h3>
        {/* Linha e situação numa fileira só, como na tabela do Dashboard */}
        <div className="flex flex-wrap items-center gap-075">
          <TagGroup items={m.lines} accentFor={(l) => LINE_ACCENT[l] ?? "gray"} />
          {existing && <Lozenge appearance="information">Já apontado</Lozenge>}
        </div>
        {existing && (
          <p className="font-body-small text-subtle">
            Gravado: <span className="font-semibold tabular-nums text-default">{formatNumber(existing.good)}</span> peças
            {existing.rework > 0 && <> + {formatNumber(existing.rework)} de retrabalho</>}
            {existing.ops.length > 0 && (
              <>
                {" "}
                em {existing.ops.length === 1 ? "OP" : "OPs"} <span className="font-code">{existing.ops.join(", ")}</span>
              </>
            )}
            .{" "}
            <a href={`#/historico/${encodeURIComponent(m.id)}`} className="inline-flex items-center gap-025 text-link hover:underline">
              <History aria-hidden className="size-icon-small" />
              Corrigir no Histórico
            </a>
          </p>
        )}
        {entry.error && <p className="font-body-small text-danger" role="alert">Não salvou: {entry.error}</p>}
        {hasMeta ? (
          <>
            <div className="mt-050 flex flex-wrap items-center gap-100">
              <SegmentedBar percent={percent} status={status} label={`${m.name}: ${percent}% da meta do turno`} />
              <span className="font-medium tabular-nums text-default">{percent}%</span>
              {total > 0 && <Lozenge appearance={STATUS_META[status].appearance}>{STATUS_META[status].label}</Lozenge>}
            </div>
            <p className="font-body-small text-subtlest">
              <span className="font-semibold tabular-nums text-default">{formatNumber(total)}</span> de{" "}
              <span className="tabular-nums">{formatNumber(meta)}</span> (meta do turno
              {turn.dependeDaLotacao && ` · ${baseLabel(base).toLowerCase()}, ${turn.pessoas} ${turn.pessoas === 1 ? "pessoa" : "pessoas"}`}
              {base === "per_shift_prorated" && crew && turn.pessoas > crew && `, conta até ${crew}`})
            </p>
            {turn.estimada && <p className="font-body-small text-warning">Informe o nº de operadores: a meta deste posto depende dele.</p>}
          </>
        ) : (
          <p className="mt-050 font-body-small text-subtlest">
            <span className="font-semibold tabular-nums text-default">{formatNumber(total)}</span> peças no turno ·{" "}
            {!m.hasTarget
              ? "centro por demanda, sem meta"
              : overtime
                ? "hora extra, fora da meta"
                : target
                  ? "sem meta cadastrada nesta data"
                  : "carregando a meta do dia…"}
          </p>
        )}
        {openOps.length > 0 && (
          <p className="font-body-small text-subtle">
            {openOps.length === 1 ? "OP liberada: " : "OPs liberadas: "}
            {openOps.map((op, i) => (
              <span key={op.id}>
                {i > 0 && ", "}
                <a href={`#/feedbacks/${op.id.replace("OP ", "")}`} className="font-code text-link hover:underline">
                  {op.id.replace("OP ", "")}
                </a>
              </span>
            ))}
          </p>
        )}
        <datalist id={listId}>
          {openOps.map((op) => (
            <option key={op.id} value={op.id.replace("OP ", "")}>
              {`Material ${op.material} · ${op.product}`}
            </option>
          ))}
        </datalist>
        <TextField
          label="Nº de operadores"
          inputMode="numeric"
          placeholder={turn.dependeDaLotacao && crew ? String(crew) : "–"}
          value={entry.people}
          onChange={(e) => onChange((x) => ({ ...x, people: e.target.value.replace(/\D/g, "").slice(0, 2) }))}
          // Ajuda só quando o número muda a meta; nos outros postos o campo fala por si
          helper={peopleRequired ? `Obrigatório. ${peopleHelp}` : turn.dependeDaLotacao && hasMeta ? peopleHelp : undefined}
          error={peopleRequired && showErrors && !entry.people.trim() && (total > 0 || !!existing) ? "Informe quantas pessoas trabalharam" : null}
          inputClassName="text-right tabular-nums"
          className="mt-050"
        />
      </div>

      {/* OPs */}
      <div className="flex min-w-0 flex-1 flex-col gap-100">
        {entry.rows.map((r, i) => {
          const errors = showErrors || r.op || r.qty ? rowErrors(r) : {};
          return (
            <div key={r.key} className="flex flex-wrap items-start gap-100">
              <TextField
                label="Nº da OP"
                hideLabel={i > 0}
                aria-label={`Nº da OP, linha ${i + 1}, ${m.name}`}
                inputMode="numeric"
                placeholder="Ex.: 4501234"
                list={listId}
                value={r.op}
                onChange={(e) => setRow(r.key, { op: e.target.value.replace(/\D/g, "").slice(0, 15) })}
                error={showErrors || (r.qty && !r.op) ? errors.op : null}
                warning={errors.op ? null : hintFor(r.op)}
                helper={releasedNumbers.includes(r.op) ? "OP liberada desta máquina" : undefined}
                inputClassName="font-code"
                className="w-field-op flex-1 basis-field-op s:flex-none"
              />
              <TextField
                label="Quantidade"
                hideLabel={i > 0}
                aria-label={`Quantidade, linha ${i + 1}, ${m.name}`}
                inputMode="numeric"
                placeholder="0"
                value={r.qty}
                onChange={(e) => setRow(r.key, { qty: e.target.value.replace(/[^\d]/g, "") })}
                error={errors.qty}
                elemAfter="un."
                inputClassName="text-right tabular-nums"
                className="w-field-quantity flex-1 basis-field-quantity s:flex-none"
              />
              <label className={cn("flex h-control items-center gap-075 font-body text-subtle", i === 0 && "s:mt-250")}>
                <Checkbox
                  label={`Retrabalho, linha ${i + 1}, ${m.name}`}
                  checked={r.rework}
                  onChange={(e) => setRow(r.key, { rework: e.target.checked, ...(e.target.checked ? {} : { reason: "" }) })}
                />
                <span aria-hidden>Retrabalho</span>
              </label>
              <IconButton
                icon={Trash2}
                label={`Remover OP da linha ${i + 1}, ${m.name}`}
                isDisabled={entry.rows.length === 1}
                onClick={() =>
                  entry.rows.length > 1 && onChange((e) => ({ ...e, rows: e.rows.filter((x) => x.key !== r.key) }))
                }
                className={cn(i === 0 && "s:mt-250")}
              />
              {r.rework && (
                <ReworkReason
                  row={r}
                  context={`linha ${i + 1}, ${m.name}`}
                  error={showErrors ? errors.reason : undefined}
                  onChange={(patch) => setRow(r.key, patch)}
                />
              )}
            </div>
          );
        })}
        {tooHigh && (
          <p role="status" className="flex items-start gap-050 rounded-medium bg-warning px-150 py-100 font-body-small text-warning">
            <CircleAlert aria-hidden className="mt-025 size-icon-small shrink-0" />
            <span>
              <span className="font-semibold">Confere {formatNumber(total)} peças?</span> A meta do turno é {formatNumber(meta)}. Se for um zero a
              mais, corrija a quantidade.
            </span>
          </p>
        )}
        <div className="flex flex-wrap gap-100">
          <Button
            appearance="subtle"
            spacing="compact"
            iconBefore={Plus}
            onClick={() => onChange((e) => ({ ...e, rows: [...e.rows, newRow()] }))}
          >
            Adicionar OP
          </Button>
          {!entry.noteOpen && (
            <Button
              appearance="subtle"
              spacing="compact"
              iconBefore={MessageSquarePlus}
              onClick={() => onChange((e) => ({ ...e, noteOpen: true }))}
            >
              Adicionar observação
            </Button>
          )}
        </div>
        {entry.noteOpen && (
          <TextArea
            label="Observação do turno"
            placeholder="Paradas, falta de material, ajustes… vira um feedback para a gestão."
            maxLength={500}
            value={entry.note}
            onChange={(e) => onChange((x) => ({ ...x, note: e.target.value }))}
          />
        )}
      </div>
    </li>
  );
}

/* ---------- Motivo do retrabalho: aparece ao marcar Retrabalho ---------- */
function ReworkReason({
  row,
  context,
  error,
  onChange,
}: {
  row: OpRow;
  context: string;
  error?: string;
  onChange: (patch: Partial<OpRow>) => void;
}) {
  const listId = `motivos-${row.key}`;
  return (
    <div className="basis-full">
      {/* Os motivos comuns aparecem como sugestão ao digitar, para o gráfico juntar os iguais */}
      <datalist id={listId}>
        {REWORK_REASONS.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
      <TextField
        label="Motivo do retrabalho"
        aria-label={`Motivo do retrabalho, ${context}`}
        placeholder="Ex.: rebarba na peça"
        maxLength={80}
        list={listId}
        value={row.reason}
        onChange={(e) => onChange({ reason: e.target.value })}
        error={error}
        className="max-w-search-width"
        autoFocus
      />
    </div>
  );
}
