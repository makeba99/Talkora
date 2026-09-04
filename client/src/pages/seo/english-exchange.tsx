import { Link } from "wouter";
import { SeoPageShell, SeoSection, SeoCta } from "@/components/seo-page-shell";

export default function EnglishExchangePage() {
  return (
    <SeoPageShell
      path="/language-exchange/english"
      title="English language exchange & speaking practice"
      description="Practice English speaking with real people in live Vextorn voice rooms — beginner to advanced conversation partners."
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Language exchange", href: "/language-exchange" },
        { label: "English" },
      ]}
    >
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        English speaking practice with real people
      </h1>
      <p className="mt-3 text-lg text-muted-foreground leading-relaxed">
        Join English voice rooms on Vextorn to practice conversation, build fluency, and meet
        speakers and learners from around the world.
      </p>

      <SeoSection title="Who English rooms help">
        <p>
          Beginners practicing simple introductions, intermediate learners who need daily speaking
          time, and advanced speakers who want natural conversation topics — news, travel, work, or
          hobbies.
        </p>
      </SeoSection>

      <SeoSection title="How to start">
        <ol className="list-decimal pl-5 space-y-2">
          <li>Open the lobby and filter for English rooms.</li>
          <li>Choose a level that matches how comfortable you feel speaking aloud.</li>
          <li>Enter, greet the room, and ask for a slow turn if you need it.</li>
        </ol>
      </SeoSection>

      <SeoSection title="Related">
        <p>
          <Link href="/language-exchange">All language exchange</Link>
          {" · "}
          <Link href="/speaking-practice">Speaking practice</Link>
          {" · "}
          <Link href="/faq">FAQ</Link>
        </p>
      </SeoSection>

      <SeoCta />
    </SeoPageShell>
  );
}
