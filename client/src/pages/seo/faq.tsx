import { Link } from "wouter";
import { SeoPageShell, SeoSection, SeoCta } from "@/components/seo-page-shell";
import { SUPPORT_EMAIL } from "@shared/seo-pages";

const FAQS: { q: string; a: string }[] = [
  {
    q: "What is Vextorn?",
    a: "Vextorn is a real-time, voice-first community where people join live audio rooms by language and skill level to practice speaking, share ideas, and connect worldwide. It is free to join and works in your browser.",
  },
  {
    q: "How does Vextorn work?",
    a: "Browse the lobby, pick a room for your language and level, then enter. You can listen as a guest or sign in to speak, send chat messages, follow friends, and use room features like an AI tutor.",
  },
  {
    q: "Who is Vextorn for?",
    a: "Anyone who wants conversation practice, language exchange, speaking confidence, or meeting people from other countries — beginners through advanced speakers.",
  },
  {
    q: "How is Vextorn different from traditional language-learning apps?",
    a: "Many apps focus on drills and lessons. Vextorn focuses on live conversation with real people in shared voice rooms, with optional teachers and an AI tutor when you want structured help.",
  },
  {
    q: "How can I practice speaking with real people?",
    a: "Open vextorn.com, choose a language room that matches your level, unmute when you are ready, and join the conversation. Start by listening if that feels easier.",
  },
  {
    q: "Can I meet people from other countries?",
    a: "Yes. Rooms are global. People join from many countries to practice languages and make friends through conversation.",
  },
  {
    q: "Is Vextorn free?",
    a: "Yes. Joining rooms and using core community features is free. Optional teacher bookings and supporter perks are available separately.",
  },
  {
    q: "Is Vextorn an alternative to random chat platforms?",
    a: "Vextorn can suit people looking for safer, purpose-driven conversation than classic random stranger video chat. Rooms are organized by language and level, and hosts have moderation tools. Vextorn is not affiliated with Omegle or similar products.",
  },
  {
    q: "Is Vextorn useful for language exchange?",
    a: "Yes. Many users join to practice a target language with others who want to speak. You can also explore dedicated language-exchange pages and English speaking rooms.",
  },
  {
    q: "What languages are available?",
    a: "Community rooms cover many languages, including English, Spanish, French, Japanese, Korean, German, Portuguese, Arabic, Armenian, Mandarin, Italian, Hindi, and more. Availability depends on who is online.",
  },
  {
    q: "Does Vextorn have an AI language tutor?",
    a: "Yes. An AI tutor is available inside voice rooms to practice, get corrections, and ask grammar questions while you talk with people.",
  },
  {
    q: "How do I contact support?",
    a: `Email ${SUPPORT_EMAIL}. For product questions, see About and this FAQ first.`,
  },
];

export default function FaqPage() {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <SeoPageShell
      path="/faq"
      title="FAQ — language exchange & voice rooms"
      description="Answers about Vextorn: how voice rooms work, languages, safety, free access, AI tutor, teachers, and how it differs from random chat apps."
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "FAQ" },
      ]}
      jsonLd={faqLd}
    >
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Frequently asked questions</h1>
      <p className="mt-3 text-lg text-muted-foreground leading-relaxed">
        Straight answers about Vextorn for learners, conversation seekers, and anyone comparing
        language exchange or random-chat alternatives.
      </p>

      <div className="mt-8 space-y-6">
        {FAQS.map((f) => (
          <section key={f.q} className="border-b border-border/50 pb-5">
            <h2 className="text-lg font-semibold text-foreground">{f.q}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{f.a}</p>
          </section>
        ))}
      </div>

      <SeoSection title="Related guides">
        <p>
          <Link href="/language-exchange">Language exchange</Link>
          {" · "}
          <Link href="/speaking-practice">Speaking practice</Link>
          {" · "}
          <Link href="/meet-people-online">Meet people online</Link>
          {" · "}
          <Link href="/alternatives/omegle">Omegle alternatives</Link>
        </p>
      </SeoSection>

      <SeoCta />
    </SeoPageShell>
  );
}
