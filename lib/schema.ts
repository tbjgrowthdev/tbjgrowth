/**
 * schema.org / JSON-LD builders.
 *
 * Hard rule for every function here: only emit structured data that mirrors
 * something real and already visible on the page. Never invent a rating,
 * review, price, or count. When the real data backing a schema type doesn't
 * exist yet (e.g. no testimonials in the DB), the caller skips rendering it
 * entirely rather than this file inventing a placeholder — see each build*
 * function's callers for the exact "only render when non-empty" guards.
 */

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com";

type SiteSettings = {
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  facebookUrl?: string | null;
  twitterUrl?: string | null;
  linkedinUrl?: string | null;
  instagramUrl?: string | null;
  youtubeUrl?: string | null;
  gbpName?: string | null;
  gbpAddress?: string | null;
  gbpPhone?: string | null;
  gbpWebsite?: string | null;
} | null | undefined;

function sameAsLinks(settings: SiteSettings): string[] {
  return [
    settings?.facebookUrl,
    settings?.twitterUrl,
    settings?.linkedinUrl,
    settings?.instagramUrl,
    settings?.youtubeUrl,
  ].filter((v): v is string => Boolean(v));
}

export function organizationSchema(settings: SiteSettings) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings?.gbpName || "TBJ Growth Tech",
    url: baseUrl,
    logo: `${baseUrl}/primarylogo.png`,
    email: settings?.email || undefined,
    telephone: settings?.phone || undefined,
    sameAs: sameAsLinks(settings),
  };
}

export function webSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "TBJ Growth Tech",
    url: baseUrl,
  };
}

export function localBusinessSchema(settings: SiteSettings) {
  return {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "ProfessionalService"],
    name: settings?.gbpName || "TBJ Growth Tech",
    url: settings?.gbpWebsite || baseUrl,
    telephone: settings?.gbpPhone || settings?.phone || undefined,
    email: settings?.email || undefined,
    address: settings?.gbpAddress
      ? { "@type": "PostalAddress", streetAddress: settings.gbpAddress, addressCountry: "GB" }
      : undefined,
    areaServed: { "@type": "Country", name: "United Kingdom" },
    sameAs: sameAsLinks(settings),
  };
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${baseUrl}${item.path}`,
    })),
  };
}

export function articleSchema(post: {
  title: string;
  path: string;
  excerpt?: string | null;
  featuredImage?: string | null;
  authorName?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt || undefined,
    image: post.featuredImage ? [post.featuredImage] : undefined,
    datePublished: new Date(post.createdAt).toISOString(),
    dateModified: new Date(post.updatedAt).toISOString(),
    author: post.authorName ? { "@type": "Person", name: post.authorName } : undefined,
    publisher: {
      "@type": "Organization",
      name: "TBJ Growth Tech",
      logo: { "@type": "ImageObject", url: `${baseUrl}/primarylogo.png` },
    },
    mainEntityOfPage: `${baseUrl}${post.path}`,
  };
}

export function serviceSchema(service: {
  title: string;
  description: string;
  slug?: string | null;
  id: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.title,
    description: service.description,
    url: `${baseUrl}/services/${service.slug || service.id}`,
    provider: {
      "@type": "Organization",
      name: "TBJ Growth Tech",
      url: baseUrl,
    },
    areaServed: { "@type": "Country", name: "United Kingdom" },
  };
}

export function faqPageSchema(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

// Review + AggregateRating — only ever call with real Testimonial rows. The
// caller is responsible for skipping this entirely when there are none,
// exactly mirroring whatever empty-state the visible testimonials section uses.
export function reviewsSchema(
  itemName: string,
  testimonials: { clientName: string; quote: string; rating: number }[]
) {
  if (testimonials.length === 0) return null;
  const avg = testimonials.reduce((sum, t) => sum + t.rating, 0) / testimonials.length;
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: itemName,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: Number(avg.toFixed(1)),
      reviewCount: testimonials.length,
    },
    review: testimonials.map((t) => ({
      "@type": "Review",
      author: { "@type": "Person", name: t.clientName },
      reviewRating: { "@type": "Rating", ratingValue: t.rating, bestRating: 5 },
      reviewBody: t.quote,
    })),
  };
}

export function productSchema(plan: {
  name: string;
  tagline?: string | null;
  priceGbp: number;
  billingTerm: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: plan.name,
    description: plan.tagline || undefined,
    offers: {
      "@type": "Offer",
      price: plan.priceGbp,
      priceCurrency: "GBP",
      priceValidUntil: undefined,
      availability: "https://schema.org/InStock",
      url: `${baseUrl}/pricing`,
    },
  };
}
