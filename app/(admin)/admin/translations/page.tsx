import {
  getTranslatableContent,
  getTranslatableTaxonomy,
  getTranslationStatusMap,
} from "@/app/(admin)/actions/translations";
import TranslationsListClient from "@/components/Admin/Translations/TranslationsListClient";

export default async function TranslationsPage() {
  const [content, taxonomy] = await Promise.all([getTranslatableContent(), getTranslatableTaxonomy()]);

  const contentRows = await Promise.all(
    content.map(async (item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      detail: item.slug || "",
      statuses: await getTranslationStatusMap(item.type, item.id),
    }))
  );

  const categoryRows = await Promise.all(
    taxonomy.categories.map(async (c) => ({
      id: c.id,
      type: "CATEGORY" as const,
      title: c.name,
      detail: c.slug,
      statuses: await getTranslationStatusMap("CATEGORY", c.id),
    }))
  );

  const tagRows = await Promise.all(
    taxonomy.tags.map(async (t) => ({
      id: t.id,
      type: "TAG" as const,
      title: t.name,
      detail: t.slug,
      statuses: await getTranslationStatusMap("TAG", t.id),
    }))
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Translations</h1>
        <p className="text-caption">
          Manage Bangla and Arabic translations, and English regional copy for Bangladesh/Gulf, for every page, post,
          case study, service, category, and tag.
        </p>
      </div>

      <TranslationsListClient rows={[...contentRows, ...categoryRows, ...tagRows]} />
    </div>
  );
}
