import { getPosts } from "../../actions/posts";
import { getCategories, getTags } from "../../actions/taxonomy";
import { getAssignableUsers } from "../../actions/admins";
import { getCurrentAdmin } from "../../actions/profile";
import { hasPermission } from "@/lib/permissions";
import PostsListClient from "@/components/Admin/Posts/PostsListClient";

export default async function PostsList() {
  const [posts, categories, tags, authors, admin] = await Promise.all([
    getPosts(),
    getCategories(),
    getTags(),
    getAssignableUsers("CREATE"),
    getCurrentAdmin(),
  ]);

  const role = admin?.role;

  return (
    <PostsListClient
      posts={posts}
      categories={categories.map((c) => ({ id: c.id, label: c.name }))}
      tags={tags.map((t) => ({ id: t.id, label: t.name }))}
      authors={authors.map((a) => ({ id: a.id, label: a.name || a.email || "Unnamed" }))}
      canPublish={hasPermission(role, "PUBLISH")}
      canSchedule={hasPermission(role, "SCHEDULE")}
      canEdit={hasPermission(role, "EDIT")}
    />
  );
}
