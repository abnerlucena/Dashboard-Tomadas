import { CircleAlert, CircleCheck, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button, IconButton } from "./Button";

/* ---------- Skeleton: carregamento no formato final ---------- */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block animate-skeleton rounded-small bg-neutral motion-reduce:animate-none", className)} />;
}

/* ---------- Empty state: ícone + título + dica + ação ---------- */
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  hint: ReactNode;
  action?: { label: string; onClick: () => void; icon?: LucideIcon };
  headingLevel?: 2 | 3;
  className?: string;
}

export function EmptyState({ icon: Icon, title, hint, action, headingLevel = 2, className }: EmptyStateProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div className={cn("flex flex-col items-center px-300 py-800 text-center", className)}>
      <span className="mb-200 flex size-empty-icon items-center justify-center rounded-large bg-neutral">
        <Icon aria-hidden className="size-icon-large text-icon-subtle" />
      </span>
      <Heading className="font-heading-small text-default">{title}</Heading>
      <p className="mt-050 max-w-search-width text-subtle">{hint}</p>
      {action && (
        <Button className="mt-200" iconBefore={action.icon} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

/* ---------- Section message (erro inline, danger) ---------- */
interface SectionMessageProps {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}

export function ErrorMessage({ title, children, actions }: SectionMessageProps) {
  return (
    <div role="alert" className="flex gap-150 rounded-large bg-danger p-200">
      <CircleAlert aria-hidden className="mt-025 size-icon-small shrink-0 text-icon-danger" />
      <div className="min-w-0 flex-1">
        <p className="font-heading-xsmall text-default">{title}</p>
        <div className="mt-050 text-default">{children}</div>
        {actions && <div className="mt-150 flex flex-wrap gap-100">{actions}</div>}
      </div>
    </div>
  );
}

/* ---------- Flag (notificação temporária, canto inferior esquerdo) ---------- */
export interface FlagData {
  id: number;
  title: string;
  description?: string;
  appearance?: "success" | "error";
  action?: { label: string; onClick: () => void };
}

export function FlagStack({ flags, onDismiss }: { flags: FlagData[]; onDismiss: (id: number) => void }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-1000 left-200 right-200 z-flag flex max-w-flag flex-col gap-100 s:bottom-300 s:left-300 s:right-auto s:w-flag"
    >
      {flags.map((f) => (
        <Flag key={f.id} flag={f} onDismiss={() => onDismiss(f.id)} />
      ))}
    </div>
  );
}

function Flag({ flag, onDismiss }: { flag: FlagData; onDismiss: () => void }) {
  // O tempo conta desde que o aviso aparece: re-renderizar a tela não reinicia os 5 s
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useEffect(() => {
    const t = window.setTimeout(() => dismiss.current(), 5000);
    return () => window.clearTimeout(t);
  }, []);
  const Icon = flag.appearance === "error" ? CircleAlert : CircleCheck;
  return (
    <div
      role="status"
      className="pointer-events-auto flex origin-bottom-left animate-menu-in gap-150 rounded-large bg-surface-overlay p-200 shadow-overlay"
    >
      <Icon
        aria-hidden
        className={cn(
          "mt-025 size-icon-small shrink-0",
          flag.appearance === "error" ? "text-icon-danger" : "text-icon-success",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="font-heading-xsmall text-default">{flag.title}</p>
        {flag.description && <p className="mt-050 text-subtle">{flag.description}</p>}
        {flag.action && (
          <Button
            appearance="subtle"
            spacing="compact"
            className="-ml-100 mt-100"
            onClick={() => {
              flag.action!.onClick();
              onDismiss();
            }}
          >
            {flag.action.label}
          </Button>
        )}
      </div>
      <IconButton icon={X} label="Fechar notificação" spacing="compact" showTooltip={false} onClick={onDismiss} />
    </div>
  );
}
