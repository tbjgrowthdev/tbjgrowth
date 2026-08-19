import prisma from "@/lib/prisma";
import CaseStudiesListClient from "./CaseStudiesListClient";
import { getPageMetadata, publiclyVisible } from "@/lib/seo-meta";

export async function generateMetadata() {
  return getPageMetadata("case-studies", {
    title: "Case Studies | TBJ Growth",
    description: "See how TBJ Growth has helped businesses scale with data-driven marketing, web development, and automation.",
    path: "/case-studies",
  });
}

export default async function CaseStudiesPage() {
  const caseStudies = await prisma.caseStudy.findMany({
    where: publiclyVisible,
    include: { author: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Client{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              Success Stories
            </span>
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Real results from real businesses. Explore how we've helped clients across industries scale with growth-driven strategy.
          </p>
        </div>

        <CaseStudiesListClient caseStudies={caseStudies} />
      </div>
    </main>
  );
}
