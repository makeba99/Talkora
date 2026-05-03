import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      {/* role="region" belongs on a <div>, not on the <ol> that Radix renders
          for ToastViewport (axe-core aria-allowed-role: region is not in the
          allowed role list for <ol>). Wrapping with a <div> keeps the landmark
          while satisfying the ARIA in HTML spec. */}
      <div role="region" aria-label="Notifications">
        <ToastViewport />
      </div>
    </ToastProvider>
  )
}
