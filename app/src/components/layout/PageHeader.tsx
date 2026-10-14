import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Espaçamento horizontal padrão das páginas (compartilhado por cabeçalho e conteúdo) */
export const PAGE_GUTTER = "px-200 m:px-400";

interface PageHeaderProps {
  title: ReactNode;
  /** Trilha acima do título (ex.: Linhas › Embalagem) */
  breadcrumbs?: string[];
  lozenge?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Abas ou conteúdo logo abaixo do título */
  children?: ReactNode;
}

/** Cabeçalho de página: um H1 por página (font.heading.large), ações à direita. */
export function PageHeader({ title, breadcrumbs, lozenge, description, actions, children }: PageHeaderProps) {
  return (
    <div className={cn(PAGE_GUTTER, "pt-300")}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Trilha" className="mb-050">
          <ol className="flex items-center gap-050 font-body-small text-subtlest">
            {breadcrumbs.map((b, i) => (
              <li key={b} className="flex items-center gap-050">
                {i > 0 && <ChevronRight aria-hidden className="size-icon-small" />}
                {b}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-center justify-between gap-200">
        <div className="flex min-w-0 items-center gap-150">
          <h1 className="font-heading-large text-default">{title}</h1>
          {lozenge}
        </div>
        {actions && <PageActions>{actions}</PageActions>}
      </div>
      {description && <p className="mt-050 max-w-search-width text-subtle">{description}</p>}
      {children}
    </div>
  );
}

/**
 * Ações da página. A partir de 768px ficam no cabeçalho; no mobile, numa barra
 * fixa no rodapé (os botões dividem a largura), sempre ao alcance do polegar.
 * A versão escondida sai da árvore de acessibilidade (display: none).
 */
export function PageActions({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="hidden flex-wrap items-center gap-100 s:flex">{children}</div>
      <div className="fixed inset-x-0 bottom-0 z-topnav flex gap-100 border-t bg-surface px-200 py-150 s:hidden [&>*]:flex-1">
        {children}
      </div>
    </>
  );
}

/** Corpo de página com o mesmo recuo do cabeçalho */
export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(PAGE_GUTTER, "flex flex-col gap-300 py-300", className)}>{children}</div>;
}
