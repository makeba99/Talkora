import { Link } from "wouter";
import { SeoPageShell, SeoSection, SeoCta } from "@/components/seo-page-shell";

export default function MeetPeoplePage() {
  return (
    <SeoPageShell
      path="/meet-people-online"
      title="Meet people online & make international friends"
      description="Meet people from other countries in live voice rooms. A safer, language-focused alternative to random chat."
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Meet people online" },
      ]}
    >
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Meet people online through conversation
      </h1>
      <p className="mt-3 text-lg text-muted-foreground leading-relaxed">
        Make international friends in live voice rooms built around language, topics, and respect —
        not endless random matching.
      </p>

      <SeoSection title="A different kind of “talk to strangers”">
        <p>
          Random chat can feel chaotic. Vextorn organizes rooms by language and level, gives hosts
          moderation tools, and centers shared goals like practice and connection. You still meet new
          people — with more context.
        </p>
      </SeoSection>

      <SeoSection title="Safety basics">
        <ul className="list-disc pl-5 space-y-2">
          <li>Do not share personal addresses, financial details, or private photos.</li>
          <li>Use host tools and report abuse when needed.</li>
          <li>Leave any room that feels wrong — you can always join another.</li>
        </ul>
      </SeoSection>

      <SeoSection title="Compare options">
        <p>
          <Link href="/alternatives/omegle">Omegle alternatives</Link>
          {" · "}
          <Link href="/language-exchange">Language exchange</Link>
          {" · "}
          <Link href="/faq">FAQ</Link>
        </p>
      </SeoSection>

      <SeoCta />
    </SeoPageShell>
  );
}
