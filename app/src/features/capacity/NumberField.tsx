import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { TextField } from "@/components/ui/TextField";

const fmt = (n: number | null, decimals: number) =>
  n == null ? "" : n.toLocaleString("pt-BR", { maximumFractionDigits: decimals, useGrouping: false });

interface NumberFieldProps {
  /** nome acessível (o rótulo fica oculto dentro de tabelas) */
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  decimals?: number;
  min?: number;
  max?: number;
  suffix?: string;
  /** diferente da planilha: borda de "discovery" */
  changed?: boolean;
  allowEmpty?: boolean;
  className?: string;
  showLabel?: boolean;
  /** 24px, para tabelas */
  compact?: boolean;
}

/**
 * Campo numérico para editar parâmetros: aceita vírgula decimal (11,5),
 * recalcula a cada tecla válida e mostra o erro sem perder o que foi digitado.
 */
export function NumberField({
  label,
  value,
  onChange,
  decimals = 0,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  suffix,
  changed,
  allowEmpty,
  className,
  showLabel,
  compact,
}: NumberFieldProps) {
  const [text, setText] = useState(fmt(value, decimals));
  const [focused, setFocused] = useState(false);

  // Valor mudou por fora (restaurar, aplicar a todos): atualiza o texto
  useEffect(() => {
    if (!focused) setText(fmt(value, decimals));
  }, [value, decimals, focused]);

  const parsed = text.trim() === "" ? null : Number(text.replace(",", "."));
  const error =
    parsed === null
      ? allowEmpty
        ? null
        : "Obrigatório"
      : Number.isNaN(parsed)
        ? "Número inválido"
        : parsed < min
          ? `Mínimo ${fmt(min, decimals)}`
          : parsed > max
            ? `Máximo ${fmt(max, decimals)}`
            : null;

  return (
    <TextField
      label={label}
      hideLabel={!showLabel}
      inputMode={decimals ? "decimal" : "numeric"}
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        if (!error) setText(fmt(value, decimals));
      }}
      onChange={(e) => {
        const next = e.target.value.replace(decimals ? /[^\d,.]/g : /\D/g, "");
        setText(next);
        const n = next.trim() === "" ? null : Number(next.replace(",", "."));
        if (n === null ? allowEmpty : !Number.isNaN(n) && n >= min && n <= max) onChange(n);
      }}
      error={error}
      elemAfter={suffix}
      spacing={compact ? "compact" : "default"}
      inputClassName={cn("text-right tabular-nums", changed && !error && "border-discovery")}
      className={className}
    />
  );
}
