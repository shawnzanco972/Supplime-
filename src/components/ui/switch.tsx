import * as SwitchPrimitive from "@radix-ui/react-switch";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-muted transition-colors data-[state=checked]:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-5 translate-x-1 rounded-full bg-card shadow-sm transition-transform data-[state=checked]:translate-x-6" />
    </SwitchPrimitive.Root>
  );
}
