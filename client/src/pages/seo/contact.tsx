import { SeoPageShell, SeoSection, SeoCta } from "@/components/seo-page-shell";
import { SUPPORT_EMAIL } from "@shared/seo-pages";

export default function ContactPage() {
  return (
    <SeoPageShell
      path="/contact"
      title="Contact Vextorn"
      description="Contact the Vextorn team for support, partnerships, or press. Email hello@vextorn.app."
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Contact" },
      ]}
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "ContactPage",
        name: "Contact Vextorn",
        url: "https://vextorn.com/contact",
        mainEntity: {
          "@type": "Organization",
          name: "Vextorn",
          email: SUPPORT_EMAIL,
          url: "https://vextorn.com/",
        },
      }}
    >
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Contact</h1>
      <p className="mt-3 text-lg text-muted-foreground leading-relaxed">
        Questions about Vextorn, account help, partnerships, or press — we read every message.
      </p>

      <SeoSection title="Email">
        <p>
          Write to{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-foreground">
            {SUPPORT_EMAIL}
          </a>
          . Please include your username and a short description of the issue so we can help faster.
        </p>
      </SeoSection>

      <SeoSection title="What we can help with">
        <ul className="list-disc pl-5 space-y-2">
          <li>Account access and safety reports</li>
          <li>Teacher booking or payment questions</li>
          <li>Product feedback and feature ideas</li>
          <li>Press or partnership inquiries</li>
        </ul>
      </SeoSection>

      <SeoSection title="Before you write">
        <p>
          Many common questions are answered on the{" "}
          <a href="/faq">FAQ</a> and <a href="/about">About</a> pages. For live conversation, open the{" "}
          <a href="/">lobby</a> anytime.
        </p>
      </SeoSection>

      <SeoCta />
    </SeoPageShell>
  );
}
