import PostForm from "@/components/Admin/PostForm";
import { getCategories, getTags } from "@/app/(admin)/actions/taxonomy";
import PageTitle from "@/components/Admin/PageTitle";

export default async function NewPost() {
  const [categories, tags] = await Promise.all([getCategories(), getTags()]);

  return (
    <div>
      <PageTitle className="mb-6">Create New Blog Post</PageTitle>
      <PostForm categories={categories} tags={tags} />
    </div>
  );
}
