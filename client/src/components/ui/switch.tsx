import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=unchecked]:border-transparent data-[state=unchecked]:bg-input",
      "data-[state=checked]:border-[hsl(var(--neu-orange,20_95%_52%)/0.55)] data-[state=checked]:bg-[hsl(265_32%_12%)]",
      className
    )}
    style={{
      boxShadow: props.checked || (props as any)["data-state"] === "checked"
        ? "0 0 0 1px hsl(var(--neu-orange,20_95%_52%)/0.25), 0 0 8px hsl(var(--neu-orange,20_95%_52%)/0.18)"
        : undefined,
    }}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full shadow-md ring-0 transition-all duration-200",
        "data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-5",
        "data-[state=unchecked]:bg-muted-foreground/50",
        "data-[state=checked]:bg-[hsl(var(--neu-orange-hi,20_95%_62%))]",
      )}
      style={{
        boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
      }}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
