import { getPost } from "@/app/(admin)/actions/posts";
import { getCategories, getTags } from "@/app/(admin)/actions/taxonomy";
import PostForm from "@/components/Admin/PostForm";
import { notFound } from "next/navigation";
import PageTitle from "@/components/Admin/PageTitle";

export default async function EditPost({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [post, categories, tags] = await Promise.all([getPost(id), getCategories(), getTags()]);

  if (!post) {
    notFound();
  }

  return (
    <div>
      <PageTitle className="mb-6">Edit Post: {post.title}</PageTitle>
      <PostForm initialData={post} categories={categories} tags={tags} />
    </div>
  );
}
