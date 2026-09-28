import { notFound } from "next/navigation";
import { getServiceBySlug } from "@/app/(admin)/actions/services";
import { fallbackServices } from "@/lib/fallback-services";
import ServiceDetailClient from "./ServiceDetailClient";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com";

async function resolveService(slug: string) {
  const dbService = await getServiceBySlug(slug);
  if (dbService) return dbService;
  return fallbackServices.find((s) => s.slug === slug) || null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = await resolveService(slug);

  if (!service) {
    return { title: "Service Not Found" };
  }

  const title = `${service.title} | TBJ Growth`;
  const description = service.subtitle || service.description;
  const canonical = `${baseUrl}/services/${slug}`;

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: { "en-GB": canonical },
    },
    openGraph: { title, description },
    twitter: { card: "summary_large_image" },
  };
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = await resolveService(slug);

  if (!service) {
    notFound();
  }

  return <ServiceDetailClient service={service} />;
}
