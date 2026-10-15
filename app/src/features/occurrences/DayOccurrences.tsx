import * as Dialog from "@radix-ui/react-dialog";
import { ClipboardCopy, PackageX, Pencil, UserX, X } from "lucide-react";
import { useState } from "react";
import { SHIFTS, SHIFT_META, machineById, type Shift } from "@/data/machines";
import { Button, IconButton } from "@/components/ui/Button";
import { Lozenge } from "@/components/ui/Lozenge";
import { useAccess } from "@/features/access/AccessContext";
import type { Notify } from "@/lib/utils";
import { ABSENCE_META, sheetLines } from "./occurrences";
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
  const showNames = can("collaborators.manage");
  const canEdit = can("production.edit") || can("production.create");
  const shifts = (shift === "all" ? SHIFTS : [shift]).map((s) => ({ s, ...occurrencesOf(store, date, s) }));
  const any = shifts.some((x) => x.absences.length || x.shortages.length);
  const nameOf = (id: string) => store.collaborators.find((c) => c.id === id)?.name ?? "Colaborador removido";

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
      {!any && shift === "all" ? (
        <p className="text-subtlest">Nenhum material faltou e ninguém faltou neste dia.</p>
      ) : (
        <div className="grid gap-150 m:grid-cols-3">
          {shifts.map(({ s, absences, shortages }) => (
            <div key={s} className="flex min-w-0 flex-col gap-100 rounded-large border p-200">
              <div className="flex items-center gap-100">
                <span className="font-heading-xsmall text-default">{SHIFT_META[s].label}</span>
                <span className="ml-auto flex gap-025">
                  {showNames && (absences.length > 0 || shortages.length > 0) && (
                    <IconButton
                      icon={ClipboardCopy}
                      label={`Copiar as ocorrências do ${SHIFT_META[s].label.toLowerCase()} no formato da planilha`}
                      spacing="compact"
                      onClick={() => copy(s, sheetLines(shortages, absences, nameOf))}
                    />
                  )}
                  {canEdit && (
                    <IconButton icon={Pencil} label={`Corrigir as ocorrências do ${SHIFT_META[s].label.toLowerCase()}`} spacing="compact" onClick={() => setEditing(s)} />
                  )}
                </span>
              </div>
              {!absences.length && !shortages.length && <p className="font-body-small text-subtlest">Sem ocorrências.</p>}
              {shortages.length > 0 && (
                <div className="flex flex-col gap-050">
                  <span className="flex items-center gap-050 font-body-small font-semibold text-subtle">
                    <PackageX aria-hidden className="size-icon-small" />
                    Materiais faltantes
                  </span>
                  <ul className="flex flex-col gap-050">
                    {shortages.map((m) => (
                      <li key={m.id} className="font-body-small">
                        <span className="font-code text-default">{m.materialCode}</span> <span className="text-default">{m.materialDescription}</span>
                        <span className="block text-subtlest">{[m.machineId ? machineById(m.machineId).name : "Turno inteiro", m.note].filter(Boolean).join(" · ")}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {absences.length > 0 && (
                <div className="flex flex-col gap-050">
                  <span className="flex items-center gap-050 font-body-small font-semibold text-subtle">
                    <UserX aria-hidden className="size-icon-small" />
                    Falta de pessoas
                  </span>
                  {showNames ? (
                    <ul className="flex flex-col gap-050">
                      {absences.map((a) => (
                        <li key={a.id} className="flex flex-wrap items-center gap-x-100 font-body-small text-default">
                          {nameOf(a.collaboratorId)}
                          <Lozenge appearance={ABSENCE_META[a.kind].appearance}>
                            {ABSENCE_META[a.kind].label}
                            {a.time ? ` · ${a.time}` : ""}
                          </Lozenge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="font-body-small text-default">
                      {absences.length === 1 ? "1 pessoa" : `${absences.length} pessoas`}. Os nomes ficam só com líderes e gestor.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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
