import * as React from "react"
import { cn } from "@/lib/utils"

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

// Implementação mínima baseada em input checkbox, mantendo a API checked/onCheckedChange
const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => {
    return (
      <input
        type="checkbox"
        ref={ref}
        checked={checked}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
        className={cn(
          "h-4 w-4 cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className
        )}
        {...props}
      />
    )
  }
)
Switch.displayName = "Switch"

export { Switch }