import { ArrowRight, Check, ChevronDown, ChevronUp, CircleAlert, CircleCheck, History, LogOut, MessageSquarePlus, Plus, RefreshCw, RotateCcw, Save, Search, Trash2 } from "lucide-react";
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
import { PAGE_GUTTER, PageBody } from "@/components/layout/PageHeader";
import { MAIN_ID } from "@/components/layout/AppRoot";
import { OptionCards } from "@/components/ui/OptionCards";
import { glideTo, scrollParent } from "@/lib/glide";
import { SegmentedBar } from "@/components/data/SegmentedBar";
import { Button, IconButton } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { EmptyState, ErrorMessage } from "@/components/ui/Feedback";
import { Lozenge } from "@/components/ui/Lozenge";
import { Modal } from "@/components/ui/Modal";
import { TagGroup } from "@/components/ui/Tag";
import { TextArea, TextField } from "@/components/ui/TextField";
import { DateField } from "@/components/ui/DateField";
import { baseLabel } from "@/features/metas/metaBase";
import { useDayTargets, type DayTarget } from "./dayTargets";
import { planSaves, type ExistingRecord } from "./payload";

/** 1 Turno · 2 Máquinas · 3 Conferir e terminar */
type Step = 1 | 2 | 3;

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
/** Há algo digitado e ainda não gravado nesta máquina (OP, quantidade, observação ou nº de pessoas diferentes do gravado) */
const hasInput = (e: MachineEntry, ex: Existing | undefined) =>
  e.rows.some((r) => r.op.trim() || r.qty.trim()) ||
  e.note.trim() !== (ex?.notes ?? "").trim() ||
  e.people.trim() !== (ex?.operatorCount ? String(ex.operatorCount) : "");

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
  /** a busca do topo do Dash filtra as máquinas desta tela (uma busca só) */
  search: string;
  onClearSearch: () => void;
}

