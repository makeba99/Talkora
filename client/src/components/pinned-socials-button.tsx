import { useEffect, useRef, useState, useCallback } from "react";
import { Share2, X, GripVertical } from "lucide-react";
import { SiInstagram, SiLinkedin, SiFacebook } from "react-icons/si";
import { useAuth } from "@/hooks/use-auth";

const POS_STORAGE_KEY = "vextorn:pinned-socials:pos:v2";
const EDGE_MARGIN = 14;
const MOBILE_EDGE_MARGIN = 10;

type DragState = {
  startY: number;
  startTop: number;
  pointerId: number;
  moved: boolean;
};

function readSavedTop(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(POS_STORAGE_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function clampTop(top: number, btnHeight: number): number {
  if (typeof window === "undefined") return top;
  const min = EDGE_MARGIN;
  const max = window.innerHeight - btnHeight - EDGE_MARGIN;
  return Math.max(min, Math.min(top, max));
}

function ensureUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Floating round button on the right edge that, when tapped, fans out the
 * current user's Instagram / LinkedIn / Facebook links — like the pinned
 * socials button on free4talk, but next-level neumorphism and **draggable
 * vertically** so the user can park it wherever it doesn't get in the way.
 *
 * Default position is in the lower-right corner (so it lands near the
 * thumbreach zone on phones). The position is persisted in localStorage so
 * it stays put across reloads.
 */
export function PinnedSocialsButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [top, setTop] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const u = user as any;
  const enabled = !!u?.socialsPinned;
  const instagram = ensureUrl(u?.instagramUrl);
  const linkedin = ensureUrl(u?.linkedinUrl);
  const facebook = ensureUrl(u?.facebookUrl);
  const hasAny = !!(instagram || linkedin || facebook);

  // Initial placement: persisted value if present, otherwise lower-right
  // (≈ 75% down the viewport on desktop, just above the bottom edge on
  // small phones so it stays clear of the system gesture area).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = readSavedTop();
    if (saved !== null) {
      setTop(clampTop(saved, 56));
      return;
    }
    const isMobile = window.matchMedia("(max-width: 640px)").matches;
    const fallback = isMobile
      ? window.innerHeight - 110
      : Math.round(window.innerHeight * 0.7);
    setTop(clampTop(fallback, 56));
  }, []);

  // Re-clamp on resize so the button never gets stranded off-screen.
  useEffect(() => {
    const onResize = () => {
      setTop((cur) => (cur === null ? cur : clampTop(cur, wrapRef.current?.offsetHeight ?? 56)));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Close on Escape for accessibility.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const handleHandlePointerDown = useCallback((e: React.PointerEvent<HTMLSpanElement>) => {
    if (top === null) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    try { target.setPointerCapture(e.pointerId); } catch {}
    dragRef.current = {
      startY: e.clientY,
      startTop: top,
      pointerId: e.pointerId,
      moved: false,
    };
    setDragging(true);
  }, [top]);

  const handleHandlePointerMove = useCallback((e: React.PointerEvent<HTMLSpanElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const delta = e.clientY - d.startY;
    if (Math.abs(delta) > 3) d.moved = true;
    const next = clampTop(d.startTop + delta, wrapRef.current?.offsetHeight ?? 56);
    setTop(next);
  }, []);

  const handleHandlePointerUp = useCallback((e: React.PointerEvent<HTMLSpanElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    if (d.moved && top !== null) {
      try { window.localStorage.setItem(POS_STORAGE_KEY, String(top)); } catch {}
    }
    dragRef.current = null;
    setDragging(false);
  }, [top]);

  if (!enabled || !hasAny) return null;

  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches;
  const rightOffset = isMobile ? MOBILE_EDGE_MARGIN : EDGE_MARGIN;

  return (
    <div
      ref={wrapRef}
      className={`pinned-socials ${dragging ? "is-dragging" : ""}`}
      data-open={open ? "true" : "false"}
      data-testid="pinned-socials"
      style={top !== null ? { top, right: rightOffset, bottom: "auto" } : { visibility: "hidden" }}
    >
      <span
        className="pinned-socials-handle"
        onPointerDown={handleHandlePointerDown}
        onPointerMove={handleHandlePointerMove}
        onPointerUp={handleHandlePointerUp}
        onPointerCancel={handleHandlePointerUp}
        role="presentation"
        title="Drag to reposition"
        aria-label="Drag to reposition"
        data-testid="handle-pinned-socials"
      >
        <GripVertical className="w-3 h-3" />
      </span>
      <div className="pinned-socials-fan" aria-hidden={!open}>
        {instagram && (
          <a
            href={instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="pinned-socials-link pinned-socials-instagram"
            tabIndex={open ? 0 : -1}
            aria-label="Open Instagram profile"
            data-testid="pinned-socials-instagram"
            onClick={() => setOpen(false)}
          >
            <SiInstagram className="w-5 h-5" />
          </a>
        )}
        {linkedin && (
          <a
            href={linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="pinned-socials-link pinned-socials-linkedin"
            tabIndex={open ? 0 : -1}
            aria-label="Open LinkedIn profile"
            data-testid="pinned-socials-linkedin"
            onClick={() => setOpen(false)}
          >
            <SiLinkedin className="w-5 h-5" />
          </a>
        )}
        {facebook && (
          <a
            href={facebook}
            target="_blank"
            rel="noopener noreferrer"
            className="pinned-socials-link pinned-socials-facebook"
            tabIndex={open ? 0 : -1}
            aria-label="Open Facebook profile"
            data-testid="pinned-socials-facebook"
            onClick={() => setOpen(false)}
          >
            <SiFacebook className="w-5 h-5" />
          </a>
        )}
      </div>
      <button
        type="button"
        className="pinned-socials-toggle"
        onClick={() => {
          // Don't toggle if the user just finished dragging — keeps the click
          // from accidentally opening the fan after a reposition.
          if (dragRef.current) return;
          setOpen((v) => !v);
        }}
        aria-label={open ? "Hide pinned socials" : "Show pinned socials"}
        aria-expanded={open}
        data-testid="button-pinned-socials-toggle"
      >
        {open ? <X className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
      </button>
    </div>
  );
}

export default PinnedSocialsButton;
