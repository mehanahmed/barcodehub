/**
 * Turns SEO facts (src/lib/seoData.ts) into raw HTML for crawlers that do not run JavaScript.
 * Pure string functions; only type imports from seoData, because this file is loaded by vite.config
 * outside Vite's transform pipeline, where import.meta.env does not exist.
 */
import type { Seo, PublicProduct, PublicBrand } from '../lib/seoData';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** All per-page head tags; replaces the block between <!-- seo:start --> and <!-- seo:end --> in index.html. */
export function renderHead(seo: Seo): string {
  const tags = [
    `<title>${esc(seo.title)}</title>`,
    `<meta name="description" content="${esc(seo.description)}" />`,
    `<link rel="canonical" href="${esc(seo.canonical)}" />`,
    seo.noindex ? `<meta name="robots" content="noindex" />` : '',
    `<meta property="og:type" content="${seo.type ?? 'website'}" />`,
    `<meta property="og:site_name" content="BarcodeHub" />`,
    `<meta property="og:title" content="${esc(seo.title)}" />`,
    `<meta property="og:description" content="${esc(seo.description)}" />`,
    `<meta property="og:url" content="${esc(seo.canonical)}" />`,
    seo.image ? `<meta property="og:image" content="${esc(seo.image)}" />` : '',
    `<meta property="og:locale" content="en_US" />`,
    `<meta name="twitter:card" content="${seo.image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${esc(seo.title)}" />`,
    `<meta name="twitter:description" content="${esc(seo.description)}" />`,
    seo.image ? `<meta name="twitter:image" content="${esc(seo.image)}" />` : '',
    // id matches useSeo, so the browser updates this element instead of adding a second one. "<" escaped so text can't close the script.
    seo.jsonLd ? `<script type="application/ld+json" id="seo-jsonld">${JSON.stringify(seo.jsonLd).replace(/</g, '\\u003c')}</script>` : '',
  ];
  return tags.filter(Boolean).map((t) => `    ${t}`).join('\n');
}

/** Puts the head tags and an optional crawlable body into the app shell. React replaces the body on load. */
export function injectSeo(html: string, head: string, body = ''): string {
  const out = html.replace(/<!-- seo:start -->[\s\S]*?<!-- seo:end -->/, `<!-- seo:start -->\n${head}\n    <!-- seo:end -->`);
  return body ? out.replace('<div id="root"></div>', `<div id="root">${body}</div>`) : out;
}

const productHref = (barcode: string) => `/barcode/${encodeURIComponent(barcode)}`;

/** Plain HTML with the same facts the product page shows. */
export function productBody(p: PublicProduct): string {
  const specs: [string, string][] = ([
    ['Brand', p.brand], ['Manufacturer', p.manufacturer], ['Category', p.category], ['Net weight', p.netWeight],
    ['Country of origin', p.countryOfOrigin], ['Certifications', p.certifications],
    ['MRP', p.mrp ? `৳${Math.round(p.mrp).toLocaleString('en-IN')}` : ''],
  ] as [string, string][]).filter(([, v]) => v);
  return [
    `<main>`,
    `<nav><a href="/">BarcodeHub</a> › <a href="/brand/${encodeURIComponent(p.tenant.slug)}">${esc(p.tenant.name)}</a> › ${esc(p.title)}</nav>`,
    `<h1>${esc(p.title)}</h1>`,
    `<p>Barcode <strong>${esc(p.barcodeNumber)}</strong> (${esc(p.barcodeType)})</p>`,
    p.images[0] ? `<img src="${esc(p.images[0])}" alt="${esc(`${p.title} — barcode ${p.barcodeNumber}`)}" width="480" />` : '',
    p.description ? `<p>${esc(p.description)}</p>` : '',
    specs.length ? `<dl>${specs.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : '',
    p.ingredients ? `<p><strong>Ingredients:</strong> ${esc(p.ingredients)}</p>` : '',
    `</main>`,
  ].filter(Boolean).join('\n');
}

/** Plain HTML for a brand page: name, contact facts and links to every published product. */
export function brandBody(b: PublicBrand): string {
  return [
    `<main>`,
    `<h1>${esc(b.name)}</h1>`,
    [b.website, b.phone, b.address].some(Boolean)
      ? `<p>${[
          // Only http(s) becomes a link: a stored "javascript:" address must never be clickable.
          b.website && (/^https?:\/\//i.test(b.website) ? `<a href="${esc(b.website)}" rel="nofollow">${esc(b.website)}</a>` : esc(b.website)),
          b.phone && esc(b.phone),
          b.address && esc(b.address),
        ].filter(Boolean).join(' · ')}</p>`
      : '',
    b.products.length
      ? `<ul>${b.products.map((p) => `<li><a href="${productHref(p.barcodeNumber)}">${esc(p.title)}</a> — ${esc(p.barcodeNumber)}</li>`).join('')}</ul>`
      : `<p>No published products yet.</p>`,
    `</main>`,
  ].filter(Boolean).join('\n');
}

export function notFoundBody(message: string): string {
  return `<main><h1>${esc(message)}</h1><p><a href="/lookup">Search barcodes</a> · <a href="/">BarcodeHub home</a></p></main>`;
}
