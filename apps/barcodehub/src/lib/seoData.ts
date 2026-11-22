/**
 * SEO facts for public pages, built from the same data the page shows.
 * Used by the browser (useSeo) and by the server (raw HTML for crawlers), so both say the same thing.
 * No DOM or React here: the server loads this file too.
 */
import { SITE_URL } from './config';
import { isGlobalGtin } from './barcode';

export type PublicProduct = {
  id: string; title: string; barcodeNumber: string; barcodeType: string; description: string;
  brand: string; manufacturer: string; category: string; netWeight: string; countryOfOrigin: string;
  ingredients: string; certifications: string; mrp: number | null; images: string[];
  tenant: { name: string; slug: string; logo: string | null; website: string };
};
export type PublicBrand = {
  name: string; logo: string | null; website: string; phone: string; address: string;
  products: { id: string; title: string; barcodeNumber: string; image: string | null; netWeight: string }[];
};

export type Seo = {
  title: string;
  description: string;
  /** Absolute canonical URL */
  canonical: string;
  image?: string | null;
  type?: 'website' | 'product';
  jsonLd?: object | null;
  noindex?: boolean;
};

export const productPath = (barcode: string) => `/barcode/${encodeURIComponent(barcode)}`;
export const brandPath = (slug: string) => `/brand/${encodeURIComponent(slug)}`;
export const absoluteUrl = (pathOrUrl: string) => (/^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : SITE_URL + pathOrUrl);

export function productSeo(p: PublicProduct): Seo {
  const canonical = absoluteUrl(productPath(p.barcodeNumber));
  const brandName = p.brand || p.tenant.name;
  const images = p.images.map(absoluteUrl);
  return {
    title: `${p.title} — Barcode ${p.barcodeNumber} | ${brandName}`,
    description: `${p.title} by ${p.manufacturer || brandName}. Barcode ${p.barcodeNumber}. ${p.description}`.slice(0, 300),
    canonical,
    image: images[0] ?? null,
    type: 'product',
    // Only facts the product page shows.
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      '@id': `${canonical}#product`,
      url: canonical,
      name: p.title,
      ...(p.description ? { description: p.description } : {}),
      ...(images.length ? { image: images } : {}),
      sku: p.barcodeNumber,
      // Internal-use numbers keep only sku: claiming them as a GTIN would be false structured data.
      ...(isGlobalGtin(p.barcodeType, p.barcodeNumber) ? { gtin: p.barcodeNumber, [p.barcodeType === 'EAN-13' ? 'gtin13' : 'gtin12']: p.barcodeNumber } : {}),
      brand: { '@type': 'Brand', name: brandName },
      ...(p.manufacturer ? { manufacturer: { '@type': 'Organization', name: p.manufacturer } } : {}),
      ...(p.category ? { category: p.category } : {}),
      ...(p.countryOfOrigin ? { countryOfOrigin: p.countryOfOrigin } : {}),
      ...(p.netWeight ? { weight: p.netWeight } : {}),
      ...(p.mrp ? { offers: { '@type': 'Offer', url: canonical, price: p.mrp, priceCurrency: 'BDT' } } : {}),
    },
  };
}

export function productNotFoundSeo(barcode: string): Seo {
  return {
    title: `Barcode ${barcode} | BarcodeHub`,
    description: `No published product was found for barcode ${barcode}.`,
    canonical: absoluteUrl(productPath(barcode)),
    noindex: true,
  };
}

export function brandSeo(b: PublicBrand, slug: string): Seo {
  const canonical = absoluteUrl(brandPath(slug));
  return {
    title: `${b.name} products & barcodes | BarcodeHub`,
    description: `All ${b.name} products with barcode numbers, images and details.`,
    canonical,
    image: b.logo ? absoluteUrl(b.logo) : null,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Brand',
      '@id': `${canonical}#brand`,
      name: b.name,
      url: canonical,
      ...(b.logo ? { logo: absoluteUrl(b.logo) } : {}),
      ...(b.website && /^https?:\/\//i.test(b.website) ? { sameAs: b.website } : {}),
    },
  };
}

export function brandNotFoundSeo(slug: string): Seo {
  return { title: 'Brand not found | BarcodeHub', description: 'This brand page does not exist.', canonical: absoluteUrl(brandPath(slug)), noindex: true };
}

export const homeSeo: Seo = {
  title: 'BarcodeHub — Barcode Generator & Product Pages for Bangladeshi Brands',
  description: 'Generate GS1-compliant EAN-13 & UPC barcodes, print packaging labels, and get found on Google automatically.',
  canonical: absoluteUrl('/'),
  image: absoluteUrl('/barcode_products_showcase.jpg'),
  jsonLd: {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: `${SITE_URL}/`,
        name: 'BarcodeHub',
        description: 'Barcode Generator & Product Pages for Bangladeshi Brands',
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${SITE_URL}/lookup?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: 'BarcodeHub',
        url: `${SITE_URL}/`,
        logo: `${SITE_URL}/barcode_products_showcase.jpg`,
      },
    ],
  },
};

export const lookupSeo = (q: string): Seo => ({
  title: q ? `${q} — Barcode lookup | BarcodeHub` : 'Barcode lookup | BarcodeHub',
  description: 'Search any barcode number or product name to see product details, manufacturer and images.',
  // Search result URLs (?q=) all point to the one lookup page.
  canonical: absoluteUrl('/lookup'),
});

export const notFoundSeo = (path: string): Seo => ({
  title: 'Page not found | BarcodeHub',
  description: 'This page does not exist.',
  canonical: absoluteUrl(path),
  noindex: true,
});
