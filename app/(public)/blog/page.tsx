import prisma from "@/lib/prisma";
import BlogListClient from "./BlogListClient";
import { getPageMetadata, publiclyVisible } from "@/lib/seo-meta";

export async function generateMetadata() {
  return getPageMetadata("blog", {
    title: "Blog & Insights | TBJ Growth",
    description: "Read the latest insights, strategies, and case studies on scaling B2B SaaS revenue.",
    path: "/blog",
  });
}

export default async function BlogPage() {
  const posts = await prisma.post.findMany({
    where: publiclyVisible,
    include: {
      author: true,
      categories: true,
      tags: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });

  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <main className="min-h-screen bg-background pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Latest{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-orange-deep to-brand-orange">
              Insights & Strategies
            </span>
          </h1>
          <p className="text-lg text-muted">
            Discover actionable, data-driven SEO techniques designed to boost search rankings, drive high-intent organic traffic, and lower customer acquisition costs.
          </p>
        </div>

        <BlogListClient dbPosts={posts} dbCategories={categories} dbTags={tags} />
      </div>
    </main>
  );
}
