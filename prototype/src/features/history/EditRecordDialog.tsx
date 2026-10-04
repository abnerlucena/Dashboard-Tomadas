import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { UpdateEntryChanges } from "../../../../src/lib/repositories/types";
import { exigeOperadores } from "../../../../src/lib/metas";
import { mensagemDeErro } from "../../../../src/lib/erros";
import { SHIFTS, SHIFT_META, machineById, toIsoDate, type ProductionOrder, type Shift } from "@/data/machines";
import { Button, IconButton } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { DateField } from "@/components/ui/DateField";
import { ErrorMessage } from "@/components/ui/Feedback";
import { Modal } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextArea, TextField } from "@/components/ui/TextField";
import { useDayTargets } from "@/features/entry/dayTargets";
import { formatNumber } from "@/lib/utils";
import {
  IMPORTED_OP,
  changesOf,
  draftOf,
  draftTotals,
  isImported,
  newDraftRow,
  validateDraft,
  type EditDraft,
  type EditOriginal,
} from "./editPlan";

/*
 * Corrigir o apontamento inteiro (máquina + dia + turno + regime) pelo
 * `updateEntry`: a lista de OPs (substitui), data, turno, regime, nº de pessoas
 * e observação. Só vai o que mudou. Os erros do banco (destino ocupado, OP fora
 * do formato, nº de pessoas que falta, permissão) aparecem como vieram.
 */
interface Props {
  order: ProductionOrder;
  original: EditOriginal;
  minDate: string;
  onClose: () => void;
  /** Grava e recarrega; lança o erro do banco */
  onSave: (changes: UpdateEntryChanges) => Promise<void>;
}

