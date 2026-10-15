import { PackageX, Pencil, Plus, Trash2, UserX, X } from "lucide-react";
import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { MACHINE_GROUPS, machineById, type Shift } from "@/data/machines";
import { Button, IconButton } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Lozenge } from "@/components/ui/Lozenge";
import { OptionCards } from "@/components/ui/OptionCards";
import { TextField, inputBase } from "@/components/ui/TextField";
import { useAccess } from "@/features/access/AccessContext";
import { PROCESS_LABEL } from "@/features/registry/registry";
import { mensagemDeErro } from "../../../../src/lib/erros";
import { cn, type Notify } from "@/lib/utils";
import {
  ABSENCE_KINDS,
  ABSENCE_META,
  canFixShortage,
  isMaterialCode,
  machineName,
  searchCollaborators,
  searchMaterials,
  tidyName,
  validateCollaborator,
  type Absence,
  type AbsenceKind,
  type Collaborator,
  type Material,
  type MaterialShortage,
} from "./occurrences";
import { occurrencesOf, useOccurrences } from "./OccurrencesStore";

/**
 * Ocorrências do turno: materiais faltantes e falta de pessoas. Aparece no
 * passo 3 do Apontamento e na correção pelo Histórico. Cada item grava na hora
 * (como o "Concluir" de cada máquina); nenhum é obrigatório.
 */
export function ShiftOccurrences({
  date,
  shift,
  materialStops = [],
  notify,
  showHeading = true,
}: {
  /** aaaa-mm-dd */
  date: string;
  shift: Shift;
  /** máquinas que marcaram "Não produziu" por falta de material neste turno */
  materialStops?: string[];
  notify: Notify;
  /** false dentro de uma janela que já tem o título */
  showHeading?: boolean;
}) {
  const store = useOccurrences();
  const titleId = useId();
  const { absences, shortages } = occurrencesOf(store, date, shift);
  return (
    <section aria-labelledby={showHeading ? titleId : undefined} aria-label={showHeading ? undefined : "Ocorrências do turno"} className="flex flex-col gap-150">
      {showHeading && (
        <div className="flex flex-col gap-025">
          <h2 id={titleId} className="font-heading-medium text-default">
            Ocorrências do turno
          </h2>
          <p className="text-subtle">Valem para o turno inteiro. Nenhuma é obrigatória: se nada aconteceu, é só terminar.</p>
        </div>
      )}
      <MaterialsCard date={date} shift={shift} items={shortages} materialStops={materialStops} notify={notify} />
      <PeopleCard date={date} shift={shift} items={absences} notify={notify} />
    </section>
  );
}

/* ---------- Moldura dos dois blocos ---------- */

function Card({
  icon: Icon,
  title,
  count,
  action,
  children,
}: {
  icon: typeof PackageX;
  title: string;
  count: number;
  action: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-150 rounded-xlarge bg-surface-raised p-250 shadow-raised">
      <div className="flex flex-wrap items-center gap-100">
        <Icon aria-hidden className="size-icon-medium shrink-0 text-icon-subtle" />
        <h3 id={id} className="font-heading-small text-default">
          {title}
        </h3>
        <Lozenge appearance={count ? "information" : "neutral"}>{count === 0 ? "nenhum" : String(count)}</Lozenge>
        <span className="ml-auto">{action}</span>
      </div>
      {children}
    </section>
  );
}

/** Sem `onEdit`/`onRemove`, a linha fica só para leitura (o banco não deixa corrigir) */
function ItemRow({ title, sub, onEdit, onRemove, label }: { title: ReactNode; sub: ReactNode; onEdit?: () => void; onRemove?: () => void; label: string }) {
  return (
    <li className="flex items-start gap-100 border-t py-100 first:border-t-0 first:pt-0">
      <div className="flex min-w-0 flex-1 flex-col gap-025">
        <span className="break-words font-medium text-default">{title}</span>
        <span className="break-words font-body-small text-subtle">{sub}</span>
      </div>
      {onEdit && <IconButton icon={Pencil} label={`Editar ${label}`} spacing="compact" onClick={onEdit} />}
      {onRemove && <IconButton icon={Trash2} label={`Tirar ${label}`} spacing="compact" onClick={onRemove} />}
    </li>
  );
}

/* ---------- Busca com lista (combobox) ---------- */

