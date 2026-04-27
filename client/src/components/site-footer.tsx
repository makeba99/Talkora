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
  SiDiscord,
  SiWhatsapp,
  SiTelegram,
} from "react-icons/si";
import { VextornMark } from "@/components/vextorn-logo";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  { name: "X (Twitter)", href: "https://twitter.com/vextorn",   Icon: SiX,         hoverHue: "210 80% 60%" },
  { name: "Instagram",   href: "https://instagram.com/vextorn", Icon: SiInstagram, hoverHue: "330 75% 60%" },
  { name: "Facebook",    href: "https://facebook.com/vextorn",  Icon: SiFacebook,  hoverHue: "220 80% 58%" },
  { name: "TikTok",      href: "https://tiktok.com/@vextorn",   Icon: SiTiktok,    hoverHue: "180 80% 55%" },
  { name: "Discord",     href: "https://discord.gg/vextorn",    Icon: SiDiscord,   hoverHue: "248 80% 65%" },
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
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  const shareUrl = typeof window !== "undefined" ? window.location.origin : "https://vextorn.app";
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
        {/* Left: brand */}
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
            Real-time voice rooms for language learners worldwide.
          </p>
        </div>

        {/* Center: nav pill — Contact, Privacy, Terms */}
        <nav className="footer-links" aria-label="Footer navigation">
          <a
            href="mailto:hello@vextorn.app"
            className="footer-link"
            data-testid="link-footer-contact"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Contact</span>
          </a>

          <button
            type="button"
            onClick={() => setPrivacyOpen(true)}
            className="footer-link footer-link-btn"
            data-testid="button-footer-privacy"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Privacy</span>
          </button>

          <button
            type="button"
            onClick={() => setTermsOpen(true)}
            className="footer-link footer-link-btn"
            data-testid="button-footer-terms"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Terms</span>
          </button>

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

        {/* Right: socials */}
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

      {/* ── Privacy Dialog ──────────────────────────────── */}
      <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
        <DialogContent className="footer-policy-dialog" data-testid="dialog-privacy">
          <DialogHeader>
            <div className="footer-policy-icon">
              <Shield className="w-5 h-5" />
            </div>
            <DialogTitle className="footer-policy-title">Privacy Policy</DialogTitle>
            <DialogDescription className="footer-policy-sub">
              How Vextorn handles your data — short and human.
            </DialogDescription>
          </DialogHeader>

          <div className="footer-policy-body">
            <section>
              <h4>What we collect</h4>
              <p>
                Just what's needed to run voice rooms: your account profile (name, avatar,
                language preferences), the rooms you create or join, and chat messages you
                send inside rooms. No IP addresses are stored. No third-party trackers.
              </p>
            </section>
            <section>
              <h4>What we never do</h4>
              <ul>
                <li>We don't sell your data — ever.</li>
                <li>We don't show ads on Vextorn.</li>
                <li>We don't record voice rooms.</li>
                <li>We don't share your messages with anyone outside Vextorn.</li>
              </ul>
            </section>
            <section>
              <h4>Retention</h4>
              <p>
                Direct messages are kept 7 days, room messages 7 days, notifications 14
                days, and abuse reports 30 days. You can delete your account at any time
                from your profile, which removes all associated data.
              </p>
            </section>
            <section>
              <h4>Cookies</h4>
              <p>
                We use a single session cookie to keep you signed in. That's it.
              </p>
            </section>
            <section>
              <h4>Contact</h4>
              <p>
                Questions about privacy? Reach us at{" "}
                <a href="mailto:hello@vextorn.app" className="footer-policy-link">
                  hello@vextorn.app
                </a>.
              </p>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Terms Dialog ────────────────────────────────── */}
      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="footer-policy-dialog" data-testid="dialog-terms">
          <DialogHeader>
            <div className="footer-policy-icon">
              <FileText className="w-5 h-5" />
            </div>
            <DialogTitle className="footer-policy-title">Terms of Service</DialogTitle>
            <DialogDescription className="footer-policy-sub">
              The basic ground rules for using Vextorn.
            </DialogDescription>
          </DialogHeader>

          <div className="footer-policy-body">
            <section>
              <h4>Be kind</h4>
              <p>
                Vextorn is a community for language learners. Harassment, hate speech,
                threats, sexual content involving minors, and spam are not tolerated and
                will result in account termination.
              </p>
            </section>
            <section>
              <h4>Your account</h4>
              <p>
                You're responsible for your account and the content you share. Don't
                impersonate others, and don't share your login. Accounts must be 13+ to
                use Vextorn.
              </p>
            </section>
            <section>
              <h4>Voice rooms</h4>
              <p>
                Conversations are live and not recorded by Vextorn. Treat other
                participants with respect. Hosts can mute, kick, or ban from their own
                rooms. Repeated violations across rooms can lead to a platform-wide
                restriction.
              </p>
            </section>
            <section>
              <h4>Service</h4>
              <p>
                Vextorn is provided "as is". We do our best to keep the service running
                reliably, but we don't guarantee uninterrupted availability. Major changes
                to these terms will be announced in-app.
              </p>
            </section>
            <section>
              <h4>Termination</h4>
              <p>
                You can delete your account at any time. We may suspend or terminate
                accounts that violate these terms or harm the community.
              </p>
            </section>
            <section>
              <h4>Contact</h4>
              <p>
                Questions about these terms? Reach us at{" "}
                <a href="mailto:hello@vextorn.app" className="footer-policy-link">
                  hello@vextorn.app
                </a>.
              </p>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </footer>
  );
}