export function EditRecordDialog({ order, original, minDate, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<EditDraft>(() => draftOf(original));
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = toIsoDate(new Date());
  const machine = machineById(order.machineId);
  // O nº de pessoas é obrigatório onde a meta é por pessoa (D54), pela base vigente na data escolhida
  const targets = useDayTargets(draft.date || original.date);
  const peopleRequired = targets.status === "ready" && exigeOperadores(targets.byMachine[order.machineId]?.base);

  const errors = validateDraft(draft, original, today);
  const peopleMissing = peopleRequired && !draft.people.trim() ? "Obrigatório: a meta desta máquina é por pessoa" : null;
  const changes = changesOf(draft, original);
  const totals = draftTotals(draft);
  const imported = isImported(original);

  const set = (patch: Partial<EditDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const setRow = (key: string, patch: Partial<EditDraft["rows"][number]>) =>
    setDraft((d) => ({ ...d, rows: d.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));

  const save = async () => {
    setTouched(true);
    if (errors.any || peopleMissing || !changes) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(changes);
    } catch (e) {
      setSaving(false);
      setError(mensagemDeErro(e));
    }
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && !saving && onClose()}
      title="Corrigir apontamento"
      primary={{ label: "Salvar", onClick: save, isLoading: saving, isDisabled: !changes || (touched && (errors.any || !!peopleMissing)) }}
    >
      <div className="flex flex-col gap-200">
        <p className="text-subtle">{machine.name}. Vale para o apontamento inteiro da máquina no turno: todas as OPs abaixo.</p>

        <fieldset className="flex flex-col gap-100">
          <legend className="mb-050 font-body-small font-semibold text-subtle">Ordens de produção</legend>
          {draft.rows.map((r, i) => {
            const e = touched ? errors.rows[r.key] : undefined;
            return (
              <div key={r.key} className="flex flex-wrap items-start gap-100">
                <TextField
                  label={`Nº da OP, linha ${i + 1}`}
                  hideLabel={i > 0}
                  value={r.op}
                  maxLength={15}
                  inputMode={r.op === IMPORTED_OP ? "text" : "numeric"}
                  readOnly={r.op === IMPORTED_OP}
                  onChange={(ev) => setRow(r.key, { op: ev.target.value.replace(/\D/g, "") })}
                  error={e?.op}
                  helper={r.op === IMPORTED_OP && i === 0 ? "Veio da planilha" : undefined}
                  className="min-w-0 flex-1 basis-[9rem]"
                  inputClassName="tabular-nums"
                />
                <TextField
                  label={`Quantidade, linha ${i + 1}`}
                  hideLabel={i > 0}
                  value={r.qty}
                  inputMode="numeric"
                  onChange={(ev) => setRow(r.key, { qty: ev.target.value.replace(/\D/g, "") })}
                  error={e?.qty}
                  elemAfter="un."
                  className="w-[8.5rem]"
                  inputClassName="tabular-nums"
                />
                <label className={`flex h-control items-center gap-075 text-default ${i === 0 ? "mt-[1.375rem]" : ""}`}>
                  <Checkbox
                    label={`Retrabalho, linha ${i + 1}`}
                    checked={r.rework}
                    onChange={(ev) => setRow(r.key, { rework: ev.target.checked })}
                  />
                  <span aria-hidden>Retrabalho</span>
                </label>
                <IconButton
                  icon={Trash2}
                  label={`Tirar a linha ${i + 1}`}
                  className={i === 0 ? "mt-[1.375rem]" : undefined}
                  onClick={() => set({ rows: draft.rows.length > 1 ? draft.rows.filter((x) => x.key !== r.key) : [newDraftRow()] })}
                />
              </div>
            );
          })}
          <div className="flex flex-wrap items-center justify-between gap-100">
            <Button appearance="subtle" spacing="compact" iconBefore={Plus} onClick={() => set({ rows: [...draft.rows, newDraftRow()] })}>
              {imported ? "Adicionar OP" : "Adicionar linha"}
            </Button>
            <span className="font-body-small text-subtle tabular-nums">
              {formatNumber(totals.good)} boas{totals.rework > 0 && ` · ${formatNumber(totals.rework)} de retrabalho`}
            </span>
          </div>
          {draft.rows.every((r) => !r.op.trim() && !r.qty.trim()) && (
            <p className="font-body-small text-warning">Sem OP, o apontamento continua, mas sem peça (máquina parada).</p>
          )}
        </fieldset>

        <div className="grid grid-cols-1 gap-150 s:grid-cols-2">
          <DateField
            label="Data"
            isRequired
            value={draft.date}
            onChange={(date) => set({ date })}
            min={minDate}
            max={today}
            today={today}
            error={touched ? errors.date : null}
          />
          <TextField
            label="Nº de pessoas"
            value={draft.people}
            inputMode="numeric"
            onChange={(ev) => set({ people: ev.target.value.replace(/\D/g, "") })}
            error={touched ? (errors.people ?? peopleMissing) : null}
            helper={peopleRequired ? "Obrigatório: a meta desta máquina é por pessoa" : "Vazio apaga o número gravado"}
            isRequired={peopleRequired}
          />
        </div>

        <div className="flex flex-wrap gap-200">
          <div className="flex flex-col gap-050">
            <span className="font-body-small font-semibold text-subtle">Turno</span>
            <SegmentedControl
              label="Turno"
              iconOnly={false}
              size="control"
              value={String(draft.shift)}
              onChange={(v) => set({ shift: Number(v) as Shift })}
              options={SHIFTS.map((s) => ({ value: String(s), label: SHIFT_META[s].label }))}
            />
          </div>
          <div className="flex flex-col gap-050">
            <span className="font-body-small font-semibold text-subtle">Regime</span>
            <SegmentedControl
              label="Regime"
              iconOnly={false}
              size="control"
              value={draft.overtime ? "overtime" : "regular"}
              onChange={(v) => set({ overtime: v === "overtime" })}
              options={[
                { value: "regular", label: "Normal" },
                { value: "overtime", label: "Hora extra" },
              ]}
            />
          </div>
        </div>

        <TextArea
          label="Observação"
          maxLength={500}
          value={draft.notes}
          onChange={(ev) => set({ notes: ev.target.value })}
          helper="Vazia apaga."
        />

        {(changes?.date || changes?.turno || changes?.workMode) && (
          <p className="font-body-small text-subtle">
            {changes.date && "Mudar a data refaz a meta do apontamento com a do dia novo. "}
            {changes.workMode === "overtime" && "Hora extra fica fora do atingimento da meta. "}
            Se já existir apontamento da máquina no destino, o banco recusa e diz qual é.
          </p>
        )}

        {error && <ErrorMessage title="Não foi possível salvar a correção">{error}</ErrorMessage>}
      </div>
    </Modal>
  );
}
