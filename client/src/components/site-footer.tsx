import { useState } from "react";
import {
  Mail,
  Share2,
  Check,
  Shield,
  FileText,
  Link2,
  Send,
} from "lucide-react";
import {
  SiX,
  SiInstagram,
  SiFacebook,
  SiTiktok,
  SiYoutube,
  SiWhatsapp,
  SiTelegram,
} from "react-icons/si";
import { FaLinkedin } from "react-icons/fa6";
import { VextornMark } from "@/components/vextorn-logo";
import { useToast } from "@/hooks/use-toast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type SocialLink = {
  name: string;
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
  hoverHue: string;
};

const SOCIALS: SocialLink[] = [
  { name: "Instagram", href: "https://www.instagram.com/joinvextorn/",          Icon: SiInstagram, hoverHue: "330 75% 60%" },
  { name: "LinkedIn",  href: "https://www.linkedin.com/company/vextorn/",       Icon: FaLinkedin,  hoverHue: "210 80% 55%" },
  { name: "TikTok",    href: "https://www.tiktok.com/@joinvextorn",             Icon: SiTiktok,    hoverHue: "180 80% 55%" },
  { name: "YouTube",   href: "https://www.youtube.com/@vextorn",                Icon: SiYoutube,   hoverHue: "0 85% 55%"   },
];

type ShareDest = {
  name: string;
  Icon: React.ComponentType<{ className?: string }>;
  build: (url: string, text: string) => string;
  hue: string;
};

