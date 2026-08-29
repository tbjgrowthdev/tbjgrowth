import { getPosts, deletePost } from "../../actions/posts";
import Link from "next/link";
import { Plus, Edit } from "lucide-react";
import DeleteButton from "@/components/Admin/DeleteButton";

export default async function PostsList() {
  const posts = await getPosts();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-foreground">Blog Posts</h1>
        <Link 
          href="/admin/posts/new" 
          className="flex items-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors"
        >
          <Plus size={18} />
          Create Post
        </Link>
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background border-b border-border">
              <th className="px-6 py-4 font-medium text-caption">Title</th>
              <th className="px-6 py-4 font-medium text-caption">Slug</th>
              <th className="px-6 py-4 font-medium text-caption">Author</th>
              <th className="px-6 py-4 font-medium text-caption">Status</th>
              <th className="px-6 py-4 font-medium text-caption text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {posts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-caption">
                  No blog posts found. Create your first post!
                </td>
              </tr>
            ) : (
              posts.map((post) => (
                <tr key={post.id} className="hover:bg-background transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">{post.title}</td>
                  <td className="px-6 py-4 text-caption">/blog/{post.slug}</td>
                  <td className="px-6 py-4 text-caption">{post.author?.name || "Unassigned"}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      post.status === 'PUBLISHED' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      {post.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right flex justify-end gap-3">
                    <Link href={`/admin/posts/${post.id}`} className="text-brand-orange-deep hover:text-brand-orange dark:text-brand-orange-light dark:hover:text-brand-orange">
                      <Edit size={18} />
                    </Link>
                    <DeleteButton id={post.id} onDelete={deletePost} entityName="post" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
