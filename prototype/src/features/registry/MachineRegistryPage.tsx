import { Factory, Pencil, Plus, Power, PowerOff, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Machine as ApiMachine } from "../../../../src/lib/api";
import { mensagemDeErro } from "../../../../src/lib/erros";
import { DATA_ORIGIN, MACHINES, metaPerShift } from "@/data/machines";
import { lineOf, reloadBackendData } from "@/data/fromBackend";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorMessage, Skeleton } from "@/components/ui/Feedback";
import { Lozenge } from "@/components/ui/Lozenge";
import { Modal } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextField } from "@/components/ui/TextField";
import { useAccess } from "@/features/access/AccessContext";
import { BASE_OPTIONS, baseLabel, crewOf, initialBaseOf } from "@/features/metas/metaBase";
import type { MachineChanges, MachineProcess, NewMachineInput } from "../../../../src/lib/repositories/types";
import type { BaseDaMeta } from "../../../../src/lib/metas";
import { cn, formatNumber, type Notify } from "@/lib/utils";
import {
  PROCESS_LABEL,
  changesOf,
  draftOf,
  fromApi,
  newDraft,
  processOfLine,
  sortMachines,
  toNewInput,
  validateDraft,
  type MachineDraft,
  type RegistryMachine,
} from "./registry";

/*
 * Cadastro de máquinas (machines.manage): ver todas, cadastrar (createMachine,
 * com linha, meta, base e lotação), editar nome, linha e lotação
 * (updateMachine) e desativar ou reativar (D63). Meta e base de uma máquina que
 * já existe têm vigência: mudam na tela de Metas.
 */

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; machines: RegistryMachine[] };
type Filter = "active" | "inactive" | "all";

/** Demonstração: os centros gerados em machines.ts, todos ativos; gravar fica só nesta aba */
const demoMachines = (): RegistryMachine[] =>
  sortMachines(
    MACHINES.map((m) => ({
      id: m.id,
      name: m.name,
      line: m.line,
      process: processOfLine(m.line),
      hasMeta: m.hasTarget,
      metaPerShift: m.hasTarget ? metaPerShift(m) : 0,
      basis: initialBaseOf(m.id),
      crew: crewOf(m.id),
      active: true,
    })),
  );

