import { notFound } from "next/navigation";
import { getBrandSectionDetailAction } from "@/app/(admin)/actions/brand-kb";
import { BRAND_SECTION_KEYS } from "@/lib/brand-kb/constants";
import type { BrandSectionKey } from "@/lib/generated/prisma/client";
import BrandKbEditor from "@/components/Admin/BrandKb/BrandKbEditor";

export default async function BrandKnowledgeSectionPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!BRAND_SECTION_KEYS.includes(key as BrandSectionKey)) notFound();

  const detail = await getBrandSectionDetailAction(key as BrandSectionKey);
  if (!detail) notFound();
  if (detail.forbidden) {
    return <p className="text-caption">You don&apos;t have permission to view this.</p>;
  }

  return <BrandKbEditor sectionKey={key as BrandSectionKey} section={detail.section} authors={Object.fromEntries(detail.authors)} />;
}
