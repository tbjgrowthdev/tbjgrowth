import PostForm from "@/components/Admin/PostForm";
import { getCategories, getTags } from "@/app/(admin)/actions/taxonomy";

export default async function NewPost() {
  const [categories, tags] = await Promise.all([getCategories(), getTags()]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Create New Blog Post</h1>
      <PostForm categories={categories} tags={tags} />
    </div>
  );
}
