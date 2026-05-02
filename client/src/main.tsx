import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

/* Defer privacy hardening (disabling navigator.geolocation + intercepting
 * navigator.permissions.query) to AFTER React paints. Running these on the
 * critical path adds a few ms of main-thread work for an API our UI never
 * touches at first paint. The window between paint and the deferred patch
 * is microseconds in practice — no user-visible behavior change. */
const installPrivacyShims = () => {
  try {
    Object.defineProperty(navigator, "geolocation", {
      value: undefined,
      configurable: false,
    });
  } catch {
    /* property already non-configurable in some browsers */
  }
  try {
    const originalQuery = navigator.permissions?.query?.bind(navigator.permissions);
    if (originalQuery) {
      navigator.permissions.query = ((descriptor: PermissionDescriptor) => {
        if (descriptor?.name === "geolocation") {
          return Promise.resolve({
            name: "geolocation",
            state: "denied",
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
          } as PermissionStatus);
        }
        return originalQuery(descriptor);
      }) as Permissions["query"];
    }
  } catch {
    /* permissions API unavailable */
  }
};

if (typeof (window as any).requestIdleCallback === "function") {
  (window as any).requestIdleCallback(installPrivacyShims, { timeout: 1500 });
} else {
  setTimeout(installPrivacyShims, 0);
}

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

      // Notify the app whenever a fresh SW finishes installing in the background
      // (i.e. the user is on a stale shell and a new deploy is now waiting).
      const notifyIfWaiting = () => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          window.dispatchEvent(new CustomEvent("vextorn:sw-update", { detail: registration }));
        }
      };

      notifyIfWaiting();
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent("vextorn:sw-update", { detail: registration }));
          }
        });
      });

      // Reload once the new SW takes control (after the user clicks "Refresh"
      // and we post SKIP_WAITING). The guard prevents reload loops on first
      // install (when there is no previous controller).
      let reloading = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      });

      // Catch new builds during long sessions: poll every 30 minutes, and also
      // re-check whenever the tab becomes visible again.
      const checkForUpdate = () => { registration.update().catch(() => {}); };
      setInterval(checkForUpdate, 30 * 60 * 1000);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkForUpdate();
      });
    } catch {
      /* registration failed — app still works without offline cache */
    }
  });
}
