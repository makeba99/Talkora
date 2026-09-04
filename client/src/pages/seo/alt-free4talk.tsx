import { Link } from "wouter";
import { SeoPageShell, SeoSection, SeoCta } from "@/components/seo-page-shell";

export default function Free4TalkAlternativesPage() {
  return (
    <SeoPageShell
      path="/alternatives/free4talk"
      title="Free4Talk alternatives for language practice"
      description="Explore Free4Talk alternatives for speaking practice. See how Vextorn’s live voice rooms compare — independent overview, no affiliation."
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Alternatives", href: "/language-exchange" },
        { label: "Free4Talk" },
      ]}
    >
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Free4Talk alternatives for speaking practice
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Independent overview. Vextorn is not affiliated with or endorsed by Free4Talk.
      </p>
      <p className="mt-3 text-lg text-muted-foreground leading-relaxed">
        Free4Talk popularized browser-based language rooms. If you are comparing options, focus on
        room quality, moderation, mobile experience, and the features you actually use.
      </p>

      <SeoSection title="Where Vextorn may fit">
        <ul className="list-disc pl-5 space-y-2">
          <li>Live voice rooms with language and level tags</li>
          <li>In-room text chat, moods, and social features</li>
          <li>AI tutor inside rooms for corrections</li>
          <li>Optional 1-on-1 teachers for structured practice</li>
        </ul>
      </SeoSection>

      <SeoSection title="How to decide">
        <p>
          Stay where your favorite rooms and friends already are. Try Vextorn if you want another
          community for speaking practice or{" "}
          <Link href="/language-exchange">language exchange</Link>. Also compare{" "}
          <Link href="/alternatives/hellotalk">HelloTalk alternatives</Link>.
        </p>
      </SeoSection>

      <SeoCta />
    </SeoPageShell>
  );
}
