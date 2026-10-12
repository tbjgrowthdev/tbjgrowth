import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getBaseContentForTranslation, getExistingTranslation } from "@/app/(admin)/actions/translations";
import { TRANSLATION_FIELD_MAP, type TranslatableKind } from "@/lib/translation";
import { getLocaleByCode } from "@/lib/i18n";
import TranslationEditor from "@/components/Admin/Translations/TranslationEditor";

const VALID_TYPES: TranslatableKind[] = ["POST", "PAGE", "CASE_STUDY", "SERVICE", "CATEGORY", "TAG"];

export default async function TranslationEditorPage({
  params,
}: {
  params: Promise<{ contentType: string; contentId: string; locale: string }>;
}) {
  const { contentType: contentTypeParam, contentId, locale: localeParam } = await params;
  const contentType = contentTypeParam.toUpperCase() as TranslatableKind;
  if (!VALID_TYPES.includes(contentType)) {
    notFound();
  }

  const locale = getLocaleByCode(localeParam);
  if (!locale || locale.isDefault) {
    notFound();
  }

  const [base, existing] = await Promise.all([
    getBaseContentForTranslation(contentType, contentId),
    getExistingTranslation(contentType, contentId, locale.code),
  ]);

  if (!base) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/translations"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-brand-orange-deep dark:hover:text-brand-orange-light transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Translations
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Translate to {locale.label}
        </h1>
        <p className="text-caption">
          {contentType.replace("_", " ")} &middot; {"title" in base ? base.title : "name" in base ? base.name : contentId}
        </p>
      </div>

      <TranslationEditor
        contentType={contentType}
        contentId={contentId}
        locale={locale.code}
        fieldMap={TRANSLATION_FIELD_MAP[contentType]}
        base={base}
        existing={existing}
      />
    </div>
  );
}
