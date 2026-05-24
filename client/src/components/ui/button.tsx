import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold " +
  "transition-all duration-200 ease-out " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background " +
  "disabled:pointer-events-none disabled:opacity-40 " +
  "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 " +
  "hover-elevate active-elevate-2",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border border-primary-border shadow-sm " +
          "hover:brightness-110 hover:shadow-[0_0_18px_rgba(0,188,212,0.40)] hover:-translate-y-px " +
          "active:brightness-95 active:translate-y-0 active:shadow-none",
        destructive:
          "bg-[#e53535] text-white border border-[rgba(255,100,100,0.25)] shadow-[0_2px_8px_rgba(229,53,53,0.4)] " +
          "hover:bg-[#f03030] hover:shadow-[0_0_20px_rgba(229,53,53,0.55)] hover:-translate-y-px " +
          "active:bg-[#c52b2b] active:translate-y-0 active:shadow-none",
        outline:
          "border [border-color:var(--button-outline)] bg-background/30 backdrop-blur-sm shadow-xs " +
          "hover:bg-background/60 hover:border-primary/35 hover:[border-color:rgba(0,188,212,0.28)] hover:-translate-y-px " +
          "active:translate-y-0 active:shadow-none",
        secondary:
          "bg-[#252525] text-[#e8e8e8] border border-[rgba(255,255,255,0.07)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_2px_4px_rgba(0,0,0,0.5)] " +
          "hover:bg-[#2e2e2e] hover:border-[rgba(255,255,255,0.12)] hover:-translate-y-px hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_4px_8px_rgba(0,0,0,0.6)] " +
          "active:bg-[#1e1e1e] active:translate-y-0 active:shadow-none",
        ghost:
          "border border-transparent text-muted-foreground " +
          "hover:bg-[rgba(255,255,255,0.06)] hover:text-foreground hover:border-[rgba(255,255,255,0.06)]",
      },
      size: {
        default: "min-h-9 px-4 py-2",
        sm: "min-h-8 rounded-md px-3 text-xs",
        lg: "min-h-11 rounded-md px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
