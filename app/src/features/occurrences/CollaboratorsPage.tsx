import { Pencil, Plus, Power, PowerOff, Search, UserRound, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { DATA_END, SHIFTS, SHIFT_META, toIsoDate, type Line, type Shift } from "@/data/machines";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { Lozenge } from "@/components/ui/Lozenge";
import { Modal } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextField } from "@/components/ui/TextField";
import { cn, type Notify } from "@/lib/utils";
import { ABSENCE_META, monthCounts, normalize, validateCollaborator, type Collaborator, type CollaboratorDraft } from "./occurrences";
import { useOccurrences } from "./OccurrencesStore";

/*
 * Cadastro de colaboradores (collaborators.manage): as pessoas que aparecem na
 * Falta de pessoas do apontamento. Não são contas do Dash. Quem sai da empresa
 * é inativado, nunca apagado, para as ocorrências antigas manterem o nome.
 */

type Filter = "active" | "inactive" | "all";
const LINES: Line[] = ["Montagem", "Embalagem", "Granel"];
const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long" });

export function CollaboratorsPage({ notify }: { notify: Notify }) {
  const { available, collaborators, absences, addCollaborator, updateCollaborator, setCollaboratorActive } = useOccurrences();
  const [filter, setFilter] = useState<Filter>("active");
  const [shift, setShift] = useState<Shift | "all">("all");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Collaborator | null>(null);
  const [toggling, setToggling] = useState<Collaborator | null>(null);
  const [history, setHistory] = useState<Collaborator | null>(null);

  const month = toIsoDate(DATA_END).slice(0, 7);
  const monthLabel = monthName.format(DATA_END);
  const counts = useMemo(() => monthCounts(absences, month), [absences, month]);

  const active = collaborators.filter((c) => c.active);
  const inactive = collaborators.filter((c) => !c.active);
  const q = normalize(query);
  const shown = (filter === "active" ? active : filter === "inactive" ? inactive : collaborators)
    .filter((c) => shift === "all" || c.shift === shift)
    .filter((c) => !q || normalize(c.name).includes(q) || (c.badge ?? "").includes(q))
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "pt-BR"));

  if (!available)
    return (
      <>
        <PageHeader title="Colaboradores" breadcrumbs={["Administração"]} />
        <PageBody>
          <EmptyState icon={Users} title="Ainda não disponível" hint="O cadastro de colaboradores chega junto com as ocorrências do turno, quando o banco estiver pronto." />
        </PageBody>
      </>
    );

  return (
    <>
      <PageHeader
        title="Colaboradores"
        breadcrumbs={["Administração"]}
        description="As pessoas que aparecem na Falta de pessoas do apontamento. Não precisam ter conta no Dash."
        actions={
          <Button appearance="primary" iconBefore={Plus} onClick={() => setAdding(true)}>
            Cadastrar colaborador
          </Button>
        }
      />
      <PageBody>
        <div className="flex flex-wrap items-end gap-200">
          <SegmentedControl
            label="Mostrar"
            iconOnly={false}
            value={filter}
            onChange={(v) => setFilter(v as Filter)}
            options={[
              { value: "active", label: `Ativos (${active.length})` },
              { value: "inactive", label: `Inativos (${inactive.length})` },
              { value: "all", label: `Todos (${collaborators.length})` },
            ]}
          />
          <SegmentedControl
            label="Turno"
            iconOnly={false}
            value={String(shift)}
            onChange={(v) => setShift(v === "all" ? "all" : (Number(v) as Shift))}
            options={[{ value: "all", label: "Todos os turnos" }, ...SHIFTS.map((s) => ({ value: String(s), label: SHIFT_META[s].label }))]}
          />
          <TextField
            label="Buscar colaborador"
            hideLabel
            placeholder="Buscar por nome ou matrícula"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            elemAfter={<Search aria-hidden className="size-icon-small" />}
            className="min-w-0 flex-1 basis-[16rem] s:max-w-search-width"
          />
        </div>

        {shown.length === 0 ? (
          <EmptyState
            icon={UserRound}
            title={q ? "Ninguém encontrado" : filter === "inactive" ? "Nenhum colaborador inativo" : "Nenhum colaborador cadastrado"}
            hint={
              q
                ? `Nenhum nome ou matrícula tem "${query.trim()}". Confira a busca ou cadastre a pessoa.`
                : filter === "inactive"
                  ? "Quem for inativado aparece aqui e pode ser reativado."
                  : "Cadastre as pessoas de cada turno para registrar as faltas no apontamento."
            }
            action={q ? { label: "Limpar busca", onClick: () => setQuery("") } : { label: "Cadastrar colaborador", icon: Plus, onClick: () => setAdding(true) }}
          />
        ) : (
          <div className="scrollbar-thin relative overflow-x-auto rounded-large border">
            <table className="w-full min-w-table-min border-collapse text-left">
              <caption className="sr-only">Colaboradores</caption>
              <thead className="bg-surface-sunken font-body-small text-subtle">
                <tr>
                  <th scope="col" className="px-150 py-100 font-semibold">
                    Nome
                  </th>
                  <th scope="col" className="px-150 py-100 font-semibold">
                    Matrícula
                  </th>
                  <th scope="col" className="px-150 py-100 font-semibold">
                    Turno
                  </th>
                  <th scope="col" className="px-150 py-100 font-semibold">
                    Linha
                  </th>
                  <th scope="col" className="px-150 py-100 font-semibold">
                    Ocorrências em {monthLabel}
                  </th>
                  <th scope="col" className="px-150 py-100 font-semibold">
                    Situação
                  </th>
                  <th scope="col" className="px-150 py-100">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {shown.map((c) => {
                  const n = counts.get(c.id);
                  return (
                    <tr key={c.id} className={cn(!c.active && "text-subtlest")}>
                      <th scope="row" className={cn("px-150 py-100 font-medium", c.active ? "text-default" : "text-subtle")}>
                        {c.name}
                      </th>
                      <td className="px-150 py-100 font-code tabular-nums">{c.badge ?? "–"}</td>
                      <td className="whitespace-nowrap px-150 py-100">{SHIFT_META[c.shift].label}</td>
                      <td className="px-150 py-100">{c.line ?? <span className="text-subtlest">Sem linha fixa</span>}</td>
                      <td className="px-150 py-100">
                        {n ? (
                          <Button appearance="subtle" spacing="compact" onClick={() => setHistory(c)}>
                            <span className="flex flex-wrap gap-050">
                              {n.absent > 0 && <Lozenge appearance="danger">{n.absent === 1 ? "1 falta" : `${n.absent} faltas`}</Lozenge>}
                              {n.other > 0 && <Lozenge appearance="warning">{n.other === 1 ? "1 saída ou atraso" : `${n.other} saídas ou atrasos`}</Lozenge>}
                            </span>
                            <span className="sr-only"> de {c.name}: ver os dias</span>
                          </Button>
                        ) : (
                          <span className="text-subtlest">Nenhuma</span>
                        )}
                      </td>
                      <td className="px-150 py-100">
                        <Lozenge appearance={c.active ? "success" : "neutral"}>{c.active ? "Ativo" : "Inativo"}</Lozenge>
                      </td>
                      <td className="px-150 py-100">
                        <span className="flex justify-end gap-050">
                          <Button appearance="subtle" spacing="compact" iconBefore={Pencil} onClick={() => setEditing(c)}>
                            Editar
                            <span className="sr-only"> {c.name}</span>
                          </Button>
                          <Button appearance="subtle" spacing="compact" iconBefore={c.active ? PowerOff : Power} onClick={() => setToggling(c)}>
                            {c.active ? "Inativar" : "Reativar"}
                            <span className="sr-only"> {c.name}</span>
                          </Button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="font-body-small text-subtlest">
          O turno do cadastro só ordena a lista do apontamento: dá para registrar a falta de alguém em outro turno. Só líderes e gestor veem esta tela.
        </p>
      </PageBody>

      {(adding || editing) && (
        <CollaboratorDialog
          collaborator={editing}
          all={collaborators}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSave={async (d) => {
            if (editing) {
              await updateCollaborator(editing.id, d);
              notify("Cadastro atualizado", d.name);
            } else {
              const c = await addCollaborator(d);
              setFilter("active");
              notify("Colaborador cadastrado", `${c.name} já aparece no apontamento do ${SHIFT_META[c.shift].label.toLowerCase()}.`);
            }
            setAdding(false);
            setEditing(null);
          }}
        />
      )}

      {toggling && (
        <Modal
          open
          onOpenChange={(o) => !o && setToggling(null)}
          title={toggling.active ? "Inativar o colaborador?" : "Reativar o colaborador?"}
          primary={{
            label: toggling.active ? "Inativar" : "Reativar",
            appearance: toggling.active ? "danger" : "primary",
            onClick: async () => {
              await setCollaboratorActive(toggling.id, !toggling.active);
              notify(toggling.active ? "Colaborador inativado" : "Colaborador reativado", toggling.name);
              setToggling(null);
            },
          }}
        >
          <p>
            <strong>{toggling.name}</strong>
          </p>
          <p className="mt-100 text-subtle">
            {toggling.active
              ? "A pessoa sai da lista do apontamento. As faltas já registradas continuam com o nome, e dá para reativar depois."
              : "A pessoa volta para a lista do apontamento."}
          </p>
        </Modal>
      )}

      {history && (
        <HistoryDialog collaborator={history} month={month} monthLabel={monthLabel} onClose={() => setHistory(null)} />
      )}
    </>
  );
}

/* ---------- Cadastrar e editar ---------- */

function CollaboratorDialog({
  collaborator,
  all,
  onClose,
  onSave,
}: {
  collaborator: Collaborator | null;
  all: Collaborator[];
  onClose: () => void;
  onSave: (d: CollaboratorDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<CollaboratorDraft>(() =>
    collaborator
      ? { name: collaborator.name, badge: collaborator.badge ?? "", shift: collaborator.shift, line: collaborator.line }
      : { name: "", badge: "", shift: 1, line: null },
  );
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const errors = validateCollaborator(draft, all, collaborator?.id);
  const set = (patch: Partial<CollaboratorDraft>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <Modal
      open
      onOpenChange={(o) => !o && !saving && onClose()}
      title={collaborator ? `Editar ${collaborator.name}` : "Cadastrar colaborador"}
      primary={{
        label: collaborator ? "Salvar" : "Cadastrar",
        isLoading: saving,
        isDisabled: touched && !!errors,
        onClick: async () => {
          setTouched(true);
          if (errors) return;
          setSaving(true);
          await onSave(draft);
        },
      }}
    >
      <div className="flex flex-col gap-200">
        <TextField
          label="Nome"
          isRequired
          value={draft.name}
          maxLength={80}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Nome e sobrenome"
          // Nome repetido avisa enquanto digita; o resto, só ao tentar salvar
          error={touched || errors?.name?.startsWith("Já existe") ? errors?.name : null}
          autoFocus
        />
        <TextField
          label="Matrícula"
          inputMode="numeric"
          value={draft.badge}
          onChange={(e) => set({ badge: e.target.value.replace(/\D/g, "").slice(0, 12) })}
          error={touched || errors?.badge?.includes("outra pessoa") ? errors?.badge : null}
          helper="Opcional. Ajuda a separar pessoas com nomes parecidos."
          inputClassName="font-code"
          className="w-column-name"
        />
        <div className="flex flex-col gap-050">
          <span className="font-body-small font-semibold text-subtle">Turno de costume</span>
          <SegmentedControl
            label="Turno de costume"
            iconOnly={false}
            size="control"
            value={String(draft.shift)}
            onChange={(v) => set({ shift: Number(v) as Shift })}
            options={SHIFTS.map((s) => ({ value: String(s), label: SHIFT_META[s].label }))}
          />
        </div>
        <div className="flex flex-col gap-050">
          <span className="font-body-small font-semibold text-subtle">Linha</span>
          <SegmentedControl
            label="Linha"
            iconOnly={false}
            size="control"
            value={draft.line ?? "none"}
            onChange={(v) => set({ line: v === "none" ? null : (v as Line) })}
            options={[{ value: "none", label: "Sem linha fixa" }, ...LINES.map((l) => ({ value: l, label: l }))]}
          />
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Dias com ocorrência no mês ---------- */

const dayFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });

function HistoryDialog({ collaborator, month, monthLabel, onClose }: { collaborator: Collaborator; month: string; monthLabel: string; onClose: () => void }) {
  const { absences } = useOccurrences();
  const list = absences
    .filter((a) => a.collaboratorId === collaborator.id && a.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date) || b.shift - a.shift);
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`${collaborator.name} em ${monthLabel}`} primary={{ label: "Fechar", onClick: onClose }} cancelLabel="Voltar">
      <ul className="flex flex-col">
        {list.map((a) => {
          const meta = ABSENCE_META[a.kind];
          return (
            <li key={a.id} className="flex flex-wrap items-center gap-100 border-t py-100 first:border-t-0">
              <span className="w-1000 shrink-0 tabular-nums text-default first-letter:uppercase">{dayFmt.format(new Date(`${a.date}T12:00:00`))}</span>
              <span className="text-subtle">{SHIFT_META[a.shift].label}</span>
              <Lozenge appearance={meta.appearance}>
                {meta.label}
                {a.time ? ` · ${a.time}` : ""}
              </Lozenge>
              {a.note && <span className="font-body-small text-subtle">{a.note}</span>}
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
