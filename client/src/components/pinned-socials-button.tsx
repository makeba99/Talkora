import { useEffect, useState } from "react";
import { Share2, X } from "lucide-react";
import { SiInstagram, SiLinkedin, SiFacebook } from "react-icons/si";
import { useAuth } from "@/hooks/use-auth";

/**
 * Floating round button on the right edge that, when tapped, fans out the
 * current user's Instagram / LinkedIn / Facebook links — like the pinned
 * socials button on free4talk.
 *
 * Only renders when the user has opted in (`socialsPinned`) AND has at
 * least one social URL filled in. Position is below the up/down scroll
 * jumper so the two never overlap.
 */
function ensureUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function PinnedSocialsButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const u = user as any;
  const enabled = !!u?.socialsPinned;
  const instagram = ensureUrl(u?.instagramUrl);
  const linkedin = ensureUrl(u?.linkedinUrl);
  const facebook = ensureUrl(u?.facebookUrl);
  const hasAny = !!(instagram || linkedin || facebook);

  // Close on Escape for accessibility.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!enabled || !hasAny) return null;

  return (
    <div
      className="pinned-socials"
      data-open={open ? "true" : "false"}
      data-testid="pinned-socials"
    >
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
        onClick={() => setOpen((v) => !v)}
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
