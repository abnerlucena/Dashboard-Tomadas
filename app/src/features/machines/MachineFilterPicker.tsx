import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, Search } from "lucide-react";
import { useState } from "react";
import { MACHINE_GROUPS, machineById } from "@/data/machines";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { cn, formatNumber } from "@/lib/utils";
import { filterLabel } from "./machineFilter";

interface Props {
  /** todas as máquinas, na ordem do cadastro */
  machines: Array<{ id: string; name: string }>;
  included: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  /** produção do dia aberto por máquina, para ver o peso de cada uma antes de tirar */
  quantities: Record<string, number>;
  /** onde as máquinas entram: a conta do Histórico ou o ranking */
  scope?: "conta" | "ranking";
}

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * "Máquinas" do Histórico: um painel com todas as máquinas marcadas. Desmarcar tira
 * a máquina da conta; "Só as encontradas" (depois de buscar) deixa só algumas. O
 * painel não fecha ao marcar, para tirar várias de uma vez.
 */
export function MachineFilterPicker({ machines, included, onChange, quantities, scope = "conta" }: Props) {
  const where = scope === "ranking" ? "no ranking" : "na conta";
  const [query, setQuery] = useState("");
  const q = normalize(query.trim());
  const active = included.size !== machines.length;
  const label = filterLabel(included, machines);
  const visible = (id: string) => !q || normalize(machineById(id).name).includes(q);
  const found = machines.filter((m) => visible(m.id));

  const set = (ids: string[], on: boolean) => {
    const next = new Set(included);
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    onChange(next);
  };

  return (
    <Popover.Root onOpenChange={(o) => !o && setQuery("")}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Máquinas: ${label}`}
          className={cn(
            "ds-pressable group inline-flex h-control shrink-0 items-center rounded-medium border font-body",
            active
              ? "border-selected bg-selected text-selected hover:bg-selected-hovered active:bg-selected-pressed"
              : "bg-surface text-default hover:bg-neutral-subtle-hovered active:bg-neutral-subtle-pressed data-[state=open]:bg-neutral-subtle-pressed",
          )}
        >
          <span className={cn("pl-150 pr-100", active ? "text-selected" : "text-subtlest")}>Máquinas</span>
          <span aria-hidden className={cn("h-200 border-l", active && "border-selected")} />
          <span className="flex items-center gap-050 pl-100 pr-100 font-medium">
            {label}
            <ChevronDown aria-hidden className={cn("size-icon-small", active ? "text-icon-selected" : "text-icon-subtle")} />
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={8}
          aria-label={`Escolher as máquinas ${scope === "ranking" ? "do ranking" : "da conta"}`}
          className="z-menu flex max-h-[min(34rem,80dvh)] w-[26rem] max-w-[calc(100vw-1rem)] flex-col rounded-large bg-surface-overlay text-default shadow-overlay"
        >
          <div className="flex flex-col gap-100 border-b p-150">
            <div className="flex items-baseline justify-between gap-100">
              <h2 className="font-heading-xsmall">Máquinas {where}</h2>
            </div>
            <label className="relative flex items-center">
              <Search aria-hidden className="pointer-events-none absolute left-100 size-icon-small text-icon-subtle" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar máquina (ex.: kit)"
                aria-label="Buscar máquina"
                className="h-control w-full rounded-medium border border-input bg-input pl-400 pr-100 font-body"
              />
            </label>
            <div className="flex flex-wrap gap-050">
              <Button appearance="outline" spacing="compact" onClick={() => onChange(new Set(machines.map((m) => m.id)))}>
                Marcar todas
              </Button>
              <Button appearance="outline" spacing="compact" onClick={() => onChange(new Set())}>
                Desmarcar todas
              </Button>
              {q && found.length > 0 && (
                <>
                  <Button appearance="outline" spacing="compact" onClick={() => onChange(new Set(found.map((m) => m.id)))}>
                    Só as encontradas
                  </Button>
                  <Button appearance="outline" spacing="compact" onClick={() => set(found.map((m) => m.id), false)}>
                    Tirar as encontradas
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-100 py-050">
            {MACHINE_GROUPS.map((g) => {
              const all = g.machineIds.filter((id) => machines.some((m) => m.id === id));
              const rows = all.filter(visible);
              if (!rows.length) return null;
              const on = all.filter((id) => included.has(id)).length;
              return (
                <div key={g.id} className="mt-050">
                  <label className="flex cursor-pointer items-center gap-150 rounded-medium px-100 py-100 font-semibold text-subtle hover:bg-neutral-subtle-hovered">
                    <Checkbox
                      label={`Grupo ${g.label}`}
                      checked={on === all.length}
                      isIndeterminate={on > 0 && on < all.length}
                      onChange={(e) => set(all, e.target.checked)}
                    />
                    {g.label}
                    <span className="ml-auto font-body-small font-normal tabular-nums text-subtlest">
                      {on} de {all.length}
                    </span>
                  </label>
                  {rows.map((id) => {
                    const m = machineById(id);
                    const on = included.has(id);
                    return (
                      <label key={id} className="flex min-h-control cursor-pointer items-center gap-150 rounded-medium py-050 pl-500 pr-100 hover:bg-neutral-subtle-hovered">
                        <Checkbox label={m.name} checked={on} onChange={(e) => set([id], e.target.checked)} />
                        <span className={cn("min-w-0 flex-1", !on && "text-subtlest line-through")}>{m.name}</span>
                        <span className="font-body-small tabular-nums text-subtlest">{formatNumber(quantities[id] ?? 0)}</span>
                      </label>
                    );
                  })}
                </div>
              );
            })}
            {q && found.length === 0 && <p className="px-100 py-150 text-subtle">Nenhuma máquina com esse nome.</p>}
          </div>

          <div className="flex items-center justify-between gap-100 border-t px-150 py-100">
            <span className="font-body-small text-subtle">
              <span className="font-semibold tabular-nums text-default">{included.size}</span> de {machines.length} máquinas {where}
            </span>
            <Popover.Close asChild>
              <Button appearance="primary">Concluir</Button>
            </Popover.Close>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
