import { useState } from "react";
import { Mail, Share2, Heart, Check } from "lucide-react";
import { SiX, SiInstagram, SiFacebook, SiTiktok } from "react-icons/si";
import { VextornMark } from "@/components/vextorn-logo";
import { useToast } from "@/hooks/use-toast";

type SocialLink = {
  name: string;
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
  hoverHue: string;
};

const SOCIALS: SocialLink[] = [
  { name: "X (Twitter)", href: "https://twitter.com/vextorn",  Icon: SiX,         hoverHue: "210 80% 60%" },
  { name: "Instagram",    href: "https://instagram.com/vextorn", Icon: SiInstagram, hoverHue: "330 75% 60%" },
  { name: "Facebook",     href: "https://facebook.com/vextorn",  Icon: SiFacebook,  hoverHue: "220 90% 60%" },
  { name: "TikTok",       href: "https://tiktok.com/@vextorn",   Icon: SiTiktok,    hoverHue: "180 80% 55%" },
];

export function SiteFooter() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.origin : "https://vextorn.app";
    const shareData = {
      title: "Vextorn — Talk. Share. Belong.",
      text: "Join Vextorn to practice languages with real people in voice rooms.",
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
    } catch (_) { /* user cancelled */ }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: "Link copied", description: "Vextorn link copied to your clipboard." });
      setTimeout(() => setCopied(false), 2200);
    } catch (_) {
      toast({ title: "Couldn't copy", description: "Please copy the URL from your browser bar.", variant: "destructive" });
    }
  };

  const year = new Date().getFullYear();

  return (
    <footer className="footer-neu" data-testid="site-footer">
      <div className="footer-neu-inner">
        {/* ─── Left: brand + copyright ─── */}
        <div className="footer-brand-block">
          <div className="footer-brand">
            <VextornMark size={26} />
            <div className="footer-brand-text">
              <span className="footer-brand-name" data-testid="text-footer-brand">Vextorn</span>
              <span className="footer-brand-tag">Talk. Share. Belong.</span>
            </div>
          </div>
          <p className="footer-copy" data-testid="text-footer-copyright">
            © {year} Vextorn. All rights reserved.
          </p>
        </div>

        {/* ─── Center: quick links ─── */}
        <nav className="footer-links" aria-label="Footer">
          <a
            href="mailto:hello@vextorn.app"
            className="footer-link"
            data-testid="link-footer-contact"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Contact Us</span>
          </a>
          <button
            type="button"
            onClick={handleShare}
            className="footer-link footer-link-btn"
            data-testid="button-footer-share"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied" : "Share"}</span>
          </button>
          <a
            href="/teachers"
            className="footer-link"
            data-testid="link-footer-teachers"
          >
            <Heart className="w-3.5 h-3.5" />
            <span>Book a Teacher</span>
          </a>
        </nav>

        {/* ─── Right: social icons ─── */}
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
    </footer>
  );
}