interface ComboOption {
  key: string;
  label: ReactNode;
  hint?: ReactNode;
  /** opção de ação ("Não está na lista…"), com outro visual */
  action?: boolean;
  onPick: () => void;
}

/** Campo de busca com a lista logo abaixo: setas escolhem, Enter confirma */
function SearchCombo({
  label,
  value,
  onChange,
  placeholder,
  options,
  empty,
  helper,
  error,
  autoFocus,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: ComboOption[];
  empty?: string | null;
  helper?: string;
  error?: string | null;
  autoFocus?: boolean;
  inputMode?: "text" | "numeric";
}) {
  const listId = useId();
  const [active, setActive] = useState(0);
  const current = Math.min(active, options.length - 1);
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!options.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((current + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((current - 1 + options.length) % options.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      options[current]?.onPick();
    }
  };
  return (
    <div className="flex flex-col gap-050">
      <TextField
        label={label}
        value={value}
        onChange={(e) => {
          setActive(0);
          onChange(e.target.value);
        }}
        onKeyDown={onKey}
        placeholder={placeholder}
        helper={helper}
        error={error}
        autoFocus={autoFocus}
        autoComplete="off"
        inputMode={inputMode}
        role="combobox"
        aria-expanded={options.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={options.length ? `${listId}-${current}` : undefined}
      />
      {options.length > 0 ? (
        <ul id={listId} role="listbox" aria-label={label} className="scrollbar-thin flex max-h-[16rem] flex-col gap-025 overflow-y-auto rounded-large border bg-surface p-050">
          {options.map((o, i) => (
            <li
              key={o.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === current}
              onMouseDown={(e) => e.preventDefault()}
              onClick={o.onPick}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex cursor-pointer flex-wrap items-baseline gap-x-100 rounded-medium px-100 py-075",
                i === current ? "bg-selected text-selected" : "text-default",
                o.action && i !== current && "text-link",
              )}
            >
              <span className={cn(o.action && "font-medium")}>{o.label}</span>
              {o.hint && <span className={cn("font-body-small", i === current ? "text-selected" : "text-subtlest")}>{o.hint}</span>}
            </li>
          ))}
        </ul>
      ) : (
        empty && <p className="font-body-small text-subtlest">{empty}</p>
      )}
    </div>
  );
}

/** O item escolhido, com "Trocar" para voltar à busca */
function Chosen({ title, hint, onChange }: { title: ReactNode; hint: ReactNode; onChange: () => void }) {
  return (
    <div className="flex min-w-0 items-center gap-100 rounded-large border-thick border-selected bg-selected py-075 pl-150 pr-075 text-selected">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="break-words font-medium">{title}</span>
        <span className="font-body-small">{hint}</span>
      </span>
      <Button appearance="subtle" spacing="compact" onClick={onChange}>
        Trocar
      </Button>
    </div>
  );
}

const selectClass = cn(inputBase, "h-control border-input px-100");

/* ---------- Máquinas afetadas (várias) ---------- */

