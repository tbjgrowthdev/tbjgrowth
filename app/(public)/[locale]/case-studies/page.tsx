import prisma from "@/lib/prisma";
import CaseStudiesListClient from "./CaseStudiesListClient";
import { getPageMetadata, publiclyVisible } from "@/lib/seo-meta";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema } from "@/lib/schema";
import { resolveRouteLocale } from "@/lib/i18n";
import { localizeList } from "@/lib/translation";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale = resolveRouteLocale(localeParam);
  return getPageMetadata("case-studies", {
    title: "Case Studies | TBJ Growth",
    description: "See how TBJ Growth has helped businesses scale with data-driven marketing, web development, and automation.",
    path: "/case-studies",
  }, locale?.code);
}

export default async function CaseStudiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale = resolveRouteLocale(localeParam);
  if (!locale) return null;

  const allCaseStudies = await prisma.caseStudy.findMany({
    where: publiclyVisible,
    include: { author: true },
    orderBy: { createdAt: "desc" },
  });
  const caseStudies = await localizeList("CASE_STUDY", allCaseStudies, locale.code);

  return (
    <main className="min-h-screen bg-background pt-24 pb-20">
      <JsonLd schema={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Case Studies", path: "/case-studies" }])} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Client{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-orange-deep to-brand-orange">
              Success Stories
            </span>
          </h1>
          <p className="text-lg text-muted">
            Real results from real businesses. Explore how we've helped clients across industries scale with growth-driven strategy.
          </p>
        </div>

        <CaseStudiesListClient caseStudies={caseStudies} localePrefix={locale.prefix} />
      </div>
    </main>
  );
}
