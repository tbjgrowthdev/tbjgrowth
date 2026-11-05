import { notFound } from "next/navigation";
import { getAdminPricing } from "@/app/(admin)/actions/pricing";
import PackageForm from "@/components/Admin/Pricing/PackageForm";

export const dynamic = "force-dynamic";

export default async function EditPackagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getAdminPricing();
  const p = data?.raw.packages.find((x) => x.id === id);
  if (!p) notFound();
  return (
    <PackageForm
      initial={{
        id: p.id, slug: p.slug, number: p.number, name: p.name, tagline: p.tagline, description: p.description,
        isMostPopular: p.isMostPopular, isActive: p.isActive,
        stages: [p.stageBuild, p.stageAttract, p.stageConvert, p.stageAutomate, p.stageScale],
        notIncluded: p.notIncluded, moveUpTitle: p.moveUpTitle, moveUpText: p.moveUpText, ctaLabel: p.ctaLabel, ctaLink: p.ctaLink,
        prices: p.prices,
        features: [...p.features].sort((a, b) => a.sortOrder - b.sortOrder).map((f) => ({ label: f.label, text: f.text })),
      }}
    />
  );
}
