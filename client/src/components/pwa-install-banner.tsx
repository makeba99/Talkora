import { useState, useEffect } from "react";
import { X, Share, PlusSquare, MoreVertical, Download } from "lucide-react";

const DISMISSED_KEY = "c2t-pwa-install-dismissed";
const SHOW_DELAY_MS = 4000;

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode(): boolean {
  return (
    ("standalone" in window.navigator && (window.navigator as any).standalone === true) ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

function isMobile(): boolean {
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent);
}

export function PwaInstallBanner() {
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installStep, setInstallStep] = useState<"idle" | "ios-guide">("idle");

  useEffect(() => {
    if (isInStandaloneMode()) return;
    if (!isMobile()) return;
    if (sessionStorage.getItem(DISMISSED_KEY)) return;

    const ios = isIOS();
    setIsIos(ios);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    const timer = setTimeout(() => {
      if (!sessionStorage.getItem(DISMISSED_KEY)) {
        setShow(true);
      }
    }, SHOW_DELAY_MS);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setShow(false);
    setInstallStep("idle");
  };

  const handleInstall = async () => {
    if (isIos) {
      setInstallStep("ios-guide");
      return;
    }
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === "accepted") {
        dismiss();
      }
      setDeferredPrompt(null);
    }
  };

  if (!show) return null;

  if (installStep === "ios-guide") {
    return (
      <div
        className="fixed bottom-0 left-0 right-0 z-[9999] bg-[#1a1528] border-t border-purple-500/30 shadow-2xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        data-testid="pwa-ios-guide"
      >
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Add to Home Screen</p>
            <button
              onClick={dismiss}
              className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-colors"
              data-testid="button-pwa-dismiss-ios"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[11px] font-bold text-purple-300">1</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-white/80">
                Tap the <Share className="w-4 h-4 text-blue-400 flex-shrink-0" /> <strong className="text-white">Share</strong> button in Safari's toolbar
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[11px] font-bold text-purple-300">2</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-white/80">
                Scroll down and tap <PlusSquare className="w-4 h-4 text-white flex-shrink-0" /> <strong className="text-white">Add to Home Screen</strong>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[11px] font-bold text-purple-300">3</span>
              </div>
              <div className="text-sm text-white/80">
                Tap <strong className="text-white">Add</strong> in the top-right corner
              </div>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="w-full py-2.5 rounded-xl bg-purple-600/30 border border-purple-500/30 text-purple-200 text-sm font-medium hover:bg-purple-600/40 transition-colors"
            data-testid="button-pwa-ios-done"
          >
            Got it
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] bg-[#1a1528] border-t border-purple-500/30 shadow-2xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      data-testid="pwa-install-banner"
    >
      <div className="p-4 flex items-center gap-3">
        <img
          src="/vextorn-icon-192.png"
          alt="Vextorn"
          className="w-12 h-12 rounded-2xl shadow-lg flex-shrink-0 object-cover"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight">Install Vextorn</p>
          <p className="text-xs text-white/50 mt-0.5 leading-tight">
            {isIos ? "Add to Home Screen for the best experience" : "Install the app — no App Store needed"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={dismiss}
            className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/15 transition-colors"
            data-testid="button-pwa-dismiss"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            onClick={handleInstall}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 text-white text-xs font-semibold hover:bg-purple-500 active:scale-95 transition-all"
            data-testid="button-pwa-install"
          >
            <Download className="w-3.5 h-3.5" />
            Install
          </button>
        </div>
      </div>
    </div>
  );
}
