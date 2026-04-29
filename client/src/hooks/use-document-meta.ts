import { useEffect } from "react";

type DocumentMeta = {
  title?: string;
  description?: string;
  canonical?: string;
  lang?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  noIndex?: boolean;
};

const DEFAULT_TITLE = "Vextorn — Talk. Share. Belong.";
const DEFAULT_DESC =
  "Vextorn is a real-time, voice-first community where you join live audio rooms by language and level to talk, share, and belong.";
const SITE_ORIGIN = "https://vextorn.com";

function setMeta(name: string, content: string, attr: "name" | "property" = "name") {
  if (typeof document === "undefined") return;
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel: string, href: string) {
  if (typeof document === "undefined") return;
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function useDocumentMeta(meta: DocumentMeta) {
  const {
    title,
    description,
    canonical,
    lang,
    ogTitle,
    ogDescription,
    ogImage,
    noIndex,
  } = meta;

  useEffect(() => {
    if (typeof document === "undefined") return;

    const finalTitle = title ? `${title} | Vextorn` : DEFAULT_TITLE;
    const finalDesc = description || DEFAULT_DESC;
    const finalCanonical =
      canonical ||
      (typeof window !== "undefined"
        ? SITE_ORIGIN + window.location.pathname
        : SITE_ORIGIN + "/");

    document.title = finalTitle;
    setMeta("description", finalDesc);
    setLink("canonical", finalCanonical);

    if (lang) {
      document.documentElement.setAttribute("lang", lang);
    }

    setMeta("og:title", ogTitle || finalTitle, "property");
    setMeta("og:description", ogDescription || finalDesc, "property");
    setMeta("og:url", finalCanonical, "property");
    if (ogImage) {
      setMeta("og:image", ogImage, "property");
    }

    setMeta("twitter:title", ogTitle || finalTitle);
    setMeta("twitter:description", ogDescription || finalDesc);
    if (ogImage) {
      setMeta("twitter:image", ogImage);
    }

    setMeta("robots", noIndex ? "noindex, nofollow" : "index, follow");
  }, [title, description, canonical, lang, ogTitle, ogDescription, ogImage, noIndex]);
}
