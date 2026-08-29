"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Calendar, User, ArrowRight } from "lucide-react";
import Image from "next/image";
import { isValidImageSrc } from "@/lib/utils";

type Post = any;
type Category = any;

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function BlogListClient({
  dbPosts,
  dbCategories,
  dbTags,
}: {
  dbPosts: Post[];
  dbCategories: Category[];
  dbTags: any[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const filteredPosts = useMemo(() => {
    return dbPosts.filter((post) => {
      // Search matching
      const matchesSearch =
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (post.excerpt && post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()));

      // Category matching
      const matchesCategory =
        selectedCategory === "All" ||
        post.categories.some((cat: any) => cat.name === selectedCategory);

      return matchesSearch && matchesCategory;
    });
  }, [dbPosts, searchQuery, selectedCategory]);

  // Feature the newest post only on the default, unfiltered feed view.
  const showFeatured = !searchQuery && selectedCategory === "All" && filteredPosts.length > 0;
  const featuredPost = showFeatured ? filteredPosts[0] : null;
  const feedPosts = showFeatured ? filteredPosts.slice(1) : filteredPosts;

  return (
    <div>
      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-6 justify-between items-center mb-12">
        {/* Categories */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setSelectedCategory("All")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === "All"
                ? "bg-brand-orange-deep text-white"
                : "bg-card text-muted hover:bg-background border border-border"
            }`}
          >
            All
          </button>
          {dbCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.name)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === category.name
                  ? "bg-brand-orange-deep text-white"
                  : "bg-card text-muted hover:bg-background border border-border"
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-caption" />
          </div>
          <input
            type="text"
            placeholder="Search articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-full focus:ring-2 focus:ring-brand-orange focus:border-transparent outline-none transition-all text-foreground"
          />
        </div>
      </div>

      {filteredPosts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-20 text-center"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-background text-caption mb-4">
            <Search size={32} />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">No posts found</h3>
          <p className="text-muted">
            Try adjusting your search or filter to find what you're looking for.
          </p>
        </motion.div>
      ) : (
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Featured post */}
          {featuredPost && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="group"
            >
              <Link
                href={`/blog/${featuredPost.slug}`}
                className="flex flex-col bg-card rounded-2xl border border-border overflow-hidden hover:shadow-2xl hover:shadow-brand-orange/10 transition-all duration-300"
              >
                <div className="relative h-64 sm:h-80 w-full overflow-hidden bg-background">
                  {isValidImageSrc(featuredPost.featuredImage) ? (
                    <Image
                      src={featuredPost.featuredImage}
                      alt={featuredPost.featuredImageAlt || featuredPost.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      priority
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-orange-deep/20 to-brand-orange/20 flex items-center justify-center">
                      <span className="text-caption">No Image</span>
                    </div>
                  )}
                  {featuredPost.categories?.[0] && (
                    <div className="absolute top-4 left-4">
                      <span className="px-3 py-1 bg-card/90 backdrop-blur text-xs font-semibold rounded-full text-brand-orange-deep dark:text-brand-orange-light">
                        {featuredPost.categories[0].name}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-6 sm:p-8">
                  <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3 group-hover:text-brand-orange-deep dark:group-hover:text-brand-orange-light transition-colors">
                    {featuredPost.title}
                  </h2>
                  <p className="text-muted mb-6 line-clamp-2">
                    {featuredPost.excerpt || "Click to read more about this topic."}
                  </p>
                  <div className="flex flex-wrap items-center gap-6 text-sm text-muted border-t border-border pt-4">
                    <div className="flex items-center gap-2">
                      <User size={16} />
                      <span>{featuredPost.author?.name || "TBJ Partners"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar size={16} />
                      <span>{formatDate(featuredPost.createdAt)}</span>
                    </div>
                    <span className="flex items-center gap-1 text-brand-orange-deep dark:text-brand-orange-light font-medium ml-auto">
                      Read article <ArrowRight size={16} />
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          )}

          {/* Feed */}
          <motion.div layout className="divide-y divide-border">
            <AnimatePresence>
              {feedPosts.map((post) => (
                <motion.div
                  key={post.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="group py-6 first:pt-0"
                >
                  <Link href={`/blog/${post.slug}`} className="flex flex-col sm:flex-row gap-5">
                    <div className="relative w-full sm:w-52 h-40 sm:h-32 flex-shrink-0 rounded-xl overflow-hidden bg-background">
                      {isValidImageSrc(post.featuredImage) ? (
                        <Image
                          src={post.featuredImage}
                          alt={post.featuredImageAlt || post.title}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-brand-orange-deep/20 to-brand-orange/20 flex items-center justify-center">
                          <span className="text-caption text-xs">No Image</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 flex flex-col">
                      {post.categories?.[0] && (
                        <span className="text-xs font-semibold text-brand-orange-deep dark:text-brand-orange-light mb-1.5">
                          {post.categories[0].name}
                        </span>
                      )}
                      <h3 className="text-lg font-bold text-foreground mb-1.5 line-clamp-2 group-hover:text-brand-orange-deep dark:group-hover:text-brand-orange-light transition-colors">
                        {post.title}
                      </h3>
                      <p className="text-muted text-sm mb-3 line-clamp-2 flex-1">
                        {post.excerpt || "Click to read more about this topic."}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted">
                        <div className="flex items-center gap-1.5">
                          <User size={14} />
                          <span>{post.author?.name || "TBJ Partners"}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar size={14} />
                          <span>{formatDate(post.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </div>
  );
}
