import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type CameraPhase =
  | "idle"
  | "checking"
  | "permission-denied"
  | "unavailable"
  | "preview"
  | "secure-context";

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => {
    try { t.stop(); } catch { /* ignore */ }
  });
}

export function CameraCapture({
  onCapture,
  onClose,
  facingMode = "environment",
}: {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
  facingMode?: "user" | "environment";
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [phase, setPhase] = useState<CameraPhase>("checking");
  const [message, setMessage] = useState<string>("");

  const cleanup = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function openCamera() {
      if (typeof window === "undefined") return;
      if (!window.isSecureContext) {
        setPhase("secure-context");
        setMessage("Camera requires HTTPS (or localhost). Use Upload Photo Instead.");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setPhase("unavailable");
        setMessage("This browser does not support camera capture. Use Upload Photo Instead.");
        return;
      }

      // If the browser already denied permission, do not re-prompt forever.
      try {
        const perm = await (navigator.permissions as any)?.query?.({ name: "camera" });
        if (perm?.state === "denied") {
          if (!cancelled) {
            setPhase("permission-denied");
            setMessage("Camera permission is blocked. Enable it in browser settings, or upload a photo.");
          }
          return;
        }
      } catch {
        // permissions.query is not always available — continue to getUserMedia.
      }

      const attempts: MediaStreamConstraints[] = [
        { video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        { video: { facingMode }, audio: false },
        { video: true, audio: false },
      ];

      let lastErr: any;
      for (const constraints of attempts) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (cancelled) {
            stopStream(stream);
            return;
          }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play().catch(() => {});
          }
          setPhase("preview");
          setMessage("");
          return;
        } catch (err: any) {
          lastErr = err;
        }
      }

      if (cancelled) return;
      const name = lastErr?.name || "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setPhase("permission-denied");
        setMessage("Camera permission is required. Allow access, or upload a photo instead.");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setPhase("unavailable");
        setMessage("No camera was found on this device. Upload a photo instead.");
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        setPhase("unavailable");
        setMessage("Camera is in use by another app. Close it and retry, or upload a photo.");
      } else {
        setPhase("unavailable");
        setMessage("Could not open the camera. Try uploading a photo instead.");
      }
    }

    openCamera();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [cleanup, facingMode]);

  const takePhoto = async () => {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) return;
    cleanup();
    onCapture(blob);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    cleanup();
    onCapture(file);
  };

  return (
    <div className="space-y-3" data-testid="camera-capture">
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/60 min-h-[220px] flex items-center justify-center">
        {phase === "preview" ? (
          <video ref={videoRef} playsInline muted autoPlay className="w-full max-h-[360px] object-contain" />
        ) : phase === "checking" ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-16">
            <Loader2 className="w-4 h-4 animate-spin" /> Checking camera permission…
          </div>
        ) : (
          <div className="px-4 py-10 text-center space-y-2">
            <Camera className="w-8 h-8 mx-auto text-amber-300/80" />
            <p className="text-sm text-white/80">{message}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {phase === "preview" && (
          <Button type="button" onClick={takePhoto} data-testid="button-take-photo">
            <Camera className="w-4 h-4 mr-1.5" /> Take Photo
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          onClick={() => fileRef.current?.click()}
          data-testid="button-upload-photo-instead"
        >
          <ImagePlus className="w-4 h-4 mr-1.5" /> Upload Photo Instead
        </Button>
        <Button type="button" variant="ghost" onClick={() => { cleanup(); onClose(); }}>
          <X className="w-4 h-4 mr-1.5" /> Close
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={onFile}
        />
      </div>
    </div>
  );
}
