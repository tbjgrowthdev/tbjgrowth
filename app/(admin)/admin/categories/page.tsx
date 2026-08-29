import { getCategories, createCategory, deleteCategory } from "@/app/(admin)/actions/taxonomy";
import TaxonomyManager from "@/components/Admin/TaxonomyManager";

export default async function CategoriesPage() {
  const categories = await getCategories();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Categories</h1>
        <p className="text-caption">Organize blog posts into categories.</p>
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
