import { Link } from "wouter";
import { SeoPageShell, SeoSection, SeoCta } from "@/components/seo-page-shell";

export default function HelloTalkAlternativesPage() {
  return (
    <SeoPageShell
      path="/alternatives/hellotalk"
      title="HelloTalk alternatives for speaking practice"
      description="HelloTalk alternatives focused on live group conversation. Learn how Vextorn voice rooms fit language exchange — no affiliation."
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Alternatives", href: "/language-exchange" },
        { label: "HelloTalk" },
      ]}
    >
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        HelloTalk alternatives for live speaking practice
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Independent overview. Vextorn is not affiliated with or endorsed by HelloTalk.
      </p>
      <p className="mt-3 text-lg text-muted-foreground leading-relaxed">
        HelloTalk is known for 1:1 language exchange messaging and corrections. Some learners also
        want live group voice rooms — that is where Vextorn focuses.
      </p>

      <SeoSection title="Text exchange vs live rooms">
        <p>
          Messaging apps are excellent for asynchronous corrections and pen-pal style exchange. Voice
          rooms help with pronunciation, listening speed, and turn-taking in real time. Many people
          use both styles.
        </p>
      </SeoSection>

      <SeoSection title="When Vextorn is a strong fit">
        <ul className="list-disc pl-5 space-y-2">
          <li>You want group conversation, not only DMs</li>
          <li>You prefer jumping into a live room without scheduling a partner</li>
          <li>You like language/level filters and host moderation</li>
        </ul>
      </SeoSection>

      <SeoSection title="Related">
        <p>
          <Link href="/speaking-practice">Speaking practice</Link>
          {" · "}
          <Link href="/alternatives/free4talk">Free4Talk alternatives</Link>
          {" · "}
          <Link href="/faq">FAQ</Link>
        </p>
      </SeoSection>

      <SeoCta />
    </SeoPageShell>
  );
}