export function MachineRegistryPage({ notify }: { notify: Notify }) {
  const { can, session, client } = useAccess();
  const live = DATA_ORIGIN === "backend";
  // No modo Apps Script, só leitura (como Metas, Histórico e Calendário)
  const writable = !live || (!!client.reads && client.kind !== "gas");
  const canManage = can("machines.manage") && writable;

  const [load, setLoad] = useState<Load>(() => (live ? { status: "loading" } : { status: "ready", machines: demoMachines() }));
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<Filter>("active");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<RegistryMachine | null>(null);
  const [toggling, setToggling] = useState<RegistryMachine | null>(null);

  const fetchMachines = useCallback(async () => {
    if (!client.reads) return [];
    const [m, t] = await Promise.all([client.reads.machines.getMachines(session), client.reads.targets.getMetas(session)]);
    return fromApi((m.allMachines ?? m.machines ?? []) as ApiMachine[], t.metasInfo ?? {});
    // A sessão muda de objeto a cada renovação de token; a leitura é a mesma
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  useEffect(() => {
    if (!live) return;
    let alive = true;
    setLoad({ status: "loading" });
    fetchMachines()
      .then((machines) => alive && setLoad({ status: "ready", machines }))
      .catch((e) => alive && setLoad({ status: "error", message: mensagemDeErro(e, "Não foi possível carregar as máquinas.") }));
    return () => {
      alive = false;
    };
  }, [live, fetchMachines, attempt]);

  /** Depois de gravar: a lista desta tela e as máquinas das outras telas */
  const refresh = async () => {
    if (!client.reads) return;
    try {
      const [machines] = await Promise.all([fetchMachines(), reloadBackendData(client.reads, session)]);
      setLoad({ status: "ready", machines });
    } catch {
      notify("Salvo, mas a tela não atualizou", "Recarregue a página para ver as máquinas novas.", "error");
    }
  };

  const all = load.status === "ready" ? load.machines : [];
  const active = all.filter((m) => m.active);
  const inactive = all.filter((m) => !m.active);
  const shown = filter === "active" ? active : filter === "inactive" ? inactive : all;

  return (
    <>
      <PageHeader
        title="Cadastro de máquinas"
        breadcrumbs={["Administração"]}
        description="Os centros de trabalho que aparecem no Apontamento e no Dashboard. Máquina desativada some das telas, mas o histórico dela continua."
        actions={
          canManage ? (
            <Button appearance="primary" iconBefore={Plus} onClick={() => setAdding(true)} isDisabled={load.status !== "ready"}>
              Cadastrar máquina
            </Button>
          ) : (
            <Lozenge>Somente leitura</Lozenge>
          )
        }
      />
      <PageBody>
        {load.status === "ready" && all.length > 0 && (
          <SegmentedControl
            label="Mostrar"
            iconOnly={false}
            value={filter}
            onChange={(v) => setFilter(v as Filter)}
            options={[
              { value: "active", label: `Ativas (${active.length})` },
              { value: "inactive", label: `Inativas (${inactive.length})` },
              { value: "all", label: `Todas (${all.length})` },
            ]}
          />
        )}

        {load.status === "loading" && (
          <div className="flex flex-col gap-100" aria-busy="true" aria-label="Carregando as máquinas">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-500 w-full" />
            ))}
          </div>
        )}

        {load.status === "error" && (
          <ErrorMessage
            title="Não foi possível carregar as máquinas"
            actions={
              <Button iconBefore={RefreshCw} onClick={() => setAttempt((n) => n + 1)}>
                Tentar de novo
              </Button>
            }
          >
            {load.message}
          </ErrorMessage>
        )}

        {load.status === "ready" && shown.length === 0 && (
          <EmptyState
            icon={Factory}
            title={filter === "inactive" ? "Nenhuma máquina inativa" : "Nenhuma máquina cadastrada"}
            hint={
              filter === "inactive"
                ? "Quando uma máquina for desativada, ela aparece aqui e pode ser reativada."
                : "Cadastre os centros de trabalho da fábrica."
            }
            action={
              canManage && filter !== "inactive" ? { label: "Cadastrar máquina", icon: Plus, onClick: () => setAdding(true) } : undefined
            }
          />
        )}

        {load.status === "ready" && shown.length > 0 && (
          <div className="scrollbar-thin overflow-x-auto rounded-large border">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead className="bg-surface-sunken font-body-small text-subtle">
                <tr>
                  <th scope="col" className="px-150 py-100 font-semibold">
                    Máquina
                  </th>
                  <th scope="col" className="px-150 py-100 font-semibold">
                    Linha
                  </th>
                  <th scope="col" className="px-150 py-100 text-right font-semibold">
                    Meta por turno
                  </th>
                  <th scope="col" className="px-150 py-100 font-semibold">
                    Base da meta
                  </th>
                  <th scope="col" className="px-150 py-100 text-right font-semibold">
                    Lotação
                  </th>
                  <th scope="col" className="px-150 py-100 font-semibold">
                    Situação
                  </th>
                  {canManage && (
                    <th scope="col" className="px-150 py-100">
                      <span className="sr-only">Ações</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {shown.map((m) => (
                  <tr key={m.id} className={cn(!m.active && "text-subtlest")}>
                    <th scope="row" className={cn("px-150 py-100 font-medium", m.active ? "text-default" : "text-subtle")}>
                      {m.name}
                    </th>
                    <td className="px-150 py-100">{m.line}</td>
                    <td className="px-150 py-100 text-right tabular-nums">
                      {m.hasMeta && m.metaPerShift > 0 ? formatNumber(m.metaPerShift) : <span className="text-subtlest">Sem meta</span>}
                    </td>
                    <td className="px-150 py-100">{m.hasMeta && m.metaPerShift > 0 ? baseLabel(m.basis) : "–"}</td>
                    <td className="px-150 py-100 text-right tabular-nums">{m.crew ?? "–"}</td>
                    <td className="px-150 py-100">
                      <Lozenge appearance={m.active ? "success" : "neutral"}>{m.active ? "Ativa" : "Inativa"}</Lozenge>
                    </td>
                    {canManage && (
                      <td className="flex justify-end gap-050 px-150 py-100">
                        <Button appearance="subtle" spacing="compact" iconBefore={Pencil} onClick={() => setEditing(m)}>
                          Editar
                          <span className="sr-only"> {m.name}</span>
                        </Button>
                        <Button
                          appearance="subtle"
                          spacing="compact"
                          iconBefore={m.active ? PowerOff : Power}
                          onClick={() => setToggling(m)}
                        >
                          {m.active ? "Desativar" : "Reativar"}
                          <span className="sr-only"> {m.name}</span>
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {load.status === "ready" && all.length > 0 && (
          <p className="font-body-small text-subtlest">
            Meta e base têm vigência: mudam na tela de Metas. Nome, linha e lotação mudam aqui, em Editar.
          </p>
        )}
      </PageBody>

      {adding && (
        <MachineDialog
          existing={all}
          onClose={() => setAdding(false)}
          onSave={async (input: NewMachineInput) => {
            if (!live || !client.reads) {
              const m: RegistryMachine = {
                id: `n${Date.now()}`,
                name: input.name,
                line: lineOf(input.name, input.process),
                process: input.process,
                hasMeta: input.defaultMeta > 0,
                metaPerShift: input.defaultMeta,
                basis: input.basis ?? "per_shift",
                crew: input.standardOperatorCount ?? null,
                active: true,
              };
              setLoad({ status: "ready", machines: sortMachines([...all, m]) });
            } else {
              await client.reads.machines.createMachine(input, session);
              await refresh();
            }
            setAdding(false);
            setFilter("active");
            notify(
              "Máquina cadastrada",
              input.defaultMeta > 0
                ? `${input.name}: meta de ${formatNumber(input.defaultMeta)} por turno a partir de hoje.`
                : `${input.name}, por demanda (sem meta).`,
            );
          }}
        />
      )}

      {editing && (
        <MachineDialog
          existing={all}
          machine={editing}
          onClose={() => setEditing(null)}
          onSave={async (changes: MachineChanges) => {
            const m = editing;
            if (!live || !client.reads) {
              setLoad({
                status: "ready",
                machines: sortMachines(
                  all.map((x) =>
                    x.id === m.id
                      ? {
                          ...x,
                          name: changes.name ?? x.name,
                          process: changes.process ?? x.process,
                          line: lineOf(changes.name ?? x.name, changes.process ?? x.process ?? undefined),
                          crew: changes.standardOperatorCount ?? x.crew,
                        }
                      : x,
                  ),
                ),
              });
            } else {
              await client.reads.machines.updateMachine(Number(m.id), changes, session);
              await refresh();
            }
            setEditing(null);
            notify("Máquina atualizada", changes.name ?? m.name);
          }}
        />
      )}

      {toggling && (
        <ToggleDialog
          machine={toggling}
          onClose={() => setToggling(null)}
          onConfirm={async () => {
            const m = toggling;
            if (!live || !client.reads) {
              setLoad({ status: "ready", machines: sortMachines(all.map((x) => (x.id === m.id ? { ...x, active: !x.active } : x))) });
            } else {
              try {
                await client.reads.machines.toggleMachine(Number(m.id), session);
              } catch (e) {
                notify(m.active ? "Não foi possível desativar" : "Não foi possível reativar", mensagemDeErro(e), "error");
                setToggling(null);
                return;
              }
              await refresh();
            }
            setToggling(null);
            notify(m.active ? "Máquina desativada" : "Máquina reativada", m.name);
          }}
        />
      )}
    </>
  );
}

/* ---------- Cadastrar e editar ---------- */

type DialogProps = { existing: RegistryMachine[]; onClose: () => void } & (
  | { machine?: undefined; onSave: (input: NewMachineInput) => Promise<void> }
  | { machine: RegistryMachine; onSave: (changes: MachineChanges) => Promise<void> }
);

/** Lança o erro do banco: a mensagem aparece no diálogo, como veio */
function MachineDialog(props: DialogProps) {
  const { existing, machine, onClose } = props;
  const editing = !!machine;
  const [draft, setDraft] = useState<MachineDraft>(() => (machine ? draftOf(machine) : newDraft()));
  const [pickedLine, setPickedLine] = useState(editing);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errors = validateDraft(draft, existing, machine);
  const changes = machine ? changesOf(draft, machine) : null;
  const withMeta = /^\d+$/.test(draft.meta.trim()) && Number(draft.meta) > 0;
  const set = (patch: Partial<MachineDraft>) => setDraft((d) => ({ ...d, ...patch }));

  // Cadastro: a linha começa pela dedução do nome, até a pessoa escolher
  const onName = (name: string) => set(pickedLine || !name.trim() ? { name } : { name, process: processOfLine(lineOf(name)) });

  const save = async () => {
    setTouched(true);
    if (errors.any || (editing && !changes)) return;
    setSaving(true);
    setError(null);
    try {
      if (props.machine) await props.onSave(changes!);
      else await props.onSave(toNewInput(draft));
    } catch (e) {
      setSaving(false);
      setError(mensagemDeErro(e));
    }
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && !saving && onClose()}
      title={machine ? `Editar ${machine.name}` : "Cadastrar máquina"}
      primary={{
        label: editing ? "Salvar" : "Cadastrar",
        onClick: save,
        isLoading: saving,
        isDisabled: (editing && !changes) || (touched && errors.any),
      }}
    >
      <div className="flex flex-col gap-200">
        <TextField
          label="Nome"
          isRequired
          value={draft.name}
          maxLength={80}
          onChange={(e) => onName(e.target.value)}
          placeholder="Ex.: Embaladora horizontal nº 3"
          // Nome repetido avisa enquanto digita; o resto, só ao tentar salvar
          error={touched || errors.name?.startsWith("Já existe") ? errors.name : null}
          autoFocus
        />
        <div className="flex flex-col gap-050">
          <span className="font-body-small font-semibold text-subtle">
            Linha{" "}
            <span aria-hidden className="text-danger">
              *
            </span>
          </span>
          <SegmentedControl
            label="Linha"
            iconOnly={false}
            size="control"
            value={draft.process}
            onChange={(v) => {
              setPickedLine(true);
              set({ process: v as MachineProcess });
            }}
            options={(["assembly", "packaging"] as MachineProcess[]).map((p) => ({ value: p, label: PROCESS_LABEL[p] }))}
          />
          {touched && errors.process ? (
            <p className="font-body-small text-danger">{errors.process}</p>
          ) : (
            <p className="font-body-small text-subtlest">
              {!editing && draft.process && !pickedLine ? "Sugerida pelo nome. " : ""}As bancadas a granel ficam na Embalagem.
            </p>
          )}
        </div>
        {!editing && (
          <>
            <TextField
              label="Meta por turno"
              isRequired
              inputMode="numeric"
              value={draft.meta}
              onChange={(e) => set({ meta: e.target.value.replace(/\D/g, "") })}
              error={touched ? errors.meta : null}
              helper="Peças boas por turno, valendo a partir de hoje. Use 0 para máquina por demanda (sem meta)."
              elemAfter="peças"
            />
            {withMeta && (
              <div className="flex flex-col gap-050">
                <span className="font-body-small font-semibold text-subtle">Base da meta</span>
                <SegmentedControl
                  label="Base da meta"
                  iconOnly={false}
                  size="control"
                  value={draft.basis}
                  onChange={(v) => set({ basis: v as BaseDaMeta })}
                  options={BASE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                />
                <p className="font-body-small text-subtlest">{BASE_OPTIONS.find((o) => o.value === draft.basis)?.hint}</p>
              </div>
            )}
          </>
        )}
        <TextField
          label="Lotação padrão"
          inputMode="numeric"
          value={draft.crew}
          onChange={(e) => set({ crew: e.target.value.replace(/\D/g, "") })}
          error={touched || errors.crew?.includes("não se apaga") ? errors.crew : null}
          helper={
            !editing && withMeta && draft.basis === "per_shift_prorated"
              ? "Obrigatória: a meta é rateada por ela."
              : "Pessoas num turno normal. Opcional, mas depois de informada não se apaga."
          }
          isRequired={!editing && withMeta && draft.basis === "per_shift_prorated"}
          elemAfter="pessoas"
          className="w-column-name"
        />
        {editing && <p className="font-body-small text-subtle">Meta e base têm vigência: para mudar, use a tela de Metas.</p>}
        {error && <ErrorMessage title={editing ? "Não foi possível salvar" : "Não foi possível cadastrar"}>{error}</ErrorMessage>}
      </div>
    </Modal>
  );
}

/* ---------- Desativar / reativar ---------- */

function ToggleDialog({ machine, onClose, onConfirm }: { machine: RegistryMachine; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      title={machine.active ? "Desativar a máquina?" : "Reativar a máquina?"}
      primary={{
        label: machine.active ? "Desativar" : "Reativar",
        appearance: machine.active ? "danger" : "primary",
        isLoading: busy,
        onClick: async () => {
          setBusy(true);
          await onConfirm();
        },
      }}
    >
      <p>
        <strong>{machine.name}</strong>
      </p>
      <p className="mt-100 text-subtle">
        {machine.active
          ? "Ela sai do Apontamento e deixa de aparecer no Dashboard nos períodos em que não produziu. Os apontamentos já feitos continuam no Histórico e nos Relatórios, e dá para reativar depois."
          : `Ela volta ao Apontamento e ao Dashboard${machine.hasMeta && machine.metaPerShift > 0 ? `, com a meta de ${formatNumber(machine.metaPerShift)} por turno` : ""}.`}
      </p>
    </Modal>
  );
}
