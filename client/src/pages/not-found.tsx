import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { useDocumentMeta } from "@/hooks/use-document-meta";

export default function NotFound() {
  useDocumentMeta({
    title: "Page not found",
    description: "The page you were looking for could not be found on Vextorn.",
    noIndex: true,
  });
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground px-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2 items-start">
            <AlertCircle className="h-8 w-8 text-destructive shrink-0" />
            <h1 className="text-2xl font-bold">404 — Page not found</h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            That URL is not part of Vextorn. Try the lobby, FAQ, or language exchange pages.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <Link href="/" className="underline underline-offset-2">Lobby</Link>
            <Link href="/faq" className="underline underline-offset-2">FAQ</Link>
            <Link href="/language-exchange" className="underline underline-offset-2">Language exchange</Link>
            <Link href="/contact" className="underline underline-offset-2">Contact</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
