import { getCategories, createCategory, deleteCategory } from "@/app/(admin)/actions/taxonomy";
import TaxonomyManager from "@/components/Admin/TaxonomyManager";

export default async function CategoriesPage() {
  const categories = await getCategories();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Categories</h1>
        <p className="text-gray-500 dark:text-gray-400">Organize blog posts into categories.</p>
      </div>
      <TaxonomyManager
        entityName="category"
        items={categories}
        createAction={createCategory}
        deleteAction={deleteCategory}
        showDescription
      />
    </div>
  );
}
