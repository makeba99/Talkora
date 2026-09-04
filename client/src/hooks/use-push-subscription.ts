import { useState, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export type PushSubState = "unsupported" | "denied" | "subscribed" | "unsubscribed" | "loading";

async function getVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch("/api/push/vapid-public-key");
    if (!res.ok) return null;
    const { publicKey } = await res.json();
    return publicKey ?? null;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function usePushSubscription() {
  const [state, setState] = useState<PushSubState>("loading");
  const queryClient = useQueryClient();

  const checkState = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    const perm = Notification.permission;
    if (perm === "denied") { setState("denied"); return; }

    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      setState(existing ? "subscribed" : "unsubscribed");
    } catch {
      setState("unsubscribed");
    }
  }, []);

  useEffect(() => { checkState(); }, [checkState]);

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      const publicKey = await getVapidPublicKey();
      if (!publicKey) throw new Error("Push notifications not configured on server.");

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const json = sub.toJSON();
      await apiRequest("POST", "/api/push/subscribe", {
        endpoint: json.endpoint,
        p256dh: (json.keys as any)?.p256dh,
        auth: (json.keys as any)?.auth,
        userAgent: navigator.userAgent,
      });
      return sub;
    },
    onSuccess: () => setState("subscribed"),
    onError: async (err: any) => {
      if (typeof Notification !== "undefined" && Notification.permission === "denied") {
        setState("denied");
        return;
      }
      await checkState();
    },
  });

  const unsubscribeMutation = useMutation({
    mutationFn: async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        try {
          await apiRequest("DELETE", "/api/push/unsubscribe", { endpoint: sub.endpoint });
        } catch {
          // still drop local subscription
        }
        await sub.unsubscribe();
      }
    },
    onSuccess: () => setState("unsubscribed"),
  });

  return {
    state,
    subscribe: () => subscribeMutation.mutateAsync(),
    unsubscribe: () => unsubscribeMutation.mutateAsync(),
    isLoading: subscribeMutation.isPending || unsubscribeMutation.isPending,
    error: subscribeMutation.error as Error | null,
    refresh: checkState,
  };
}
