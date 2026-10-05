import { LINES, MACHINES } from "@/data/machines";
import { TextField } from "@/components/ui/TextField";
import type { OpDraft, opErrors } from "./opDraft";

/** Campos de uma OP (cadastrar ou conferir) */
export function OpFields({
  draft,
  onChange,
  errors,
  withNumber,
}: {
  draft: OpDraft;
  onChange: (d: OpDraft) => void;
  errors: ReturnType<typeof opErrors> | null;
  withNumber: boolean;
}) {
  return (
    <>
      {withNumber && (
        <TextField
          label="Número da OP"
          isRequired
          inputMode="numeric"
          placeholder="Ex.: 4519876"
          value={draft.number}
          onChange={(e) => onChange({ ...draft, number: e.target.value.replace(/\D/g, "").slice(0, 15) })}
          error={errors?.number}
          className="w-column-name"
        />
      )}
      <div className="flex flex-col gap-050">
        <label htmlFor="op-machine" className="font-body-small font-semibold text-subtle">
          Máquina{" "}
          <span aria-hidden className="text-danger">
            *
          </span>
        </label>
        <select
          id="op-machine"
          value={draft.machineId}
          onChange={(e) => onChange({ ...draft, machineId: e.target.value })}
          className="h-control rounded-medium border border-input bg-input px-100 text-default hover:bg-input-hovered focus:border-focused"
        >
          {LINES.map((l) => (
            <optgroup key={l} label={l}>
              {MACHINES.filter((m) => m.line === l && !m.inactive).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      {/* O material anda junto com a OP: código + descrição */}
      <div className="flex flex-wrap items-start gap-200">
        <TextField
          label="Material"
          isRequired
          inputMode="numeric"
          placeholder="Ex.: 12345678"
          value={draft.material}
          onChange={(e) => onChange({ ...draft, material: e.target.value.replace(/\D/g, "").slice(0, 18) })}
          error={errors?.material}
          inputClassName="font-code"
          className="w-column-name"
        />
        <TextField
          label="Descrição do material"
          isRequired
          placeholder="Ex.: Tomada 10A"
          value={draft.product}
          onChange={(e) => onChange({ ...draft, product: e.target.value })}
          error={errors?.product}
          className="min-w-column-name flex-1"
        />
      </div>
      <TextField
        label="Quantidade pedida"
        isRequired
        inputMode="numeric"
        value={draft.planned}
        onChange={(e) => onChange({ ...draft, planned: e.target.value.replace(/\D/g, "") })}
        elemAfter="peças"
        error={errors?.planned}
        className="w-column-name"
      />
    </>
  );
}
