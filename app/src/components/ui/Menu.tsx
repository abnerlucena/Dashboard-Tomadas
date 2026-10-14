import * as DM from "@radix-ui/react-dropdown-menu";
import { Check, type LucideIcon } from "lucide-react";
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Menu suspenso (dropdown). Superfície overlay + sombra overlay, radius.large,
 * entrada de 200ms a partir do gatilho (transform-origin do Radix).
 * modal={false}: não trava a rolagem nem desloca o layout.
 */
export const Menu = (props: ComponentPropsWithoutRef<typeof DM.Root>) => <DM.Root modal={false} {...props} />;
export const MenuTrigger = DM.Trigger;
export const MenuRadioGroup = DM.RadioGroup;

export const MenuContent = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof DM.Content>>(
  function MenuContent({ className, sideOffset = 6, align = "start", ...props }, ref) {
    return (
      <DM.Portal>
        <DM.Content
          ref={ref}
          sideOffset={sideOffset}
          align={align}
          collisionPadding={8}
          className={cn(
            "z-menu min-w-menu-min origin-menu overflow-hidden rounded-large bg-surface-overlay py-075 text-default shadow-overlay",
            "data-[state=closed]:animate-menu-out data-[state=open]:animate-menu-in",
            className,
          )}
          {...props}
        />
      </DM.Portal>
    );
  },
);

const itemClass =
  "relative flex min-h-control cursor-default select-none items-center gap-100 px-150 py-075 font-body text-default outline-none transition-colors duration-hover ease-out data-[highlighted]:bg-neutral-subtle-hovered data-[disabled]:pointer-events-none data-[disabled]:text-disabled active:bg-neutral-subtle-pressed";

interface MenuItemProps extends ComponentPropsWithoutRef<typeof DM.Item> {
  icon?: LucideIcon;
  description?: string;
  elemAfter?: ReactNode;
}

export const MenuItem = forwardRef<HTMLDivElement, MenuItemProps>(function MenuItem(
  { className, icon: Icon, description, elemAfter, children, ...props },
  ref,
) {
  return (
    <DM.Item ref={ref} className={cn(itemClass, className)} {...props}>
      {Icon && <Icon aria-hidden className="size-icon-small shrink-0 text-icon-subtle" />}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{children}</span>
        {description && <span className="font-body-small text-subtlest">{description}</span>}
      </span>
      {elemAfter}
    </DM.Item>
  );
});

export const MenuRadioItem = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof DM.RadioItem>>(
  function MenuRadioItem({ className, children, ...props }, ref) {
    return (
      <DM.RadioItem
        ref={ref}
        className={cn(itemClass, "data-[state=checked]:font-medium data-[state=checked]:text-selected", className)}
        {...props}
      >
        <span className="flex size-icon-small shrink-0 items-center justify-center">
          <DM.ItemIndicator>
            <Check aria-hidden className="size-icon-small text-icon-selected" />
          </DM.ItemIndicator>
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-100">{children}</span>
      </DM.RadioItem>
    );
  },
);

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <DM.Label className="px-150 pb-050 pt-100 font-heading-xxsmall text-subtlest first:pt-050">{children}</DM.Label>
  );
}

export function MenuSeparator() {
  return <DM.Separator className="my-075 border-t" />;
}
