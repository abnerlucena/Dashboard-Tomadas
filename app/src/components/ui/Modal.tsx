import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button, IconButton } from "./Button";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  /** Ação principal; "danger" para ações destrutivas */
  primary: { label: string; onClick: () => void; appearance?: "primary" | "danger"; isLoading?: boolean; isDisabled?: boolean };
  cancelLabel?: string;
}

/**
 * Modal ADS: surface.overlay + shadow.overlay, radius.xlarge, sobre o véu.
 * Fica centralizado (sem transform-origin do gatilho). Esc e o "X" fecham.
 */
export function Modal({ open, onOpenChange, title, children, primary, cancelLabel = "Cancelar" }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-modal bg-blanket data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-modal m-auto flex h-fit max-h-modal-max-height w-modal max-w-modal-gutter flex-col rounded-xlarge bg-surface-overlay text-default shadow-overlay outline-none data-[state=closed]:animate-fade-out data-[state=open]:animate-menu-in"
        >
          <div className="flex items-start gap-100 px-300 pb-100 pt-300">
            <Dialog.Title className="min-w-0 flex-1 font-heading-medium">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton icon={X} label="Fechar" showTooltip={false} className="-mr-100 -mt-050" />
            </Dialog.Close>
          </div>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-300 pb-200 text-default">{children}</div>
          <div className="flex justify-end gap-100 px-300 pb-300 pt-100">
            <Dialog.Close asChild>
              <Button appearance="subtle">{cancelLabel}</Button>
            </Dialog.Close>
            <Button appearance={primary.appearance ?? "primary"} isLoading={primary.isLoading} isDisabled={primary.isDisabled} onClick={primary.onClick}>
              {primary.label}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