export function EntryPage({ notify, search, onClearSearch }: EntryPageProps) {
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
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<{ date: string; shift: Shift; overtime: boolean } | null>(null);
  // "Descartar alterações" apaga o que foi digitado: pede confirmação, como trocar a data ou o turno
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // Quantidade acima de 2× a meta: pergunta uma vez antes de salvar, sem impedir
  const [confirmHigh, setConfirmHigh] = useState<{ names: string[]; only?: string } | null>(null);
  // Máquinas já apontadas neste turno ficam recolhidas numa linha; "Lançar mais" reabre
  const [reopened, setReopened] = useState<Set<string>>(new Set());
  const bodyRef = useRef<HTMLDivElement>(null);
  /*
   * Três passos: 1 Turno (quem aponta escolhe data, turno e regime; nada vem
   * preenchido), 2 Máquinas, 3 Conferir e terminar.
   */
  const [step, setStep] = useState<Step>(1);
  const [turnSet, setTurnSet] = useState(false);
  const [picked, setPicked] = useState<{ date: string; shift: Shift | null; overtime: boolean | null }>({ date: "", shift: null, overtime: null });
  const [showTurnErrors, setShowTurnErrors] = useState(false);
  const [finished, setFinished] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  // Destino (#/rota) de uma saída que ainda espera a confirmação de quem tem algo digitado
  const [confirmExit, setConfirmExit] = useState<string | null>(null);
  const toTop = () => {
    document.getElementById(MAIN_ID)?.scrollTo({ top: 0, behavior: "instant" });
    window.scrollTo({ top: 0, behavior: "instant" });
  };

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
    setReopened(new Set());
    setShowErrors(false);
    setPending(null);
    setTurnSet(true);
    setFinished(false);
    setStep(2);
    toTop();
  };

  const goStep = (n: Step) => {
    if (n > 1 && !turnSet) {
      setShowTurnErrors(true);
      setStep(1);
      return;
    }
    setStep(n);
    toTop();
  };
  /** "Trocar" no topo: volta ao passo 1 já com o turno atual escolhido */
  const changeTurn = () => {
    setPicked({ date, shift, overtime });
    setShowTurnErrors(false);
    setStep(1);
    toTop();
  };
  const continueToMachines = () => {
    setShowTurnErrors(true);
    if (!picked.date || picked.shift == null || picked.overtime == null) return;
    const next = { date: picked.date, shift: picked.shift, overtime: picked.overtime };
    if (turnSet && next.date === date && next.shift === shift && next.overtime === overtime) return goStep(2);
    switchContext(next);
  };

  const update = (machineId: string, fn: (e: MachineEntry) => MachineEntry) => {
    setForm((f) => ({ ...f, [machineId]: { ...fn(f[machineId]), error: undefined } }));
  };

  // Produção boa do turno: o que já está gravado + o que está sendo lançado (retrabalho fica fora, D11)
  const totals = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(form).map(([id, e]) => [id, (existing[id]?.good ?? 0) + e.rows.reduce((s, r) => s + (r.rework ? 0 : qtyOf(r)), 0)]),
      ),
    [form, existing],
  );
  // Alterações não gravadas: derivado do que está digitado, então concluir uma máquina não "limpa" as outras
  const dirty = Object.entries(form).some(([id, e]) => hasInput(e, existing[id]));

  // Ordem das máquinas na tela (por linha), para achar a próxima pendente
  const listedIds = MACHINE_GROUPS.flatMap((g) => g.machineIds).filter((id) => {
    const m = machineById(id);
    return m && (!m.inactive || !!existing[id]);
  });
  const nextPendingAfter = (id: string | null, justSaved: string[] = []) => {
    const i = id ? listedIds.indexOf(id) : -1;
    return [...listedIds.slice(i + 1), ...listedIds.slice(0, i + 1)].find((x) => !existing[x] && !justSaved.includes(x)) ?? null;
  };
  /** Rola até a máquina e põe o cursor no primeiro campo dela (abre a linha recolhida, se for o caso) */
  const focusMachine = (id: string | null) => {
    if (!id) return;
    const group = MACHINE_GROUPS.find((g) => g.machineIds.includes(id));
    if (group) setCollapsed((c) => (c.has(group.id) ? new Set([...c].filter((x) => x !== group.id)) : c));
    window.setTimeout(() => {
      const el = document.getElementById(`maq-${id}`);
      if (!el) return;
      // A máquina para logo abaixo do que fica fixo no topo (barra do ambiente e, no celular, a barra de progresso)
      let offset = 16;
      for (const sel of ["[data-entry-bar]", "[data-entry-progress]"]) {
        const bar = document.querySelector<HTMLElement>(sel);
        if (bar && bar.offsetParent && getComputedStyle(bar).position === "sticky") offset += bar.offsetHeight;
      }
      // Sem área de rolagem própria (celular), a página rola e a barra do topo do Dash fica fixa por cima
      if (!scrollParent(el)) offset += readToken("--dash-topnav-height");
      glideTo(el, {
        offset,
        // cursor no Nº da OP (é o que se digita primeiro); na linha recolhida, no "Lançar mais"
        onEnd: () => el.querySelector<HTMLElement>('input[aria-label^="Nº da OP"], button')?.focus({ preventScroll: true }),
      });
    }, 0);
  };

  /**
   * Grava o turno inteiro (botão do topo, Ctrl+S) ou só uma máquina ("Concluir",
   * Enter na quantidade). Cada máquina é um apontamento (D10): gravar uma não
   * mexe no que está digitado nas outras.
   */
  const save = useCallback(async (opts: { checked?: boolean; only?: string } = {}): Promise<boolean> => {
    if (saving) return false;
    if (live && targets.status === "loading") return false;
    const scopeIds = opts.only ? [opts.only] : Object.keys(form);
    const scope: Form = Object.fromEntries(scopeIds.map((id) => [id, form[id]]));
    const errorCount = scopeIds.flatMap((id) => form[id].rows).reduce((n, r) => n + Object.keys(rowErrors(r)).length, 0);
    if (errorCount > 0) {
      setShowErrors(true);
      notify(
        "Corrija os campos destacados",
        `${errorCount} ${errorCount === 1 ? "campo precisa" : "campos precisam"} de ajuste antes de salvar.`,
        "error",
      );
      // leva o foco ao primeiro campo inválido
      window.setTimeout(() => bodyRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus(), 0);
      return false;
    }
    const [y, mo, d] = date.split("-");
    const when = `${SHIFT_META[shift].label}${overtime ? " · hora extra" : ""} · ${d}/${mo}/${y}`;
    const plan = planSaves(scope, existing, MACHINES, { date, shift, overtime, savedBy: session?.nome ?? "" });
    // Meta por pessoa sem o nº de operadores: o banco recusaria no fim (D54); avisa antes, com o nome da máquina
    const missingPeople = plan
      .filter((p) => targets.status === "ready" && exigeOperadores(targets.byMachine[p.machineId]?.base) && !form[p.machineId].people.trim())
      .map((p) => machineById(p.machineId).name);
    if (missingPeople.length) {
      setShowErrors(true);
      notify("Informe o nº de operadores", `${missingPeople.join(", ")}: a meta é por pessoa, e o número é obrigatório.`, "error");
      window.setTimeout(() => bodyRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus(), 0);
      return false;
    }
    if (!plan.length) {
      notify(
        opts.only ? "Nada para concluir" : "Nada para salvar",
        opts.only
          ? "Lance a quantidade de pelo menos uma OP nesta máquina."
          : "Lance a quantidade de pelo menos uma OP, ou mude a observação ou o nº de operadores.",
        "error",
      );
      return false;
    }
    if (!opts.checked) {
      const high = plan
        .map((p) => machineById(p.machineId))
        .filter((m) => {
          const g = shiftGoal(m, targets.status === "ready" ? targets.byMachine[m.id] : undefined, form[m.id].people, overtime);
          return g.hasMeta && totals[m.id] > g.meta * TOO_HIGH;
        })
        .map((m) => m.name);
      if (high.length) {
        setConfirmHigh({ names: high, only: opts.only });
        return false;
      }
    }
    setConfirmHigh(null);
    setSaving(true);
    const savedIds = plan.map((p) => p.machineId);
    const done = (ok: string[]) => {
      setReopened((r) => new Set([...r].filter((id) => !ok.includes(id))));
      // Concluiu uma máquina: leva à próxima que ainda não foi apontada
      if (opts.only && ok.includes(opts.only)) window.setTimeout(() => focusMachine(nextPendingAfter(opts.only!, ok)), 0);
    };

    // Demonstração: simula o banco (o que foi gravado passa a "já apontado" e os campos da máquina esvaziam)
    if (!live || !client.reads) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, readToken("--ds-motion-duration-skeleton") / 2));
      {
        setLoaded((l) => {
          const nextForm = { ...l.form };
          const nextExisting = { ...l.existing };
          for (const id of savedIds) {
            const e = l.form[id];
            const rows = e.rows.filter((r) => qtyOf(r) > 0);
            const prev = l.existing[id];
            nextExisting[id] = {
              id: prev?.id ?? "",
              operatorCount: e.people.trim() ? Number(e.people) : (prev?.operatorCount ?? null),
              notes: e.note.trim(),
              good: (prev?.good ?? 0) + rows.reduce((s, r) => s + (r.rework ? 0 : qtyOf(r)), 0),
              rework: (prev?.rework ?? 0) + rows.reduce((s, r) => s + (r.rework ? qtyOf(r) : 0), 0),
              ops: [...new Set([...(prev?.ops ?? []), ...rows.map((r) => r.op.trim())])],
            };
            nextForm[id] = { ...e, rows: [newRow()], error: undefined };
          }
          return { form: nextForm, existing: nextExisting };
        });
        setSaving(false);
        setShowErrors(false);
        notify(
          opts.only ? `${machineById(opts.only).name}: gravada` : "Apontamento salvo",
          opts.only ? when : `${plan.length} ${plan.length === 1 ? "máquina" : "máquinas"} · ${when}`,
        );
        done(savedIds);
      }
      return true;
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
    // O que está digitado nas outras máquinas continua lá
    for (const id of Object.keys(form)) if (!scopeIds.includes(id)) fresh.form[id] = form[id];
    for (const [id, message] of Object.entries(failed)) fresh.form[id] = { ...form[id], error: message };
    setLoaded(fresh);
    setSaving(false);

    const ok = plan.length - Object.keys(failed).length;
    const failedCount = Object.keys(failed).length;
    setShowErrors(false);
    done(savedIds.filter((id) => !failed[id]));
    if (!failedCount)
      notify(
        opts.only ? `${machineById(opts.only).name}: gravada` : "Apontamento salvo",
        opts.only ? when : `${ok} ${ok === 1 ? "máquina" : "máquinas"} · ${when}`,
      );
    else if (ok) notify(`${ok} salvas, ${failedCount} com erro`, "As máquinas com erro continuam no formulário, com o motivo ao lado.", "error");
    else notify("Nada foi salvo", failed[plan[0].machineId], "error");
    if (!refreshed) notify("Salvo, mas a tela não atualizou", "Recarregue a página para ver os números novos.", "error");
    return failedCount === 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- focusMachine/nextPendingAfter só leem a ordem das máquinas e o DOM
  }, [saving, live, targets, notify, date, shift, overtime, form, existing, session, client, totals]);

  // Ctrl+S salva
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (step === 2) void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, step]);

  // Apontar atrasado é permitido (D10): de 31 dias atrás (ou do primeiro dado) até hoje
  const todayIso = toIsoDate(new Date());
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 31);
  const minDate = live && monthAgo < DATA_START ? monthAgo : DATA_START;

  const q = search.trim().toLowerCase();
  // Máquina desativada no cadastro só aparece se já tem apontamento neste dia e turno (para mostrar o gravado)
  const listed = (m: Machine) => !m.inactive || !!existing[m.id];
  const groups = MACHINE_GROUPS.map((g) => ({
    ...g,
    machines: g.machineIds.map(machineById).filter((m) => listed(m) && (!q || m.name.toLowerCase().includes(q))),
  })).filter((g) => g.machines.length > 0);

  const apontadas = listedIds.filter((id) => existing[id]).length;
  const nextId = nextPendingAfter(null);


  /* ---------- Passo 3: o que o turno tem até agora ---------- */
  const unsavedIds = listedIds.filter((id) => hasInput(form[id], existing[id]));
  const pendingIds = listedIds.filter((id) => !existing[id] && !unsavedIds.includes(id));
  const goodSum = listedIds.reduce((n, id) => n + (existing[id]?.good ?? 0), 0);
  const reworkSum = listedIds.reduce((n, id) => n + (existing[id]?.rework ?? 0), 0);
  const warns: Array<{ id: string; text: string }> = [];
  const opsSeen: Record<string, string[]> = {};
  for (const id of listedIds) {
    const ex = existing[id];
    if (!ex) continue;
    const g = shiftGoal(machineById(id), targets.status === "ready" ? targets.byMachine[id] : undefined, ex.operatorCount ? String(ex.operatorCount) : "", overtime);
    if (g.hasMeta && ex.good > g.meta * TOO_HIGH) warns.push({ id, text: `${formatNumber(ex.good)} peças, mais que o dobro da meta (${formatNumber(g.meta)})` });
    else if (g.hasMeta && ex.good < g.meta * 0.3) warns.push({ id, text: `${formatNumber(ex.good)} peças, menos de 30% da meta (${formatNumber(g.meta)})` });
    for (const op of ex.ops) if (/^\d+$/.test(op)) (opsSeen[op] ??= []).push(id);
  }
  for (const [op, ids] of Object.entries(opsSeen))
    if (ids.length > 1) warns.push({ id: ids[1], text: `OP ${op} também apontada em ${machineById(ids[0]).name}` });

  /** Do passo 3 para uma máquina: volta às máquinas, reabre a já apontada e rola até ela */
  const openMachine = (id: string) => {
    setStep(2);
    if (existing[id]) setReopened((r) => new Set(r).add(id));
    window.setTimeout(() => focusMachine(id), 60);
  };
  const finishShift = async () => {
    // O que está digitado e não foi concluído é gravado junto; se algo impedir, o turno não termina
    if (unsavedIds.length && !(await save())) {
      setStep(2);
      return;
    }
    setFinished(true);
    toTop();
  };
  const askFinish = () => (pendingIds.length ? setConfirmFinish(true) : void finishShift());

  /* ---------- Sair do ambiente: pede confirmação se há algo digitado e não concluído ---------- */
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const leave = (hash: string) => {
    window.location.hash = hash.replace(/^#/, "");
  };
  const requestLeave = (hash: string) => (dirtyRef.current ? setConfirmExit(hash) : leave(hash));
  useEffect(() => {
    // Links de dentro do Dash (menu lateral, logo, "Corrigir no Histórico"…) passam pela mesma confirmação
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || !dirtyRef.current) return;
      const a = (e.target as Element | null)?.closest?.("a[href^='#/']");
      const href = a?.getAttribute("href");
      if (!href || href.startsWith("#/apontamento")) return;
      e.preventDefault();
      e.stopPropagation();
      setConfirmExit(href);
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, []);

  const turnText = `${date.split("-").reverse().join("/")} · ${SHIFT_META[shift].label} · ${overtime ? "Hora extra" : "Normal"}`;

  return (
    <>
      <EntryBar
        step={step}
        turnSet={turnSet}
        finished={finished}
        turnText={turnText}
        dirty={dirty}
        saving={saving}
        onStep={goStep}
        onChangeTurn={changeTurn}
        onDiscard={() => setConfirmDiscard(true)}
        onSave={() => void save()}
        onExit={() => requestLeave("#/dashboard")}
      />

      <PageBody>
        {targets.status === "error" && step === 2 && (
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

        {finished ? (
          <FinishedCard
            apontadas={apontadas}
            total={listedIds.length}
            good={goodSum}
            onNew={() => {
              setFinished(false);
              setTurnSet(false);
              setPicked({ date: "", shift: null, overtime: null });
              setShowTurnErrors(false);
              setStep(1);
              toTop();
            }}
          />
        ) : step === 1 ? (
          <TurnStep
            picked={picked}
            onPick={(p) => setPicked((x) => ({ ...x, ...p }))}
            showErrors={showTurnErrors}
            min={toIsoDate(minDate)}
            max={live ? todayIso : toIsoDate(endOfMonth(DATA_END))}
            today={live ? todayIso : toIsoDate(DATA_END)}
            onContinue={continueToMachines}
          />
        ) : step === 3 ? (
          <ReviewStep
            apontadas={apontadas}
            pendentes={pendingIds}
            unsaved={unsavedIds.length}
            good={goodSum}
            rework={reworkSum}
            warns={warns}
            onOpen={openMachine}
            onBack={() => goStep(2)}
            onFinish={askFinish}
            finishing={saving}
          />
        ) : (
          <>
        {/* ---------- Máquinas por linha, com a situação de cada uma ao lado ---------- */}
        <div className="flex items-start gap-300">
        <div ref={bodyRef} className="flex min-w-0 flex-1 flex-col gap-300">
          {/* Abaixo de 1440px a lista de situação vira uma barra fixa com o progresso e a próxima pendente */}
          <EntryProgressBar
            done={apontadas}
            total={listedIds.length}
            next={nextId ? machineById(nextId).name : null}
            onNext={() => focusMachine(nextId)}
            className="m:hidden"
          />
          {q && groups.length > 0 && (
            <p className="flex flex-wrap items-center gap-100 font-body-small text-subtle" aria-live="polite">
              <Search aria-hidden className="size-icon-small text-icon-subtle" />
              Mostrando as máquinas com “{search.trim()}”, pela busca do topo.
              <Button appearance="subtle" spacing="compact" onClick={onClearSearch}>
                Limpar busca
              </Button>
            </p>
          )}
          {groups.length === 0 && (
            <div className="rounded-xlarge border">
              <EmptyState
                icon={Search}
                title="Nenhuma máquina encontrada"
                hint={`Nada corresponde a "${search}".`}
                action={{ label: "Limpar busca", onClick: onClearSearch }}
              />
            </div>
          )}
          {groups.map((g) => {
            const isCollapsed = collapsed.has(g.id);
            const groupDone = g.machines.filter((m) => existing[m.id]).length;
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
                      {groupDone} de {g.machines.length} apontadas
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
                        collapsed={!!existing[m.id] && !reopened.has(m.id) && !hasInput(form[m.id], existing[m.id])}
                        isNext={nextId === m.id}
                        saving={saving}
                        onReopen={() => {
                          setReopened((r) => new Set(r).add(m.id));
                          focusMachine(m.id);
                        }}
                        onClose={() => setReopened((r) => new Set([...r].filter((x) => x !== m.id)))}
                        onConclude={() => void save({ only: m.id })}
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
        <EntryStatusList
          groups={MACHINE_GROUPS.map((g) => ({ id: g.id, label: g.label, ids: g.machineIds.filter((id) => listedIds.includes(id)) }))}
          state={(id) => (existing[id] ? "done" : hasInput(form[id], existing[id]) ? "typing" : "pending")}
          nextId={nextId}
          done={apontadas}
          total={listedIds.length}
          onGo={focusMachine}
        />
        </div>
          </>
        )}
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
        primary={{ label: "Salvar assim", isLoading: saving, onClick: () => void save({ checked: true, only: confirmHigh?.only }) }}
        cancelLabel="Corrigir"
      >
        {confirmHigh?.names.length === 1 ? "Esta máquina passou" : "Estas máquinas passaram"} de {TOO_HIGH}× a meta do turno: {confirmHigh?.names.join(", ")}.
        Se foi um zero a mais, corrija antes de salvar.
      </Modal>

      <Modal
        open={confirmFinish}
        onOpenChange={setConfirmFinish}
        title={`Terminar com ${pendingIds.length} ${pendingIds.length === 1 ? "máquina pendente" : "máquinas pendentes"}?`}
        primary={{
          label: "Terminar assim",
          onClick: () => {
            setConfirmFinish(false);
            void finishShift();
          },
        }}
        cancelLabel="Voltar"
      >
        Elas ficam sem apontamento neste turno. Dá para apontá-las depois, pelo Apontamento ou corrigindo no Histórico.
      </Modal>

      <Modal
        open={confirmExit != null}
        onOpenChange={(o) => !o && setConfirmExit(null)}
        title="Sair do apontamento?"
        primary={{
          label: "Sair",
          appearance: "danger",
          onClick: () => {
            const to = confirmExit;
            setConfirmExit(null);
            if (to) leave(to);
          },
        }}
        cancelLabel="Continuar apontando"
      >
        O que você digitou e ainda não concluiu será perdido. As máquinas já concluídas continuam gravadas.
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
  collapsed,
  isNext,
  saving,
  onReopen,
  onClose,
  onConclude,
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
  /** já apontada neste turno e sem nada novo digitado: aparece numa linha só */
  collapsed: boolean;
  /** a próxima máquina sem apontamento, na ordem da tela */
  isNext: boolean;
  saving: boolean;
  /** "Lançar mais": reabre a máquina apontada para acrescentar OPs */
  onReopen: () => void;
  onClose: () => void;
  /** grava só esta máquina ("Concluir" ou Enter na quantidade) */
  onConclude: () => void;
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

  // Máquina apontada: uma linha com o resumo, "Lançar mais" e "Corrigir no Histórico"
  if (collapsed && existing)
    return (
      <li id={`maq-${m.id}`} className="flex scroll-mt-[10rem] flex-wrap items-center gap-x-200 gap-y-050 border-t px-200 py-100 first:border-t-0 m:scroll-mt-1000">
        <CircleCheck aria-hidden className="size-icon-small shrink-0 text-icon-success" />
        <h3 className="font-heading-xsmall text-default">{m.name}</h3>
        <span className="min-w-0 flex-1 basis-column-name font-body-small text-subtle">
          <span className="font-semibold tabular-nums text-default">{formatNumber(existing.good)}</span> peças
          {existing.rework > 0 && <> + {formatNumber(existing.rework)} retrabalho</>}
          {existing.ops.length > 0 && (
            <>
              {" "}
              · <span className="font-code">{existing.ops.join(", ")}</span>
            </>
          )}
          {hasMeta && <> · {percent}% da meta do turno</>}
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-100">
          <Button appearance="outline" spacing="compact" iconBefore={Plus} onClick={onReopen} aria-label={`Lançar mais em ${m.name}`}>
            Lançar mais
          </Button>
          <a
            href={`#/historico/${encodeURIComponent(m.id)}`}
            className="inline-flex items-center gap-025 font-body-small text-link hover:underline"
          >
            <History aria-hidden className="size-icon-small" />
            Corrigir no Histórico
          </a>
        </span>
      </li>
    );

  return (
    <li id={`maq-${m.id}`} className="flex scroll-mt-[10rem] flex-col gap-100 border-t px-200 py-150 first:border-t-0 m:scroll-mt-1000">
      {/* Cabeçalho: nome, a linha da máquina (Montagem, Embalagem…) e a situação */}
      <div className="flex flex-wrap items-center gap-x-100 gap-y-050">
        <h3 className="font-heading-xsmall text-default">{m.name}</h3>
        <TagGroup items={m.lines} accentFor={(l) => LINE_ACCENT[l] ?? "gray"} />
        <span className="ml-auto flex items-center gap-050">
          {isNext && <Lozenge appearance="discovery">Próxima</Lozenge>}
          <Lozenge appearance={existing ? "information" : "neutral"}>{existing ? "Já apontado" : "Pendente"}</Lozenge>
        </span>
      </div>
      {entry.error && (
        <p className="font-body-small text-danger" role="alert">
          Não salvou: {entry.error}
        </p>
      )}

      {/* Meta do turno e OP liberada, numa linha */}
      <div className="flex flex-wrap items-center gap-x-250 gap-y-050 font-body-small text-subtle">
        <span>
          {hasMeta ? (
            <>
              Meta do turno <span className="font-semibold tabular-nums text-default">{formatNumber(meta)}</span>
              {turn.dependeDaLotacao && ` (${baseLabel(base).toLowerCase()}, ${turn.pessoas} ${turn.pessoas === 1 ? "pessoa" : "pessoas"}`}
              {turn.dependeDaLotacao && base === "per_shift_prorated" && crew && turn.pessoas > crew && `, conta até ${crew}`}
              {turn.dependeDaLotacao && ")"}
            </>
          ) : !m.hasTarget ? (
            "Por demanda, sem meta"
          ) : overtime ? (
            "Hora extra, fora da meta"
          ) : target ? (
            "Sem meta cadastrada nesta data"
          ) : (
            "Carregando a meta do dia…"
          )}
        </span>
        {openOps.length > 0 && (
          <span>
            {openOps.length === 1 ? "OP liberada" : "OPs liberadas"}{" "}
            {openOps.map((op, i) => (
              <span key={op.id}>
                {i > 0 && ", "}
                <a href={`#/feedbacks/${op.id.replace("OP ", "")}`} className="font-code font-semibold text-link hover:underline">
                  {op.id.replace("OP ", "")}
                </a>
              </span>
            ))}
          </span>
        )}
      </div>
      {hasMeta && total > 0 && (
        <div className="flex flex-wrap items-center gap-100">
          <SegmentedBar percent={percent} status={status} label={`${m.name}: ${percent}% da meta do turno`} />
          <span className="font-medium tabular-nums text-default">{percent}%</span>
          <Lozenge appearance={STATUS_META[status].appearance}>{STATUS_META[status].label}</Lozenge>
          <span className="font-body-small text-subtle">
            <span className="font-semibold tabular-nums text-default">{formatNumber(total)}</span> de {formatNumber(meta)} peças
          </span>
        </div>
      )}
      {turn.estimada && <p className="font-body-small text-warning">Informe o nº de operadores: a meta deste posto depende dele.</p>}
      {existing && (
        <p className="font-body-small text-subtle">
          Já gravado neste turno: <span className="font-semibold tabular-nums text-default">{formatNumber(existing.good)}</span> peças
          {existing.rework > 0 && <> + {formatNumber(existing.rework)} retrabalho</>}
          {existing.ops.length > 0 && (
            <>
              {" "}
              · <span className="font-code">{existing.ops.join(", ")}</span>
            </>
          )}
          {" · "}
          <a href={`#/historico/${encodeURIComponent(m.id)}`} className="inline-flex items-center gap-025 text-link hover:underline">
            <History aria-hidden className="size-icon-small" />
            Corrigir no Histórico
          </a>
        </p>
      )}
      <datalist id={listId}>
        {openOps.map((op) => (
          <option key={op.id} value={op.id.replace("OP ", "")}>
            {`Material ${op.material} · ${op.product}`}
          </option>
        ))}
      </datalist>

      {/* OPs */}
      <div className="flex min-w-0 flex-col gap-100">
      {entry.rows.map((r, i) => {
        const errors = showErrors || r.op || r.qty ? rowErrors(r) : {};
        return (
          // Cada OP num bloco próprio, com linha entre uma e outra: o motivo do retrabalho fica claramente com a sua OP
          <div key={r.key} className={cn("flex flex-wrap items-start gap-100", i > 0 && "border-t pt-150")}>
            <TextField
              label={entry.rows.length > 1 ? `Nº da OP ${i + 1}` : "Nº da OP"}
              aria-label={`Nº da OP, linha ${i + 1}, ${m.name}`}
              inputMode="numeric"
              placeholder="Ex.: 4501234"
              list={listId}
              value={r.op}
              onChange={(e) => setRow(r.key, { op: e.target.value.replace(/\D/g, "").slice(0, 15) })}
              error={showErrors || (r.qty && !r.op) ? errors.op : null}
              warning={errors.op ? null : hintFor(r.op)}
              helper={releasedNumbers.includes(r.op) ? "OP liberada desta máquina" : undefined}
              inputClassName="text-right font-code tabular-nums"
              className="w-field-op flex-1 basis-field-op s:flex-none"
            />
            <TextField
              label="Quantidade"
              aria-label={`Quantidade, linha ${i + 1}, ${m.name}`}
              inputMode="numeric"
              placeholder="0"
              value={r.qty}
              onChange={(e) => setRow(r.key, { qty: e.target.value.replace(/[^\d]/g, "") })}
              // Enter na quantidade conclui a máquina e leva à próxima
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                onConclude();
              }}
              error={errors.qty}
              elemAfter="un."
              inputClassName="text-right tabular-nums"
              className="w-field-quantity flex-1 basis-field-quantity s:flex-none"
            />
            <label
              className={cn(
                "flex h-control items-center gap-075 rounded-medium border px-100 font-body s:mt-250",
                r.rework ? "border-selected bg-selected text-selected" : "border-input bg-surface text-subtle",
              )}
            >
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
              className="s:mt-250"
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

        {/* Nº de operadores (em toda máquina) e o que se pode acrescentar */}
        <div className="flex flex-wrap items-start gap-100">
          <TextField
            label="Nº de operadores"
            aria-label={`Nº de operadores, ${m.name}`}
            inputMode="numeric"
            placeholder={turn.dependeDaLotacao && crew ? String(crew) : "–"}
            value={entry.people}
            onChange={(e) => onChange((x) => ({ ...x, people: e.target.value.replace(/\D/g, "").slice(0, 2) }))}
            error={peopleRequired && showErrors && !entry.people.trim() && (total > 0 || !!existing) ? "Informe quantas pessoas trabalharam" : null}
            inputClassName="text-right tabular-nums"
            className="w-field-quantity"
          />
          <Button
            appearance="outline"
            iconBefore={Plus}
            onClick={() => onChange((e) => ({ ...e, rows: [...e.rows, newRow()] }))}
            className="!text-link s:mt-250"
          >
            Adicionar OP
          </Button>
          {!entry.noteOpen && (
            <Button
              appearance="outline"
              iconBefore={MessageSquarePlus}
              onClick={() => onChange((e) => ({ ...e, noteOpen: true }))}
              className="!text-link s:mt-250"
            >
              Adicionar observação
            </Button>
          )}
        </div>
        {/* A ajuda do campo só aparece quando o número muda a meta; nos outros postos ele fala por si */}
        {(peopleRequired || (turn.dependeDaLotacao && hasMeta)) && (
          <p className="font-body-small text-subtlest">{peopleRequired ? `Obrigatório. ${peopleHelp}` : peopleHelp}</p>
        )}
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

      {/* Concluir grava só esta máquina; as outras continuam como estão */}
      <div className="flex flex-wrap items-center gap-100 border-t pt-100">
        {existing && (
          <Button appearance="outline" iconBefore={ChevronUp} onClick={onClose} isDisabled={hasInput(entry, existing)}>
            Recolher
          </Button>
        )}
        <Button appearance="primary" iconBefore={Check} isLoading={saving} onClick={onConclude} aria-label={`Concluir ${m.name}`} className="ml-auto">
          Concluir
        </Button>
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

/* ---------- Situação do turno: progresso e a próxima pendente ---------- */
function ProgressTrack({ done, total }: { done: number; total: number }) {
  return (
    <span
      role="progressbar"
      aria-label="Máquinas apontadas"
      aria-valuenow={done}
      aria-valuemin={0}
      aria-valuemax={total}
      className="flex h-075 overflow-hidden rounded-full bg-neutral"
    >
      <span className="h-full rounded-full bg-success-bold" style={{ width: `${(done / Math.max(total, 1)) * 100}%` }} />
    </span>
  );
}

/** Abaixo de 1440px: barra fixa no topo da lista */
function EntryProgressBar({
  done,
  total,
  next,
  onNext,
  className,
}: {
  done: number;
  total: number;
  next: string | null;
  onNext: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky top-topnav z-sticky flex flex-wrap items-center gap-x-200 gap-y-100 rounded-large border bg-surface-raised px-200 py-100 shadow-raised",
        className,
      )}
      data-entry-progress
      aria-live="polite"
    >
      <span className="flex min-w-column-name flex-1 flex-col gap-050">
        <span className="font-body-small text-subtle">
          <span className="font-semibold tabular-nums text-default">{done}</span> de {total} apontadas
        </span>
        <ProgressTrack done={done} total={total} />
      </span>
      {next && (
        <Button appearance="default" spacing="compact" onClick={onNext} className="max-w-full">
          <span className="truncate">Próxima: {next}</span>
        </Button>
      )}
    </div>
  );
}

/** A partir de 1440px: lista de situação fixa ao lado das máquinas */
function EntryStatusList({
  groups,
  state,
  nextId,
  done,
  total,
  onGo,
}: {
  groups: Array<{ id: string; label: string; ids: string[] }>;
  state: (id: string) => "done" | "typing" | "pending";
  nextId: string | null;
  done: number;
  total: number;
  onGo: (id: string) => void;
}) {
  const DOT = { done: "bg-icon-success border-transparent", typing: "bg-icon-warning border-transparent", pending: "border-input" } as const;
  const LABEL = { done: "apontada", typing: "digitando, não gravada", pending: "pendente" } as const;
  return (
    <aside
      id="entry-status"
      aria-label="Situação das máquinas no turno"
      // Cerca de um terço da largura, entre o mínimo e o máximo: acompanha o tamanho da tela
      style={{ width: "clamp(var(--dash-size-entry-status-min), var(--dash-entry-status-ratio), var(--dash-size-entry-status-max))" }}
      className="scrollbar-thin hidden shrink-0 flex-col gap-200 rounded-large bg-surface-raised p-200 shadow-raised m:sticky m:top-1000 m:flex m:max-h-[calc(100dvh-7.5rem)] m:overflow-y-auto"
    >
      <div className="flex flex-col gap-075" aria-live="polite">
        <span className="font-body-small text-subtle">
          <span className="font-semibold tabular-nums text-default">{done}</span> de {total} apontadas
        </span>
        <ProgressTrack done={done} total={total} />
      </div>
      {groups
        .filter((g) => g.ids.length)
        .map((g) => (
          <div key={g.id} className="flex flex-col gap-050">
            <span className="font-body-small font-semibold text-subtlest">{g.label}</span>
            <ul className="flex flex-col">
              {g.ids.map((id) => {
                const st = state(id);
                const name = machineById(id).name;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => onGo(id)}
                      title={name}
                      aria-label={`${name}: ${LABEL[st]}`}
                      className={cn(
                        "ds-pressable mb-025 flex w-full items-center gap-100 rounded-medium border px-075 py-050 text-left font-body-small",
                        id === nextId
                          ? "border-selected bg-selected font-semibold text-selected"
                          : st === "done"
                            ? "bg-surface text-subtle hover:bg-neutral-subtle-hovered"
                            : "bg-surface text-default hover:bg-neutral-subtle-hovered",
                      )}
                    >
                      <span aria-hidden className={cn("size-dot shrink-0 rounded-full border-thick", DOT[st])} />
                      <span className="min-w-0 truncate">{name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
    </aside>
  );
}

/* ---------- Ambiente de apontamento: barra do topo, passos 1 e 3 e término ---------- */
const STEPS: Array<[Step, string]> = [
  [1, "Turno"],
  [2, "Máquinas"],
  [3, "Conferir e terminar"],
];

/**
 * Barra fixa do ambiente: nome, passos, o turno escolhido (com "Trocar") e, nas
 * máquinas, o estado do que está digitado e as ações do turno inteiro.
 */
function EntryBar({
  step,
  turnSet,
  finished,
  turnText,
  dirty,
  saving,
  onStep,
  onChangeTurn,
  onDiscard,
  onSave,
  onExit,
}: {
  step: Step;
  turnSet: boolean;
  finished: boolean;
  turnText: string;
  dirty: boolean;
  saving: boolean;
  onStep: (n: Step) => void;
  onChangeTurn: () => void;
  onDiscard: () => void;
  onSave: () => void;
  onExit: () => void;
}) {
  return (
    <div data-entry-bar className={cn(PAGE_GUTTER, "z-sticky border-b border-t-thick border-t-brand bg-surface m:sticky m:top-0")}>
      <div className="flex flex-wrap items-center gap-x-200 gap-y-100 py-150">
        <div className="flex w-full items-center gap-150 s:w-auto">
          <h1 className="font-heading-medium text-default">Apontamento</h1>
          <span className="hidden s:inline-flex">
            <Lozenge appearance="information">Ambiente de apontamento</Lozenge>
          </span>
          {/* No celular o Sair fica na primeira linha, só com o ícone */}
          <IconButton icon={LogOut} label="Sair do apontamento" appearance="default" onClick={onExit} className="ml-auto s:hidden" />
        </div>
        <ol aria-label="Passos do apontamento" className="flex flex-wrap items-center gap-050">
          {STEPS.map(([n, label]) => {
            const current = !finished && step === n;
            const done = finished || step > n;
            const blocked = n > 1 && !turnSet;
            return (
              <li key={n}>
                <button
                  type="button"
                  aria-current={current ? "step" : undefined}
                  disabled={blocked}
                  onClick={() => onStep(n)}
                  className={cn(
                    "ds-pressable flex h-control items-center gap-075 rounded-full pl-050 pr-150 font-medium",
                    current ? "bg-selected text-selected" : "text-subtle hover:bg-neutral-subtle-hovered",
                    blocked && "cursor-not-allowed text-disabled hover:bg-transparent",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-icon-medium items-center justify-center rounded-full font-body-small font-bold",
                      current ? "bg-brand-bold text-inverse" : done ? "bg-success text-success" : "bg-neutral text-subtle",
                    )}
                  >
                    {done && !current ? <Check className="size-icon-small" /> : n}
                  </span>
                  {label}
                </button>
              </li>
            );
          })}
        </ol>
        {turnSet && step > 1 && !finished && (
          <span className="flex items-center gap-050 font-body-small text-subtle">
            <span className="rounded-full border bg-surface-sunken px-100 py-025 tabular-nums">{turnText}</span>
            <Button appearance="default" spacing="compact" onClick={onChangeTurn}>
              Trocar
            </Button>
          </span>
        )}
        <span className="ml-auto flex flex-wrap items-center gap-100">
          {step === 2 && !finished && (
            <span className="hidden items-center gap-100 s:flex">
              <IconButton icon={RotateCcw} label="Descartar alterações" isDisabled={!dirty} onClick={onDiscard} appearance="default" />
              <Button appearance="primary" iconBefore={Save} isLoading={saving} onClick={onSave} title="Ctrl+S">
                Salvar tudo
                {/* Ponto de aviso: há o que digitar sem concluir (a lista ao lado mostra quais) */}
                {dirty && (
                  <>
                    <span aria-hidden className="size-status-dot rounded-full bg-icon-warning" />
                    <span className="sr-only">(há alterações não salvas)</span>
                  </>
                )}
              </Button>
            </span>
          )}
          <span className="hidden s:inline-flex">
            <Button appearance="default" iconBefore={LogOut} onClick={onExit} aria-label="Sair do apontamento" title="Sair do apontamento">
              Sair
            </Button>
          </span>
        </span>
      </div>
    </div>
  );
}

/** Passo 1: quem aponta escolhe de qual turno é; nada vem preenchido */
function TurnStep({
  picked,
  onPick,
  showErrors,
  min,
  max,
  today,
  onContinue,
}: {
  picked: { date: string; shift: Shift | null; overtime: boolean | null };
  onPick: (p: Partial<{ date: string; shift: Shift | null; overtime: boolean | null }>) => void;
  showErrors: boolean;
  min: string;
  max: string;
  today: string;
  onContinue: () => void;
}) {
  return (
    <section
      aria-labelledby="entry-turn-title"
      className="mx-auto flex w-full max-w-modal flex-col gap-300 rounded-xlarge bg-surface-raised p-300 shadow-raised"
    >
      <header>
        <h2 id="entry-turn-title" className="font-heading-large text-default">
          De qual turno é este apontamento?
        </h2>
        <p className="mt-050 text-subtle">Escolha a data, o turno e o regime. O que você lançar a seguir vai para este turno.</p>
      </header>
      <DateField
        label="Data"
        value={picked.date}
        min={min}
        max={max}
        today={today}
        onChange={(d) => onPick({ date: d })}
        error={showErrors && !picked.date ? "Escolha a data" : undefined}
      />
      <OptionCards
        label="Turno"
        value={picked.shift == null ? null : (String(picked.shift) as "1" | "2" | "3")}
        onChange={(v) => onPick({ shift: Number(v) as Shift })}
        options={SHIFTS.map((sh) => ({ value: String(sh) as "1" | "2" | "3", label: SHIFT_META[sh].label }))}
        error={showErrors && picked.shift == null ? "Escolha o turno" : null}
      />
      <OptionCards
        label="Regime"
        value={picked.overtime == null ? null : picked.overtime ? "overtime" : "regular"}
        onChange={(v) => onPick({ overtime: v === "overtime" })}
        options={[
          { value: "regular", label: "Normal" },
          { value: "overtime", label: "Hora extra" },
        ]}
        error={showErrors && picked.overtime == null ? "Escolha o regime" : null}
      />
      <div>
        <Button appearance="primary" iconAfter={ArrowRight} onClick={onContinue}>
          Continuar para as máquinas
        </Button>
      </div>
    </section>
  );
}

/** Passo 3: resumo do turno, avisos de conferência e o botão de terminar */
function ReviewStep({
  apontadas,
  pendentes,
  unsaved,
  good,
  rework,
  warns,
  onOpen,
  onBack,
  onFinish,
  finishing,
}: {
  apontadas: number;
  pendentes: string[];
  unsaved: number;
  good: number;
  rework: number;
  warns: Array<{ id: string; text: string }>;
  onOpen: (id: string) => void;
  onBack: () => void;
  onFinish: () => void;
  finishing: boolean;
}) {
  const kpi = "flex flex-col gap-025 border-r px-250 py-200 last:border-r-0";
  return (
    <div className="mx-auto flex w-full max-w-entry-review flex-col gap-200">
      <section aria-label="Resumo do turno" className="grid grid-cols-1 overflow-hidden rounded-xlarge bg-surface-raised shadow-raised s:grid-cols-3">
        <div className={kpi}>
          <span className="font-body-small text-subtle">Apontadas</span>
          <strong className="font-heading-xlarge tabular-nums text-default">{apontadas}</strong>
        </div>
        <div className={kpi}>
          <span className="font-body-small text-subtle">Pendentes</span>
          <strong className={cn("font-heading-xlarge tabular-nums", pendentes.length ? "text-warning" : "text-default")}>{pendentes.length}</strong>
        </div>
        <div className={kpi}>
          <span className="font-body-small text-subtle">Peças boas</span>
          <strong className="font-heading-xlarge tabular-nums text-default">{formatNumber(good)}</strong>
          {rework > 0 && <span className="font-body-small text-subtle">+ {formatNumber(rework)} de retrabalho</span>}
        </div>
      </section>

      {unsaved > 0 && (
        <p role="status" className="flex items-start gap-100 rounded-large bg-warning px-200 py-150 text-warning">
          <CircleAlert aria-hidden className="mt-025 size-icon-small shrink-0" />
          <span>
            {unsaved === 1 ? "1 máquina tem dados digitados e ainda não concluídos" : `${unsaved} máquinas têm dados digitados e ainda não concluídos`}.
            Terminar o turno grava {unsaved === 1 ? "essa máquina" : "essas máquinas"} junto.
          </span>
        </p>
      )}

      {warns.length > 0 && (
        <section className="flex flex-col gap-100 rounded-xlarge bg-surface-raised p-250 shadow-raised">
          <h2 className="font-heading-small text-default">Vale conferir</h2>
          <ul className="flex flex-col">
            {warns.map((w) => (
              <li key={`${w.id}-${w.text}`} className="flex flex-wrap items-center justify-between gap-100 border-t py-100 first:border-t-0">
                <span>
                  <span className="font-semibold text-default">{machineById(w.id).name}</span>: {w.text}
                </span>
                <Button appearance="default" spacing="compact" onClick={() => onOpen(w.id)}>
                  Abrir
                </Button>
              </li>
            ))}
          </ul>
          <p className="font-body-small text-subtlest">Os avisos não impedem de terminar.</p>
        </section>
      )}

      {pendentes.length > 0 && (
        <section className="flex flex-col gap-100 rounded-xlarge bg-surface-raised p-250 shadow-raised">
          <h2 className="font-heading-small text-default">Ainda sem apontamento</h2>
          <ul className="flex flex-col">
            {pendentes.map((id) => (
              <li key={id} className="flex flex-wrap items-center justify-between gap-100 border-t py-100 first:border-t-0">
                <span>{machineById(id).name}</span>
                <Button appearance="default" spacing="compact" onClick={() => onOpen(id)}>
                  Apontar
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-end gap-100">
        <Button appearance="default" onClick={onBack}>
          Voltar às máquinas
        </Button>
        <Button appearance="primary" iconBefore={Check} isLoading={finishing} onClick={onFinish}>
          Terminar o turno
        </Button>
      </div>
    </div>
  );
}

/** Depois de terminar: o resumo curto e para onde ir */
function FinishedCard({ apontadas, total, good, onNew }: { apontadas: number; total: number; good: number; onNew: () => void }) {
  return (
    <section className="mx-auto flex w-full max-w-modal flex-col items-center gap-200 rounded-xlarge bg-surface-raised p-400 text-center shadow-raised">
      <CircleCheck aria-hidden className="size-empty-icon text-icon-success" />
      <h2 className="font-heading-large text-default">Turno encerrado</h2>
      <p className="text-subtle">
        {apontadas} de {total} máquinas apontadas e {formatNumber(good)} peças boas. Correções depois disso são feitas no Histórico.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-100">
        <Button appearance="default" onClick={onNew}>
          Começar outro apontamento
        </Button>
        <a
          href="#/dashboard"
          className="ds-pressable inline-flex h-control items-center rounded-medium bg-brand-bold px-150 font-medium text-inverse hover:bg-brand-bold-hovered active:bg-brand-bold-pressed"
        >
          Ir para o Dashboard
        </a>
      </div>
    </section>
  );
}
