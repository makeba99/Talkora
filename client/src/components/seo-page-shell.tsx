import { Link } from "wouter";
import { lazy, Suspense, type ReactNode } from "react";
import { ArrowLeft, Home } from "lucide-react";
import { VextornMark } from "@/components/vextorn-logo";
import { useDocumentMeta } from "@/hooks/use-document-meta";
import { SITE_ORIGIN } from "@shared/seo-pages";

const SiteFooter = lazy(() =>
  import("@/components/site-footer").then((m) => ({ default: m.SiteFooter }))
);

type Crumb = { label: string; href?: string };

type SeoPageShellProps = {
  title: string;
  description: string;
  path: string;
  breadcrumbs: Crumb[];
  children: ReactNode;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  const payload = Array.isArray(data) ? data : [data];
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(
          payload.length === 1 ? payload[0] : { "@context": "https://schema.org", "@graph": payload }
        ).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export function SeoPageShell({
  title,
  description,
  path,
  breadcrumbs,
  children,
  jsonLd,
}: SeoPageShellProps) {
  const canonical = `${SITE_ORIGIN}${path}`;
  useDocumentMeta({
    title,
    description,
    canonical,
    ogTitle: title.includes("Vextorn") ? title : `${title} | Vextorn`,
    ogDescription: description,
  });

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbs.map((b, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: b.label,
      item: b.href ? `${SITE_ORIGIN}${b.href}` : canonical,
    })),
  };

  return (
    <div className="h-full overflow-y-auto bg-background text-foreground" data-testid="seo-page">
      <JsonLd data={jsonLd ? [breadcrumbLd, ...(Array.isArray(jsonLd) ? jsonLd : [jsonLd])] : breadcrumbLd} />
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90" data-testid="link-seo-home">
            <VextornMark size={28} />
            <span className="font-semibold tracking-tight">Vextorn</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm text-muted-foreground">
            <Link href="/language-exchange" className="hover:text-foreground">Language exchange</Link>
            <Link href="/faq" className="hover:text-foreground hidden sm:inline">FAQ</Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-foreground hover:bg-muted/50"
            >
              <Home className="h-3.5 w-3.5" /> Lobby
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
        <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {breadcrumbs.map((b, i) => (
            <span key={`${b.label}-${i}`} className="inline-flex items-center gap-1.5">
              {i > 0 && <span aria-hidden>/</span>}
              {b.href ? (
                <Link href={b.href} className="hover:text-foreground">{b.label}</Link>
              ) : (
                <span className="text-foreground/80">{b.label}</span>
              )}
            </span>
          ))}
        </nav>
        {children}
        <div className="mt-10">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to live rooms
          </Link>
        </div>
      </main>

      <Suspense fallback={null}>
        <SiteFooter />
      </Suspense>
    </div>
  );
}

export function SeoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8 space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-muted-foreground [&_a]:text-foreground [&_a]:underline-offset-2 hover:[&_a]:underline [&_strong]:text-foreground/90">
        {children}
      </div>
    </section>
  );
}

export function SeoCta() {
  return (
    <div className="mt-8 rounded-2xl border border-border/70 bg-muted/20 p-5">
      <p className="text-sm font-medium text-foreground">Ready to talk?</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Browse live voice rooms by language and level — free in your browser.
      </p>
      <Link
        href="/"
        className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        data-testid="button-seo-cta-lobby"
      >
        Open the lobby
      </Link>
    </div>
  );
}
