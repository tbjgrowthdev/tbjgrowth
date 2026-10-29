"use server";

import type { BrandSectionKey } from "@/lib/generated/prisma/client";
import { activateBrandSectionVersion, getBrandSectionDetail, listBrandSections, saveBrandSectionVersion } from "@/lib/brand-kb/brand-kb";
import { guardMutation, guardRead } from "@/lib/action-guard";
import { BRAND_SECTION_KEYS } from "@/lib/brand-kb/constants";

export async function listBrandSectionsAction() {
  return guardRead("SETTINGS_MANAGEMENT", () => BRAND_SECTION_KEYS.map((key) => ({ key, section: null, updatedByName: null })), () => listBrandSections());
}

export async function getBrandSectionDetailAction(key: BrandSectionKey) {
  return guardRead(
    "SETTINGS_MANAGEMENT",
    () => ({ key, section: null, authors: new Map<string, string>(), forbidden: true as const }),
    () => getBrandSectionDetail(key)
  );
}

export async function saveBrandSectionVersionAction(key: BrandSectionKey, data: { content: string; changeNote?: string }) {
  return guardMutation("SETTINGS_MANAGEMENT", () => saveBrandSectionVersion(key, data));
}

export async function activateBrandSectionVersionAction(sectionId: string, versionId: string) {
  return guardMutation("SETTINGS_MANAGEMENT", () => activateBrandSectionVersion(sectionId, versionId));
}