/** As escolhidas viram etiquetas com ✕; a lista abaixo acrescenta mais uma, agrupada por linha */
function MachinePicker({ id, value, onChange }: { id: string; value: string[]; onChange: (ids: string[]) => void }) {
  const chosen = new Set(value);
  return (
    <div className="flex min-w-0 flex-col gap-050">
      <label htmlFor={id} className="font-body-small font-semibold text-subtle">
        Máquinas afetadas <span className="font-normal text-subtlest">(opcional, pode escolher mais de uma)</span>
      </label>
      {value.length > 0 && (
        <ul aria-label="Máquinas escolhidas" className="flex flex-wrap gap-050">
          {value.map((mid) => (
            <li key={mid} className="flex items-center gap-025 rounded-medium bg-selected py-025 pl-100 pr-025 font-body-small text-selected">
              {machineName(mid)}
              <IconButton icon={X} label={`Tirar ${machineName(mid)}`} spacing="compact" showTooltip={false} onClick={() => onChange(value.filter((x) => x !== mid))} />
            </li>
          ))}
        </ul>
      )}
      <select
        id={id}
        value=""
        onChange={(e) => e.target.value && onChange([...value, e.target.value])}
        className={cn(selectClass, "text-subtle")}
      >
        <option value="">{value.length ? "Adicionar outra máquina…" : "Escolher a máquina…"}</option>
        {MACHINE_GROUPS.map((g) => {
          const free = g.machineIds.map(machineById).filter((m) => !m.inactive && !chosen.has(m.id));
          return free.length ? (
            <optgroup key={g.id} label={g.label}>
              {free.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </optgroup>
          ) : null;
        })}
      </select>
    </div>
  );
}

/* ---------- Materiais faltantes ---------- */

type MaterialForm = { id?: string; picked: Material | null; typing: boolean; query: string; code: string; description: string; machineIds: string[]; note: string };

function MaterialsCard({
  date,
  shift,
  items,
  materialStops,
  notify,
}: {
  date: string;
  shift: Shift;
  items: MaterialShortage[];
  materialStops: string[];
  notify: Notify;
}) {
  const { materials, saveShortage, removeShortage } = useOccurrences();
  const { can } = useAccess();
  // Corrigir ou apagar: quem edita apontamentos, ou quem registrou, até as 24 h (editableUntil)
  const canFix = (s: MaterialShortage) => canFixShortage(s, can("production.edit"));
  const [form, setForm] = useState<MaterialForm | null>(null);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);
  const set = (patch: Partial<MaterialForm>) => setForm((f) => (f ? { ...f, ...patch } : f));

  // Máquina parada por falta de material que ainda não disse qual material
  const missing = materialStops.filter((id) => !items.some((s) => s.machineIds.includes(id)));

  const open = (patch: Partial<MaterialForm> = {}) => {
    setTouched(false);
    setForm({ picked: null, typing: false, query: "", code: "", description: "", machineIds: [], note: "", ...patch });
  };
  const close = () => {
    setForm(null);
    requestAnimationFrame(() => addRef.current?.focus());
  };

  const errors = form?.typing
    ? {
        code: !isMaterialCode(form.code) ? "Digite o código: só números, até 18." : null,
        description: !form.description.trim() ? "Escreva a descrição, como está na OP." : null,
      }
    : { pick: form && !form.picked ? "Escolha o material na lista ou digite um novo." : null };
  const invalid = Object.values(errors).some(Boolean);

  const save = async () => {
    if (!form) return;
    setTouched(true);
    if (invalid) return;
    const material = form.typing ? { code: form.code.trim(), description: form.description.trim().toUpperCase() } : form.picked!;
    setSaving(true);
    try {
      await saveShortage({
        id: form.id,
        date,
        shift,
        materialCode: material.code,
        materialDescription: material.description,
        machineIds: form.machineIds,
        note: form.note.trim() || null,
      });
    } catch (e) {
      setSaving(false);
      notify("Não foi possível salvar", mensagemDeErro(e), "error");
      return;
    }
    setSaving(false);
    notify(form.id ? "Material atualizado" : "Material faltante registrado", `${material.code} · ${material.description}`);
    close();
  };

  // O mesmo material entra uma vez por turno (com todas as máquinas): o já registrado não aparece de novo
  const registered = new Set(items.filter((x) => x.id !== form?.id).map((x) => x.materialCode));
  const results = form && !form.picked && !form.typing ? searchMaterials(materials.filter((m) => !registered.has(m.code)), form.query) : [];
  const q = form?.query.trim() ?? "";
  const options: ComboOption[] = [
    ...results.map((m) => ({
      key: m.code,
      label: <span className="font-code">{m.code}</span>,
      hint: m.description,
      onPick: () => set({ picked: m }),
    })),
    ...(q
      ? [
          {
            key: "novo",
            action: true,
            label: "Não está na lista: digitar código e descrição",
            onPick: () => set(isMaterialCode(q) ? { typing: true, code: q } : { typing: true, description: q.toUpperCase() }),
          },
        ]
      : []),
  ];

  return (
    <Card
      icon={PackageX}
      title="Materiais faltantes"
      count={items.length}
      action={
        !form && (
          <Button ref={addRef} appearance="outline" iconBefore={Plus} onClick={() => open()}>
            Adicionar material
          </Button>
        )
      }
    >
      {missing.map((id) => (
        <div key={id} className="flex flex-wrap items-center gap-100 rounded-large bg-warning px-200 py-150 text-warning">
          <span className="min-w-0 flex-1 basis-[16rem]">
            <span className="font-semibold">{machineById(id).name}</span> não produziu por falta de material. Qual material faltou?
          </span>
          <Button appearance="outline" spacing="compact" onClick={() => open({ machineIds: [id] })}>
            Informar o material
          </Button>
        </div>
      ))}

      {items.length > 0 ? (
        <ul className="flex flex-col">
          {items.map((s) => (
            <ItemRow
              key={s.id}
              label={`o material ${s.materialCode}`}
              title={
                <>
                  <span className="font-code">{s.materialCode}</span> · {s.materialDescription}
                </>
              }
              sub={[s.machineIds.map(machineName).join(", ") || "Sem máquina informada", s.note].filter(Boolean).join(" · ")}
              onEdit={
                canFix(s)
                  ? () =>
                      open({
                        id: s.id,
                        picked: { code: s.materialCode, description: s.materialDescription },
                        machineIds: s.machineIds,
                        note: s.note ?? "",
                      })
                  : undefined
              }
              onRemove={
                canFix(s)
                  ? async () => {
                      try {
                        await removeShortage(s.id);
                        notify("Material retirado", `${s.materialCode} saiu das ocorrências do turno.`);
                      } catch (e) {
                        notify("Não foi possível tirar", mensagemDeErro(e), "error");
                      }
                    }
                  : undefined
              }
            />
          ))}
        </ul>
      ) : (
        !form && !missing.length && <p className="text-subtlest">Nenhum material faltou neste turno.</p>
      )}

      {form && (
        <div className="flex flex-col gap-200 rounded-large border bg-surface-sunken p-200">
          <h4 className="font-heading-xsmall text-default">{form.id ? "Editar material faltante" : "Adicionar material faltante"}</h4>
          {form.picked ? (
            <Chosen
              title={
                <>
                  <span className="font-code">{form.picked.code}</span> · {form.picked.description}
                </>
              }
              hint="Material já conhecido"
              onChange={() => set({ picked: null, query: "" })}
            />
          ) : form.typing ? (
            <div className="grid gap-200 s:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
              <TextField
                label="Código do material"
                isRequired
                inputMode="numeric"
                value={form.code}
                onChange={(e) => set({ code: e.target.value.replace(/\D/g, "").slice(0, 18) })}
                error={touched ? errors.code : null}
                inputClassName="font-code"
                autoFocus={!form.code}
              />
              <TextField
                label="Descrição"
                isRequired
                value={form.description}
                onChange={(e) => set({ description: e.target.value })}
                error={touched ? errors.description : null}
                placeholder="Como está na OP"
                autoFocus={!!form.code}
              />
            </div>
          ) : (
            <SearchCombo
              label="Material"
              value={form.query}
              onChange={(v) => set({ query: v })}
              placeholder="Código ou parte da descrição (ex.: 19189479, filme)"
              helper="Sugere os materiais das OPs e os que já faltaram antes."
              error={touched ? errors.pick : null}
              options={options}
              autoFocus
            />
          )}
          {form.typing && (
            <Button appearance="subtle" spacing="compact" className="self-start" onClick={() => set({ typing: false, query: "" })}>
              Voltar à busca
            </Button>
          )}
          <MachinePicker id={`mat-machines-${date}-${shift}`} value={form.machineIds} onChange={(machineIds) => set({ machineIds })} />
          <TextField label="Observação (opcional)" value={form.note} maxLength={200} onChange={(e) => set({ note: e.target.value })} placeholder="Ex.: chegou só às 10h" />
          <div className="flex flex-wrap justify-end gap-100">
            <Button appearance="subtle" onClick={close}>
              Cancelar
            </Button>
            <Button appearance="primary" isLoading={saving} onClick={save}>
              {form.id ? "Salvar" : "Adicionar"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ---------- Falta de pessoas ---------- */

type PersonForm = { id?: string; collaboratorId: string | null; query: string; allShifts: boolean; kind: AbsenceKind | null; time: string; note: string };

function PeopleCard({ date, shift, items, notify }: { date: string; shift: Shift; items: Absence[]; notify: Notify }) {
  const { collaborators, saveAbsence, removeAbsence, addCollaborator, canSeeNames } = useOccurrences();
  const canRegister = canSeeNames;
  const [form, setForm] = useState<PersonForm | null>(null);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);
  const set = (patch: Partial<PersonForm>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const byId = useMemo(() => new Map(collaborators.map((c) => [c.id, c])), [collaborators]);
  const nameOf = (id: string | null) => (id && byId.get(id)?.name) || "Colaborador";
  /** O nome de uma falta: o banco só manda para o gestor; inativar apaga o nome (D70) */
  const labelOf = (a: Absence) => a.name ?? (canSeeNames ? "Sem nome (colaborador inativado)" : "Nome visível só para o gestor");

  const open = (patch: Partial<PersonForm> = {}) => {
    setTouched(false);
    setForm({ collaboratorId: null, query: "", allShifts: false, kind: null, time: "", note: "", ...patch });
  };
  const close = () => {
    setForm(null);
    requestAnimationFrame(() => addRef.current?.focus());
  };

  const errors = {
    who: form && !form.collaboratorId ? "Escolha a pessoa na lista." : null,
    kind: form && !form.kind ? "Escolha o que aconteceu." : null,
  };

  const save = async () => {
    if (!form) return;
    setTouched(true);
    if (errors.who || errors.kind) return;
    setSaving(true);
    const timed = !!ABSENCE_META[form.kind!].timeLabel;
    try {
      await saveAbsence({
        id: form.id,
        date,
        shift,
        collaboratorId: form.collaboratorId!,
        kind: form.kind!,
        time: timed && form.time ? form.time : null,
        note: form.note.trim() || null,
      });
    } catch (e) {
      setSaving(false);
      notify("Não foi possível salvar", mensagemDeErro(e), "error");
      return;
    }
    setSaving(false);
    notify(form.id ? "Ocorrência atualizada" : "Falta registrada", `${nameOf(form.collaboratorId!)}: ${ABSENCE_META[form.kind!].label.toLowerCase()}.`);
    close();
  };

  // A mesma pessoa não entra duas vezes no turno
  const taken = new Set(items.filter((a) => a.id !== form?.id).flatMap((a) => (a.collaboratorId ? [a.collaboratorId] : [])));
  const results = form && !form.collaboratorId ? searchCollaborators(collaborators, form.query, shift, { allShifts: form.allShifts, exclude: taken }) : [];
  const typed = tidyName(form?.query ?? "");
  const canCreate =
    !!form && canRegister && !form.collaboratorId && typed.split(" ").length >= 2 && !validateCollaborator({ name: typed, badge: "", shift, process: null }, collaborators);
  const options: ComboOption[] = [
    ...results.slice(0, 8).map((c) => ({
      key: c.id,
      label: c.name,
      hint: [c.badge && `Cadastro ${c.badge}`, `Turno ${c.shift}`, c.process && PROCESS_LABEL[c.process]].filter(Boolean).join(" · "),
      onPick: () => set({ collaboratorId: c.id }),
    })),
    ...(canCreate
      ? [
          {
            key: "novo",
            action: true,
            label: `Cadastrar “${typed}” no turno ${shift} e usar`,
            hint: "Entra em Colaboradores; cadastro e linha dá para completar lá",
            onPick: async () => {
              try {
                const c = await addCollaborator({ name: typed, badge: "", shift, process: null });
                set({ collaboratorId: c.id });
                notify("Colaborador cadastrado", `${c.name} agora está em Colaboradores.`);
              } catch (e) {
                notify("Não foi possível cadastrar", mensagemDeErro(e), "error");
              }
            },
          },
        ]
      : []),
  ];
  const picked: Collaborator | undefined = form?.collaboratorId ? byId.get(form.collaboratorId) : undefined;
  const kindMeta = form?.kind ? ABSENCE_META[form.kind] : null;

  return (
    <Card
      icon={UserX}
      title="Falta de pessoas"
      count={items.length}
      action={
        !form && (
          <Button ref={addRef} appearance="outline" iconBefore={Plus} onClick={() => open()}>
            Adicionar pessoa
          </Button>
        )
      }
    >
      {items.length > 0 ? (
        <ul className="flex flex-col">
          {items.map((a, i) => {
            const c = a.collaboratorId ? byId.get(a.collaboratorId) : undefined;
            const meta = ABSENCE_META[a.kind];
            // Corrigir precisa saber quem é: o gestor sempre; quem registrou, em 24 h e enquanto a página lembra o nome
            const canEdit = !!a.id && !!a.collaboratorId && (canSeeNames || a.mine);
            const id = a.id;
            return (
              <ItemRow
                key={a.id ?? `x${i}`}
                label={labelOf(a)}
                title={
                  <span className="flex flex-wrap items-center gap-x-100 gap-y-025">
                    <span className={cn(!a.name && "text-subtle")}>{labelOf(a)}</span>
                    <Lozenge appearance={meta.appearance}>
                      {meta.label}
                      {a.time ? ` · ${a.time}` : ""}
                    </Lozenge>
                  </span>
                }
                sub={
                  a.name
                    ? [c?.badge && `Cadastro ${c.badge}`, c?.process && PROCESS_LABEL[c.process], a.note].filter(Boolean).join(" · ") || "Sem observação"
                    : a.mine && id
                      ? "Registrada por você: dá para desfazer em até 24 horas"
                      : "Registrada no turno"
                }
                onEdit={canEdit ? () => open({ id: id!, collaboratorId: a.collaboratorId, kind: a.kind, time: a.time ?? "", note: a.note ?? "" }) : undefined}
                onRemove={
                  id
                    ? async () => {
                        try {
                          await removeAbsence(id);
                          notify("Retirado da lista", `${labelOf(a)} saiu da falta de pessoas do turno.`);
                        } catch (e) {
                          notify("Não foi possível tirar", mensagemDeErro(e), "error");
                        }
                      }
                    : undefined
                }
              />
            );
          })}
        </ul>
      ) : (
        !form && <p className="text-subtlest">Ninguém faltou neste turno.</p>
      )}

      {form && (
        <div className="flex flex-col gap-200 rounded-large border bg-surface-sunken p-200">
          <h4 className="font-heading-xsmall text-default">{form.id ? "Editar ocorrência" : "Adicionar pessoa"}</h4>
          {picked ? (
            <Chosen
              title={picked.name}
              hint={[picked.badge && `Cadastro ${picked.badge}`, `Turno ${picked.shift}`, picked.process && PROCESS_LABEL[picked.process]].filter(Boolean).join(" · ")}
              onChange={() => set({ collaboratorId: null, query: "" })}
            />
          ) : (
            <div className="flex flex-col gap-100">
              <SearchCombo
                label="Colaborador"
                value={form.query}
                onChange={(v) => set({ query: v })}
                placeholder="Digite o nome ou o cadastro"
                error={touched ? errors.who : null}
                options={options}
                empty={
                  form.query.trim()
                    ? canRegister
                      ? "Ninguém com esse nome. Digite nome e sobrenome para cadastrar."
                      : "Ninguém com esse nome. Peça ao gestor para cadastrar a pessoa em Colaboradores."
                    : form.allShifts
                      ? "Todos já estão na lista deste turno."
                      : `Ninguém do turno ${shift} sobrando. Marque “Mostrar os outros turnos” ou busque pelo nome.`
                }
                autoFocus
              />
              <label className="flex h-control w-fit items-center gap-075 text-default">
                <Checkbox label="Mostrar os outros turnos" checked={form.allShifts} onChange={(e) => set({ allShifts: e.target.checked })} />
                <span aria-hidden>Mostrar os outros turnos</span>
              </label>
            </div>
          )}
          <OptionCards
            label="O que aconteceu"
            value={form.kind}
            onChange={(k) => set({ kind: k })}
            options={ABSENCE_KINDS.map((k) => ({ value: k, label: ABSENCE_META[k].label }))}
            error={touched ? errors.kind : null}
          />
          <div className="grid gap-200 s:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
            {kindMeta?.timeLabel && (
              <TextField label={`${kindMeta.timeLabel} (opcional)`} type="time" value={form.time} onChange={(e) => set({ time: e.target.value })} inputClassName="font-code" />
            )}
            <TextField
              label="Observação (opcional)"
              value={form.note}
              maxLength={200}
              onChange={(e) => set({ note: e.target.value })}
              placeholder="Ex.: atestado, consulta médica"
              className={cn(!kindMeta?.timeLabel && "s:col-span-2")}
            />
          </div>
          <div className="flex flex-wrap justify-end gap-100">
            <Button appearance="subtle" onClick={close}>
              Cancelar
            </Button>
            <Button appearance="primary" isLoading={saving} onClick={save}>
              {form.id ? "Salvar" : "Adicionar"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