const SHARE_DESTINATIONS: ShareDest[] = [
  {
    name: "X",
    Icon: SiX,
    build: (url, text) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    hue: "210 80% 60%",
  },
  {
    name: "Facebook",
    Icon: SiFacebook,
    build: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    hue: "220 80% 58%",
  },
  {
    name: "WhatsApp",
    Icon: SiWhatsapp,
    build: (url, text) => `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
    hue: "142 70% 45%",
  },
  {
    name: "Telegram",
    Icon: SiTelegram,
    build: (url, text) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    hue: "200 75% 55%",
  },
  {
    name: "Email",
    Icon: Mail,
    build: (url, text) => `mailto:?subject=${encodeURIComponent("Vextorn — Talk. Share. Belong.")}&body=${encodeURIComponent(`${text}\n\n${url}`)}`,
    hue: "30 75% 60%",
  },
];

export function SiteFooter() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const shareUrl = typeof window !== "undefined" ? window.location.origin : "https://vextorn.com";
  const shareText = "Join Vextorn to practice languages with real people in voice rooms.";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ title: "Link copied", description: "Vextorn link copied to your clipboard." });
      setTimeout(() => setCopied(false), 2200);
    } catch (_) {
      toast({
        title: "Couldn't copy",
        description: "Please copy the URL from your browser bar.",
        variant: "destructive",
      });
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Vextorn — Talk. Share. Belong.",
          text: shareText,
          url: shareUrl,
        });
        setShareOpen(false);
        return true;
      } catch (_) {
        return false;
      }
    }
    return false;
  };

  const year = new Date().getFullYear();

  return (
    <footer className="footer-neu" data-testid="site-footer">
      {/* ── Main row ─────────────────────────────────────── */}
      <div className="footer-neu-inner">
        {/* Left: brand + standalone Contact CTA (intentionally separated
            from the social handles on the right so users never confuse
            "talk to the team" with "follow us on X / Instagram"). */}
        <div className="footer-brand-block">
          <div className="footer-brand">
            <VextornMark size={26} />
            <div className="footer-brand-text">
              <span className="footer-brand-name" data-testid="text-footer-brand">
                Vextorn
              </span>
              <span className="footer-brand-tag">Talk. Share. Belong.</span>
            </div>
          </div>
          <p className="footer-desc">
            Free live voice rooms for language exchange, speaking practice, and meeting people worldwide.
          </p>
          <a
            href="mailto:hello@vextorn.app"
            className="footer-contact-cta"
            data-testid="link-footer-contact"
            title="Email the Vextorn team"
          >
            <span className="footer-contact-icon">
              <Mail className="w-3.5 h-3.5" />
            </span>
            <span className="footer-contact-text">
              <span className="footer-contact-label">Contact us</span>
              <span className="footer-contact-mail">hello@vextorn.app</span>
            </span>
          </a>
        </div>

        {/* Center: nav pill — policies + share (Contact lives on the
            brand block above and is intentionally NOT in this group). */}
        <nav className="footer-links" aria-label="Footer navigation">
          <a href="/about" className="footer-link" data-testid="link-footer-about">About</a>
          <a href="/faq" className="footer-link" data-testid="link-footer-faq">FAQ</a>
          <a href="/language-exchange" className="footer-link" data-testid="link-footer-language-exchange">Language exchange</a>
          <a href="/contact" className="footer-link" data-testid="link-footer-contact-page">Contact</a>
          <a href="/privacy" className="footer-link" data-testid="link-footer-privacy">
            <Shield className="w-3.5 h-3.5" />
            <span>Privacy</span>
          </a>
          <a href="/terms" className="footer-link" data-testid="link-footer-terms">
            <FileText className="w-3.5 h-3.5" />
            <span>Terms</span>
          </a>

          {/* Share with destination popover */}
          <Popover open={shareOpen} onOpenChange={setShareOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="footer-link footer-link-btn"
                data-testid="button-footer-share"
                onClick={async (e) => {
                  // On mobile devices that support native share, prefer that.
                  const used = await handleNativeShare();
                  if (used) {
                    e.preventDefault();
                  }
                }}
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="center"
              sideOffset={10}
              className="footer-share-popover"
              data-testid="popover-footer-share"
            >
              <div className="footer-share-title">Share Vextorn</div>
              <div className="footer-share-grid">
                {SHARE_DESTINATIONS.map(({ name, Icon, build, hue }) => (
                  <a
                    key={name}
                    href={build(shareUrl, shareText)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-share-item"
                    style={{ ["--social-hue" as any]: hue }}
                    data-testid={`link-share-${name.toLowerCase()}`}
                    onClick={() => setShareOpen(false)}
                  >
                    <span className="footer-share-icon">
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="footer-share-label">{name}</span>
                  </a>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    handleCopy();
                    setShareOpen(false);
                  }}
                  className="footer-share-item"
                  style={{ ["--social-hue" as any]: "258 70% 65%" }}
                  data-testid="button-share-copy"
                >
                  <span className="footer-share-icon">
                    {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                  </span>
                  <span className="footer-share-label">{copied ? "Copied!" : "Copy link"}</span>
                </button>
              </div>
              <div className="footer-share-url">
                <Send className="w-3 h-3 opacity-60" />
                <span className="truncate">{shareUrl.replace(/^https?:\/\//, "")}</span>
              </div>
            </PopoverContent>
          </Popover>
        </nav>

        {/* Right: social handles (follow / community), with a small
            "Follow us" caption so users immediately see this is the
            social block — not a "contact support" block. */}
        <div className="footer-socials-block">
          <span className="footer-socials-caption" aria-hidden="true">
            Follow us
          </span>
          <div className="footer-socials" data-testid="footer-socials">
            {SOCIALS.map(({ name, href, Icon, hoverHue }) => (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={name}
                title={name}
                className="footer-social"
                style={{ ["--social-hue" as any]: hoverHue }}
                data-testid={`link-social-${name.toLowerCase().split(" ")[0]}`}
              >
                <Icon className="w-3.5 h-3.5" />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom bar ───────────────────────────────────── */}
      <div className="footer-bottom-bar">
        <span className="footer-copy" data-testid="text-footer-copyright">
          © {year} Vextorn. All rights reserved.
        </span>
        <span className="footer-bottom-divider" aria-hidden="true" />
        <span className="footer-made-with">
          Made with <span className="footer-heart">♥</span> for language learners
        </span>
      </div>
    </footer>
  );
}
