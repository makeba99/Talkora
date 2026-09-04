import { Link } from "wouter";
import { SeoPageShell, SeoSection, SeoCta } from "@/components/seo-page-shell";

export default function OmegleAlternativesPage() {
  return (
    <SeoPageShell
      path="/alternatives/omegle"
      title="Omegle alternatives for meeting people & language practice"
      description="Looking for Omegle alternatives? Compare Vextorn’s language-focused voice rooms with random video chat — no affiliation with Omegle."
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Alternatives", href: "/meet-people-online" },
        { label: "Omegle" },
      ]}
    >
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Omegle alternatives for conversation and language practice
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Independent overview. Vextorn is not affiliated with, endorsed by, or related to Omegle.
      </p>
      <p className="mt-3 text-lg text-muted-foreground leading-relaxed">
        People searching for Omegle alternatives often want to meet new people online with less chaos.
        Vextorn is a language- and community-oriented option built around live voice rooms.
      </p>

      <SeoSection title="What Omegle-style random chat optimized for">
        <p>
          Classic random chat matched strangers quickly for novelty. That can be fun, but it often
          lacks shared goals, moderation context, and language-learning structure.
        </p>
      </SeoSection>

      <SeoSection title="What Vextorn optimizes for">
        <ul className="list-disc pl-5 space-y-2">
          <li>Rooms labeled by language and speaking level</li>
          <li>Group conversation instead of only 1:1 random pairings</li>
          <li>Host tools (mute, temporary ice, permanent kick)</li>
          <li>Optional AI tutor and teacher bookings for practice</li>
        </ul>
      </SeoSection>

      <SeoSection title="Who should choose which">
        <p>
          Choose random video chat if you want pure novelty matching. Choose Vextorn if you want to
          practice speaking, meet international people around a shared language goal, or hang out in
          moderated rooms. Also see{" "}
          <Link href="/alternatives/free4talk">Free4Talk alternatives</Link> and{" "}
          <Link href="/meet-people-online">meet people online</Link>.
        </p>
      </SeoSection>

      <SeoCta />
    </SeoPageShell>
  );
}
