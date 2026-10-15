"use server";

import type { BrandSectionKey } from "@/lib/generated/prisma/client";
import { activateBrandSectionVersion, getBrandSectionDetail, listBrandSections, saveBrandSectionVersion } from "@/lib/brand-kb/brand-kb";

export async function listBrandSectionsAction() {
  return listBrandSections();
}

export async function getBrandSectionDetailAction(key: BrandSectionKey) {
  return getBrandSectionDetail(key);
}

export async function saveBrandSectionVersionAction(key: BrandSectionKey, data: { content: string; changeNote?: string }) {
  return saveBrandSectionVersion(key, data);
}

export async function activateBrandSectionVersionAction(sectionId: string, versionId: string) {
  return activateBrandSectionVersion(sectionId, versionId);
}
