import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { RefreshCw } from "lucide-react";

/**
 * Listens for the `vextorn:sw-update` event dispatched by the service-worker
 * registration in `main.tsx` and surfaces a sticky toast prompting the user
 * to load the new build. Clicking "Refresh" tells the waiting SW to take
 * over (`SKIP_WAITING`); the `controllerchange` listener in main.tsx then
 * reloads the page so the user is on the latest deploy.
 *
 * The toast is shown at most once per page load — if the user dismisses it,
 * we won't nag them again until they actually navigate or come back from a
 * background tab (the visibility-change re-check in main.tsx).
 */
export function UpdateAvailableToast() {
  const { toast } = useToast();
  const shownRef = useRef(false);

  useEffect(() => {
    const onUpdate = (event: Event) => {
      if (shownRef.current) return;
      const detail = (event as CustomEvent<ServiceWorkerRegistration>).detail;
      const waiting = detail?.waiting;
      if (!waiting) return;
      shownRef.current = true;

      toast({
        title: "New version available",
        description: "We've shipped an update — refresh to load the latest improvements.",
        duration: Infinity,
        action: (
          <ToastAction
            altText="Refresh now"
            onClick={() => waiting.postMessage("SKIP_WAITING")}
            data-testid="button-refresh-update"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh
          </ToastAction>
        ),
      });
    };

    window.addEventListener("vextorn:sw-update", onUpdate as EventListener);
    return () => window.removeEventListener("vextorn:sw-update", onUpdate as EventListener);
  }, [toast]);

  return null;
}
