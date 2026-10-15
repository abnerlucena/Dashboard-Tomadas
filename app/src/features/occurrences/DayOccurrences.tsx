import * as Dialog from "@radix-ui/react-dialog";
import { ClipboardCopy, PackageX, Pencil, UserX, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { SHIFTS, SHIFT_META, type Shift } from "@/data/machines";
import { Button, IconButton } from "@/components/ui/Button";
import { Lozenge } from "@/components/ui/Lozenge";
import { useAccess } from "@/features/access/AccessContext";
import { SHIFT_FILL } from "@/components/data/shiftColors";
import { cn, type Notify } from "@/lib/utils";
import { ABSENCE_KINDS, ABSENCE_META, machineName, sheetLines, type Absence } from "./occurrences";
import { occurrencesOf, useOccurrences } from "./OccurrencesStore";
import { ShiftOccurrences } from "./ShiftOccurrences";

const dayFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

/**
 * Histórico: as ocorrências de cada turno do dia (materiais e pessoas). Os nomes
 * só aparecem para quem tem collaborators.manage; os outros veem a contagem.
 * Quem corrige apontamentos também corrige as ocorrências.
 */
export function DayOccurrences({ date, shift, notify }: { date: string; shift: Shift | "all"; notify: Notify }) {
  const store = useOccurrences();
  const { can } = useAccess();
  const [editing, setEditing] = useState<Shift | null>(null);
  if (!store.available) return null;
  const showNames = store.canSeeNames;
  const canEdit = can("production.edit") || can("production.create");
  const shifts = (shift === "all" ? SHIFTS : [shift]).map((s) => ({ s, ...occurrencesOf(store, date, s) }));
  const any = shifts.some((x) => x.absences.length || x.shortages.length);

  /** Até a virada, a planilha continua sendo a fonte: o bloco sai pronto para colar (coluna B de "Informações adicionais") */
  const copy = async (s: Shift, lines: { materials: string[]; people: string[] }) => {
    // Várias linhas na mesma célula: entre aspas, como o Excel entende ao colar
    const cell = (l: string[]) => (l.length > 1 ? `"${l.join("\n").replace(/"/g, '""')}"` : (l[0] ?? ""));
    const text = ["QUALIDADE\t", `MATERIAIS FALTANTES\t${cell(lines.materials)}`, `FALTA DE PESSOAS\t${cell(lines.people)}`].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      notify("Copiado", `Ocorrências do ${SHIFT_META[s].label.toLowerCase()} prontas para colar na planilha.`);
    } catch {
      notify("Não foi possível copiar", "O navegador bloqueou a área de transferência. Selecione e copie o texto à mão.", "error");
    }
  };

  return (
    <section aria-labelledby="day-occ" className="flex flex-col gap-150">
      <h3 id="day-occ" className="font-heading-small text-default">
        Ocorrências do turno
      </h3>
      {!any && (
        <p className="text-subtlest">
          Nenhum material faltou e ninguém faltou {shift === "all" ? "neste dia" : `no ${SHIFT_META[shift].label.toLowerCase()}`}.
          {canEdit && " Para registrar, use o lápis do turno."}
        </p>
      )}
      <div className={cn("grid items-start gap-150", shift === "all" && "m:grid-cols-3")}>
        {shifts.map(({ s, absences, shortages }) => {
          const label = SHIFT_META[s].label;
          const empty = !absences.length && !shortages.length;
          return (
            <article key={s} aria-label={`Ocorrências do ${label.toLowerCase()}`} className="flex min-w-0 flex-col overflow-hidden rounded-large border bg-surface-raised">
              <header className="flex items-center gap-100 border-b bg-surface-sunken px-200 py-100">
                <span aria-hidden className={cn("size-dot shrink-0 rounded-full", SHIFT_FILL[s])} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-heading-xsmall text-default">{label}</span>
                  <span className="font-body-small text-subtlest">{SHIFT_META[s].hours}</span>
                </span>
                {showNames && !empty && (
                  <IconButton
                    icon={ClipboardCopy}
                    label={`Copiar as ocorrências do ${label.toLowerCase()} no formato da planilha`}
                    spacing="compact"
                    onClick={() => copy(s, sheetLines(shortages, absences))}
                  />
                )}
                {canEdit && <IconButton icon={Pencil} label={`Corrigir as ocorrências do ${label.toLowerCase()}`} spacing="compact" onClick={() => setEditing(s)} />}
              </header>

              <Block icon={PackageX} title="Materiais faltantes" count={shortages.length} empty="Nenhum material faltou">
                {shortages.map((m) => (
                  <li key={m.id} className="flex flex-col gap-050 border-t py-100 first:border-t-0 first:pt-0 last:pb-0">
                    <span className="flex min-w-0 flex-col">
                      <span className="font-code font-body-small font-semibold text-default">{m.materialCode}</span>
                      <span className="break-words text-default">{m.materialDescription}</span>
                    </span>
                    {m.machineIds.length > 0 && (
                      <span className="flex flex-wrap gap-050">
                        {m.machineIds.map((id) => (
                          <Lozenge key={id}>{machineName(id)}</Lozenge>
                        ))}
                      </span>
                    )}
                    {m.note && <span className="font-body-small text-subtle">{m.note}</span>}
                  </li>
                ))}
              </Block>

              <Block icon={UserX} title="Falta de pessoas" count={absences.length} empty="Ninguém faltou">
                {showNames ? (
                  absences.map((a) => (
                    <li key={a.id} className="flex flex-col gap-025 border-t py-100 first:border-t-0 first:pt-0 last:pb-0">
                      <span className="flex flex-wrap items-center justify-between gap-x-100 gap-y-025">
                        <span className={cn("min-w-0 break-words", a.name ? "text-default" : "text-subtle")}>{a.name ?? "Sem nome (colaborador inativado)"}</span>
                        <Lozenge appearance={ABSENCE_META[a.kind].appearance}>
                          {ABSENCE_META[a.kind].label}
                          {a.time ? ` · ${a.time}` : ""}
                        </Lozenge>
                      </span>
                      {a.note && <span className="font-body-small text-subtle">{a.note}</span>}
                    </li>
                  ))
                ) : (
                  <li className="text-default">
                    {absences.length === 1 ? "1 pessoa" : `${absences.length} pessoas`}: {kindSummary(absences)}
                    <span className="block font-body-small text-subtlest">Os nomes ficam só com o gestor.</span>
                  </li>
                )}
              </Block>
            </article>
          );
        })}
      </div>

      {editing && (
        <Dialog.Root open onOpenChange={(o) => !o && setEditing(null)}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-modal bg-blanket data-[state=open]:animate-fade-in" />
            <Dialog.Content
              aria-describedby={undefined}
              className="fixed inset-0 z-modal m-auto flex h-fit max-h-modal-max-height w-[44rem] max-w-modal-gutter flex-col rounded-xlarge bg-surface-overlay text-default shadow-overlay outline-none data-[state=open]:animate-menu-in"
            >
              <div className="flex items-start gap-100 px-300 pb-100 pt-300">
                <Dialog.Title className="min-w-0 flex-1 font-heading-medium">
                  Ocorrências de {dayFmt.format(new Date(`${date}T12:00:00`))} · {SHIFT_META[editing].label}
                </Dialog.Title>
                <Dialog.Close asChild>
                  <IconButton icon={X} label="Fechar" showTooltip={false} className="-mr-100 -mt-050" />
                </Dialog.Close>
              </div>
              <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto bg-surface-sunken px-300 py-200">
                <ShiftOccurrences date={date} shift={editing} notify={notify} showHeading={false} />
              </div>
              <div className="flex justify-end gap-100 px-300 pb-300 pt-200">
                <Dialog.Close asChild>
                  <Button appearance="primary">Pronto</Button>
                </Dialog.Close>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </section>
  );
}

/** Uma parte da caixa do turno: título com contagem e a lista (ou o "nenhum") */
function Block({ icon: Icon, title, count, empty, children }: { icon: typeof PackageX; title: string; count: number; empty: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-100 border-t px-200 py-150 first-of-type:border-t-0">
      <span className="flex items-center gap-075 font-body-small font-semibold text-subtle">
        <Icon aria-hidden className="size-icon-small shrink-0 text-icon-subtle" />
        {title}
        {count > 0 && <span className="ml-auto tabular-nums text-subtlest">{count}</span>}
      </span>
      {count > 0 ? <ul className="flex flex-col">{children}</ul> : <p className="font-body-small text-subtlest">{empty}</p>}
    </div>
  );
}

/** "1 faltou, 1 saiu mais cedo": o que quem não é gestor vê */
function kindSummary(absences: Absence[]) {
  return ABSENCE_KINDS.map((k) => [k, absences.filter((a) => a.kind === k).length] as const)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${ABSENCE_META[k].label.toLowerCase()}`)
    .join(", ");
}
