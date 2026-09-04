import { Link } from "wouter";
import { SeoPageShell, SeoSection, SeoCta } from "@/components/seo-page-shell";
import { SUPPORT_EMAIL } from "@shared/seo-pages";

export default function AboutPage() {
  return (
    <SeoPageShell
      path="/about"
      title="About Vextorn — voice rooms for language practice"
      description="Learn what Vextorn is: a free, real-time voice community for language exchange, conversation practice, and meeting people from around the world."
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "About" },
      ]}
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "AboutPage",
        name: "About Vextorn",
        url: "https://vextorn.com/about",
        description:
          "Vextorn is a real-time voice community for language exchange and conversation practice.",
        isPartOf: { "@id": "https://vextorn.com/#website" },
        about: { "@id": "https://vextorn.com/#organization" },
      }}
    >
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">About Vextorn</h1>
      <p className="mt-3 text-lg text-muted-foreground leading-relaxed">
        Vextorn is a free, browser-based community where people join live voice rooms to practice
        languages, have real conversations, and meet people from other countries.
      </p>

      <SeoSection title="What is Vextorn?">
        <p>
          Vextorn is a <strong>voice-first social platform for language learning and connection</strong>.
          Instead of flashcards alone, you enter a live room organized by language and skill level,
          then talk with real people in real time.
        </p>
      </SeoSection>

      <SeoSection title="Who it is for">
        <p>
          Learners who want speaking practice, people looking for language exchange partners,
          travelers preparing for trips, and anyone who wants to make international friends through
          conversation — not endless scrolling.
        </p>
      </SeoSection>

      <SeoSection title="How it works">
        <ol className="list-decimal pl-5 space-y-2">
          <li>Open the lobby and filter rooms by language or level.</li>
          <li>Enter a public room to listen, or sign in to speak and chat.</li>
          <li>Use room tools like text chat, moods, watch-together, and an optional AI tutor.</li>
          <li>Follow people you enjoy talking with, or book a teacher for 1-on-1 practice.</li>
        </ol>
      </SeoSection>

      <SeoSection title="Why people choose Vextorn">
        <ul className="list-disc pl-5 space-y-2">
          <li>Live group conversation instead of only text messaging.</li>
          <li>Rooms tagged by language and level so beginners are not thrown into advanced debates.</li>
          <li>Free to join in the browser — no app install required to try a room.</li>
          <li>Community moderation tools for hosts (mute, temporary ice, permanent kick).</li>
        </ul>
      </SeoSection>

      <SeoSection title="Learn more">
        <p>
          Read the <Link href="/faq">FAQ</Link>, explore{" "}
          <Link href="/language-exchange">language exchange</Link>, or{" "}
          <Link href="/contact">contact us</Link> at{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </SeoSection>

      <SeoCta />
    </SeoPageShell>
  );
}
