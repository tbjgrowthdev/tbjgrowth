"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Edit } from "lucide-react";
import ContentDeleteButton from "@/components/Admin/ContentDeleteButton";
import BulkActionsBar from "./BulkActionsBar";
import { deletePost } from "@/app/(admin)/actions/posts";

type Post = {
  id: string;
  title: string;
  slug: string;
  status: string;
  author: { name: string | null } | null;
};

export default function PostsListClient({
  posts,
  categories,
  tags,
  authors,
  canPublish,
  canSchedule,
  canEdit,
}: {
  posts: Post[];
  categories: { id: string; label: string }[];
  tags: { id: string; label: string }[];
  authors: { id: string; label: string }[];
  canPublish: boolean;
  canSchedule: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => (prev.size === posts.length ? new Set() : new Set(posts.map((p) => p.id))));
  };

  const clearAndRefresh = () => {
    setSelected(new Set());
    startTransition(() => router.refresh());
  };

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

      <BulkActionsBar
        selectedIds={Array.from(selected)}
        onCleared={clearAndRefresh}
        categories={categories}
        tags={tags}
        authors={authors}
        canPublish={canPublish}
        canSchedule={canSchedule}
        canEdit={canEdit}
      />

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background border-b border-border">
              <th className="px-4 py-4 w-10">
                <input
                  type="checkbox"
                  checked={posts.length > 0 && selected.size === posts.length}
                  onChange={toggleAll}
                  aria-label="Select all posts"
                />
              </th>
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
                <td colSpan={6} className="px-6 py-8 text-center text-caption">
                  No blog posts found. Create your first post!
                </td>
              </tr>
            ) : (
              posts.map((post) => (
                <tr key={post.id} className={`hover:bg-background transition-colors ${selected.has(post.id) ? "bg-tint" : ""}`}>
                  <td className="px-4 py-4">
                    <input type="checkbox" checked={selected.has(post.id)} onChange={() => toggle(post.id)} aria-label={`Select ${post.title}`} />
                  </td>
                  <td className="px-6 py-4 font-medium text-foreground">{post.title}</td>
                  <td className="px-6 py-4 text-caption">/blog/{post.slug}</td>
                  <td className="px-6 py-4 text-caption">{post.author?.name || "Unassigned"}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        post.status === "PUBLISHED"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                      }`}
                    >
                      {post.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right flex justify-end gap-3">
                    <Link href={`/admin/posts/${post.id}`} className="text-brand-orange-deep hover:text-brand-orange dark:text-brand-orange-light dark:hover:text-brand-orange">
                      <Edit size={18} />
                    </Link>
                    <ContentDeleteButton id={post.id} kind="POST" onDelete={deletePost} entityName="post" />
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
