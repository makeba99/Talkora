import { Link } from "wouter";
import { SeoPageShell, SeoSection, SeoCta } from "@/components/seo-page-shell";

export default function LanguageExchangePage() {
  return (
    <SeoPageShell
      path="/language-exchange"
      title="Language exchange with real people"
      description="Practice languages through live conversation on Vextorn. Join voice rooms by language and level for free language exchange."
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Language exchange" },
      ]}
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "Language exchange with real people",
        url: "https://vextorn.com/language-exchange",
        about: "Language exchange and conversation practice in live voice rooms",
      }}
    >
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Language exchange through live conversation
      </h1>
      <p className="mt-3 text-lg text-muted-foreground leading-relaxed">
        Find conversation partners in free voice rooms. Practice your target language with people who
        actually want to talk — not a scripted lesson alone.
      </p>

      <SeoSection title="What language exchange looks like on Vextorn">
        <p>
          Pick a room for the language you want to practice, join when you are ready, and take turns
          speaking. Many rooms mix learners and stronger speakers. Levels (beginner, intermediate,
          advanced) help you find a comfortable pace.
        </p>
      </SeoSection>

      <SeoSection title="Tips for better practice">
        <ul className="list-disc pl-5 space-y-2">
          <li>Start muted if you are nervous — listen first, then join.</li>
          <li>Say your goal early (“I want to practice ordering food in English”).</li>
          <li>Switch languages politely when helping someone practice yours.</li>
          <li>Use the in-room AI tutor for quick corrections without stopping the room.</li>
        </ul>
      </SeoSection>

      <SeoSection title="Popular starting points">
        <p>
          <Link href="/language-exchange/english">English language exchange</Link>
          {" · "}
          <Link href="/speaking-practice">Speaking practice guide</Link>
          {" · "}
          <Link href="/teachers">Book a teacher</Link>
          {" · "}
          <Link href="/">Browse live rooms</Link>
        </p>
      </SeoSection>

      <SeoCta />
    </SeoPageShell>
  );
}
