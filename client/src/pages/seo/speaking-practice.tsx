import { Link } from "wouter";
import { SeoPageShell, SeoSection, SeoCta } from "@/components/seo-page-shell";

export default function SpeakingPracticePage() {
  return (
    <SeoPageShell
      path="/speaking-practice"
      title="Online speaking practice"
      description="Build speaking confidence in live voice rooms. Practice conversation with people worldwide — free on Vextorn."
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Speaking practice" },
      ]}
    >
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Online speaking practice that feels real
      </h1>
      <p className="mt-3 text-lg text-muted-foreground leading-relaxed">
        Fluency grows when you speak. Vextorn gives you live rooms for conversation practice —
        structured enough to feel safe, open enough to feel human.
      </p>

      <SeoSection title="Why speaking practice stalls">
        <p>
          Apps can teach vocabulary, but confidence needs turn-taking, listening under pressure, and
          friendly mistakes. Live rooms recreate that environment without needing a classroom.
        </p>
      </SeoSection>

      <SeoSection title="A simple weekly routine">
        <ul className="list-disc pl-5 space-y-2">
          <li>Two short sessions (20–30 minutes) in a beginner or intermediate room.</li>
          <li>One topic you prepare in advance (hobby, travel story, job interview Q&amp;A).</li>
          <li>Optional AI tutor questions after the room for corrections.</li>
        </ul>
      </SeoSection>

      <SeoSection title="Next steps">
        <p>
          <Link href="/language-exchange">Language exchange overview</Link>
          {" · "}
          <Link href="/language-exchange/english">English rooms</Link>
          {" · "}
          <Link href="/teachers">1-on-1 teachers</Link>
        </p>
      </SeoSection>

      <SeoCta />
    </SeoPageShell>
  );
}
