type SchemaObject = Record<string, unknown>;

/**
 * Renders one or more schema.org objects as a single <script type="application/ld+json">.
 * Pass one object for a single entity, or an array to combine several into one
 * @graph (e.g. BreadcrumbList + the page's primary entity) under one shared @context.
 * Falsy items in an array are skipped, so callers can inline conditionals, e.g.
 * `schemas={[orgSchema, hasFaqs && faqPageSchema(faqs)]}`.
 */
export default function JsonLd({
  schema,
}: {
  schema: SchemaObject | null | false | undefined | (SchemaObject | null | false | undefined)[];
}) {
  const payload = Array.isArray(schema)
    ? (() => {
        const items = schema.filter((s): s is SchemaObject => Boolean(s));
        if (items.length === 0) return null;
        if (items.length === 1) return items[0];
        return {
          "@context": "https://schema.org",
          "@graph": items.map((item) => {
            const { ...rest } = item;
            delete rest["@context"];
            return rest;
          }),
        };
      })()
    : schema;

  if (!payload) return null;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
