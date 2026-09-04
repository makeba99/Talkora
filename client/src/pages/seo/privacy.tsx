import { SeoPageShell, SeoSection } from "@/components/seo-page-shell";
import { SUPPORT_EMAIL } from "@shared/seo-pages";

export default function PrivacyPage() {
  return (
    <SeoPageShell
      path="/privacy"
      title="Privacy Policy"
      description="How Vextorn handles account data, messages, cookies, and retention. We do not sell your data or record voice rooms."
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Privacy" },
      ]}
    >
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Privacy Policy</h1>
      <p className="mt-3 text-muted-foreground">How Vextorn handles your data — short and human.</p>

      <SeoSection title="What we collect">
        <p>
          Just what is needed to run voice rooms: your account profile (name, avatar, language
          preferences), the rooms you create or join, and chat messages you send inside rooms. No IP
          addresses are stored. No third-party ad trackers.
        </p>
      </SeoSection>

      <SeoSection title="What we never do">
        <ul className="list-disc pl-5 space-y-1">
          <li>We do not sell your data — ever.</li>
          <li>We do not show ads on Vextorn.</li>
          <li>We do not record voice rooms.</li>
          <li>We do not share your messages with anyone outside Vextorn.</li>
        </ul>
      </SeoSection>

      <SeoSection title="Retention">
        <p>
          Direct messages are kept 7 days, room messages 7 days, notifications 14 days, and abuse
          reports 30 days. You can delete your account at any time from your profile, which removes
          associated data.
        </p>
      </SeoSection>

      <SeoSection title="Cookies">
        <p>We use a session cookie to keep you signed in. That is it.</p>
      </SeoSection>

      <SeoSection title="Contact">
        <p>
          Privacy questions? Email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </SeoSection>
    </SeoPageShell>
  );
}
