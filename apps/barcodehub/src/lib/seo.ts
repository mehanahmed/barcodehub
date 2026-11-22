import { useEffect } from 'react';
import { SITE_URL } from './config';

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

/**
 * Sets title, meta description, Open Graph tags, canonical link, robots and optional JSON-LD for the page.
 * The server writes the same tags into the raw HTML (see seoData.ts); this keeps them right after client-side navigation.
 */
export function useSeo(opts: {
  title: string;
  description: string;
  image?: string | null;
  jsonLd?: object | null;
  /** Absolute canonical URL; defaults to SITE_URL + current path, never the host that happened to serve the page */
  canonical?: string;
  noindex?: boolean;
  type?: 'website' | 'product';
}) {
  const { title, description, image, jsonLd, canonical, noindex, type } = opts;
  const ld = jsonLd ? JSON.stringify(jsonLd) : '';
  useEffect(() => {
    const url = canonical || SITE_URL + window.location.pathname;
    document.title = title;
    setMeta('name', 'description', description);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', type ?? (ld ? 'product' : 'website'));
    setMeta('property', 'og:url', url);
    if (image) setMeta('property', 'og:image', image);
    let canon = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canon) {
      canon = document.createElement('link');
      canon.rel = 'canonical';
      document.head.appendChild(canon);
    }
    canon.href = url;
    const robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (noindex) setMeta('name', 'robots', 'noindex');
    else robots?.remove();
    let script = document.getElementById('seo-jsonld');
    if (ld) {
      if (!script) {
        script = document.createElement('script');
        script.id = 'seo-jsonld';
        script.setAttribute('type', 'application/ld+json');
        document.head.appendChild(script);
      }
      script.textContent = ld;
    } else script?.remove();
  }, [title, description, image, ld, canonical, noindex, type]);
}
