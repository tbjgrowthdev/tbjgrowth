import { getTags, createTag, deleteTag } from "@/app/(admin)/actions/taxonomy";
import TaxonomyManager from "@/components/Admin/TaxonomyManager";

export default async function TagsPage() {
  const tags = await getTags();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tags</h1>
        <p className="text-gray-500 dark:text-gray-400">Fine-grained labels for blog posts.</p>
      </div>
      <TaxonomyManager
        entityName="tag"
        items={tags}
        createAction={createTag}
        deleteAction={deleteTag}
      />
    </div>
  );
}
