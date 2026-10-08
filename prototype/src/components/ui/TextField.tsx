import { CircleAlert, TriangleAlert } from "lucide-react";
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface FieldProps {
  label: string;
  /** Esconde o rótulo visualmente (continua acessível) — ex.: campos dentro de tabela */
  hideLabel?: boolean;
  helper?: ReactNode;
  error?: string | null;
  warning?: string | null;
  isRequired?: boolean;
  className?: string;
}

export const inputBase =
  "w-full min-w-0 rounded-medium border bg-input font-body text-default transition-colors duration-hover ease-out placeholder:text-subtlest hover:bg-input-hovered focus:border-focused disabled:cursor-not-allowed disabled:border-disabled disabled:bg-disabled disabled:text-disabled";

export function FieldShell({
  id,
  label,
  hideLabel,
  helper,
  error,
  warning,
  isRequired,
  className,
  children,
}: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-050", className)}>
      <label htmlFor={id} className={cn("font-body-small font-semibold text-subtle", hideLabel && "sr-only")}>
        {label}
        {isRequired && (
          <span aria-hidden className="text-danger">
            {" "}
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} className="flex items-center gap-050 font-body-small text-danger">
          <CircleAlert aria-hidden className="size-icon-small shrink-0" />
          {error}
        </p>
      ) : warning ? (
        <p id={`${id}-msg`} className="flex items-center gap-050 font-body-small text-warning">
          <TriangleAlert aria-hidden className="size-icon-small shrink-0" />
          {warning}
        </p>
      ) : helper ? (
        <p id={`${id}-msg`} className="font-body-small text-subtlest">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

type TextFieldProps = FieldProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
    elemAfter?: ReactNode;
    inputClassName?: string;
    /** "compact" (24px) para campos dentro de tabelas densas */
    spacing?: "default" | "compact";
  };

/** Campo de texto ADS: rótulo acima, ajuda/erro abaixo, borda de input e foco com border.focused. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hideLabel, helper, error, warning, isRequired, className, elemAfter, inputClassName, spacing = "default", id: idProp, ...rest },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const hasMsg = !!(error || warning || helper);
  return (
    <FieldShell {...{ id, label, hideLabel, helper, error, warning, isRequired, className }}>
      <span className="relative flex items-center">
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={hasMsg ? `${id}-msg` : undefined}
          aria-required={isRequired || undefined}
          className={cn(
            inputBase,
            spacing === "compact" ? "h-control-compact px-075" : "h-control px-100",
            error ? "border-danger" : warning ? "border-warning" : "border-input",
            elemAfter && "pr-500",
            inputClassName,
          )}
          {...rest}
        />
        {elemAfter && (
          <span className={cn("pointer-events-none absolute font-body-small text-subtlest", spacing === "compact" ? "right-075" : "right-100")}>
            {elemAfter}
          </span>
        )}
      </span>
    </FieldShell>
  );
});

type TextAreaProps = FieldProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & { maxLength?: number };

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, hideLabel, helper, error, warning, isRequired, className, id: idProp, maxLength, value, ...rest },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const count = typeof value === "string" ? value.length : 0;
  return (
    <FieldShell
      {...{ id, label, hideLabel, error, warning, isRequired, className }}
      helper={
        helper ??
        // O contador só aparece perto do limite: antes disso é ruído
        (maxLength && count >= maxLength * 0.8 ? (
          <span className="tabular-nums">
            {count} de {maxLength} caracteres
          </span>
        ) : null)
      }
    >
      <textarea
        ref={ref}
        id={id}
        value={value}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-msg`}
        className={cn(inputBase, "min-h-800 resize-y px-100 py-075", error ? "border-danger" : "border-input")}
        {...rest}
      />
    </FieldShell>
  );
});
