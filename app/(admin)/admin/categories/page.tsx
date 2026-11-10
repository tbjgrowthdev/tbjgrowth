import { getCategories, createCategory, deleteCategory } from "@/app/(admin)/actions/taxonomy";
import TaxonomyManager from "@/components/Admin/TaxonomyManager";
import PageTitle from "@/components/Admin/PageTitle";

export default async function CategoriesPage() {
  const categories = await getCategories();

  return (
    <div className="space-y-6">
      <div>
        <PageTitle>Categories</PageTitle>
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
