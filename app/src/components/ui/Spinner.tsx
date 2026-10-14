import { cn } from "@/lib/utils";

/** Spinner de carregamento: herda a cor do texto (currentColor). */
export function Spinner({ className, label = "Carregando" }: { className?: string; label?: string }) {
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 16 16"
      className={cn("size-icon-small animate-spin motion-reduce:animate-none", className)}
    >
      <circle cx="8" cy="8" r="6.5" className="fill-none stroke-current opacity-disabled" strokeWidth="2" />
      <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" className="fill-none stroke-current" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
