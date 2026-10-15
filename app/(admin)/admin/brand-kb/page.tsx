import Link from "next/link";
import { listBrandSectionsAction } from "@/app/(admin)/actions/brand-kb";
import { SECTION_LABEL } from "@/lib/brand-kb/constants";

export default async function BrandKnowledgeBasePage() {
  const rows = await listBrandSectionsAction();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Brand Knowledge Base</h1>
        <p className="text-caption">
          The brand context injected into every AI Content Pipeline generation call — voice, audience, terminology, forbidden terms, and more. A section
          with nothing authored yet falls back to a minimal built-in default, so the pipeline keeps working either way.
        </p>
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background border-b border-border">
              <th className="px-6 py-4 font-medium text-caption">Section</th>
              <th className="px-6 py-4 font-medium text-caption">Active version</th>
              <th className="px-6 py-4 font-medium text-caption">Updated by</th>
              <th className="px-6 py-4 font-medium text-caption">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(({ key, section, updatedByName }) => (
              <tr key={key} className="hover:bg-background transition-colors">
                <td className="px-6 py-4 font-medium text-foreground">
                  <Link href={`/admin/brand-kb/${key}`} className="hover:text-brand-orange-deep dark:hover:text-brand-orange-light">
                    {SECTION_LABEL[key]}
                  </Link>
                </td>
                <td className="px-6 py-4 text-caption">
                  {section?.activeVersion ? `v${section.activeVersion.versionNumber}` : <span className="italic">Using built-in default</span>}
                </td>
                <td className="px-6 py-4 text-caption">{updatedByName || "—"}</td>
                <td className="px-6 py-4 text-caption">{section ? new Date(section.updatedAt).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
