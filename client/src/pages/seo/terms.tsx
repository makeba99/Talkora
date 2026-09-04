import { SeoPageShell, SeoSection } from "@/components/seo-page-shell";
import { SUPPORT_EMAIL } from "@shared/seo-pages";

export default function TermsPage() {
  return (
    <SeoPageShell
      path="/terms"
      title="Terms of Service"
      description="Community rules for using Vextorn voice rooms, accounts, and language practice features. Ages 13+."
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Terms" },
      ]}
    >
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Terms of Service</h1>
      <p className="mt-3 text-muted-foreground">The basic ground rules for using Vextorn.</p>

      <SeoSection title="Be kind">
        <p>
          Vextorn is a community for language learners. Harassment, hate speech, threats, sexual
          content involving minors, and spam are not tolerated and may result in account termination.
        </p>
      </SeoSection>

      <SeoSection title="Your account">
        <p>
          You are responsible for your account and the content you share. Do not impersonate others,
          and do not share your login. Accounts must be 13+ to use Vextorn.
        </p>
      </SeoSection>

      <SeoSection title="Voice rooms">
        <p>
          Conversations are live and not recorded by Vextorn. Treat other participants with respect.
          Hosts can mute, temporarily ice, or permanently kick users from their rooms. Repeated
          violations across rooms can lead to a platform-wide restriction.
        </p>
      </SeoSection>

      <SeoSection title="Service">
        <p>
          Vextorn is provided “as is”. We work to keep the service reliable, but we do not guarantee
          uninterrupted availability. Major changes to these terms will be announced in-app.
        </p>
      </SeoSection>

      <SeoSection title="Termination">
        <p>
          You can delete your account at any time. We may suspend or terminate accounts that violate
          these terms or harm the community.
        </p>
      </SeoSection>

      <SeoSection title="Contact">
        <p>
          Questions about these terms? Email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </SeoSection>
    </SeoPageShell>
  );
}
