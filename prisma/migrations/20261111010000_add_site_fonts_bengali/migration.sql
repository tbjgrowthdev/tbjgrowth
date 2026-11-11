-- Additive: two nullable columns for the Bengali heading/body fonts (NULL = site
-- default), plus a one-off move of any Bengali font that was saved in a Latin
-- column before the two were separated (hind-siliguri / noto-sans-bengali are
-- Bengali fonts and are no longer valid Latin choices).
--
-- Deploy order: run this BEFORE deploying the code that reads the columns.
ALTER TABLE "SiteSetting" ADD COLUMN "headingFontBn" TEXT,
ADD COLUMN "bodyFontBn" TEXT;

UPDATE "SiteSetting" SET "headingFontBn" = "headingFont", "headingFont" = NULL
  WHERE "headingFont" IN ('hind-siliguri', 'noto-sans-bengali');
UPDATE "SiteSetting" SET "bodyFontBn" = "bodyFont", "bodyFont" = NULL
  WHERE "bodyFont" IN ('hind-siliguri', 'noto-sans-bengali');
