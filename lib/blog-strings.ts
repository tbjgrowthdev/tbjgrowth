import type { LocaleConfig } from "@/lib/i18n";

// UI copy for the blog listing, keyed by language. The rest of the public
// site is English-only, so these live next to the feature rather than in a
// site-wide dictionary. Plural forms follow Intl.PluralRules categories.
type Plural = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

export type BlogStrings = {
  pill: string;
  titleLead: string;
  titleAccent: string;
  subtitle: string;
  searchLabel: string;
  searchPlaceholder: string;
  filterLabel: string;
  all: string;
  featured: string;
  readArticle: string;
  allArticles: string;
  showing: Plural; // {n} = formatted count
  readTime: string; // {n}
  loadMore: string;
  showingOf: string; // {shown} {total}
  emptyTitle: string;
  emptyBody: string;
  noPostsTitle: string;
  noPostsBody: string;
  clearFilters: string;
  defaultExcerpt: string;
  defaultAuthor: string;
  newsletterTitle: string;
  newsletterBody: string;
  subscribe: string;
  emailLabel: string;
  emailPlaceholder: string;
  subscribed: string;
};

const en: BlogStrings = {
  pill: "The TBJ Blog",
  titleLead: "Latest",
  titleAccent: "Insights & Strategies",
  subtitle:
    "Actionable, data-driven SEO and growth techniques to lift search rankings, drive high-intent traffic and lower acquisition costs.",
  searchLabel: "Search articles",
  searchPlaceholder: "Search articles...",
  filterLabel: "Filter by category",
  all: "All",
  featured: "Featured",
  readArticle: "Read article",
  allArticles: "All articles",
  showing: { one: "Showing {n} article", other: "Showing {n} articles" },
  readTime: "{n} min read",
  loadMore: "Load more articles",
  showingOf: "Showing {shown} of {total}",
  emptyTitle: "No articles found",
  emptyBody: "Try a different search or category to find what you're looking for.",
  noPostsTitle: "No articles yet",
  noPostsBody: "We're working on new content. Please check back soon.",
  clearFilters: "Clear filters",
  defaultExcerpt: "Click to read more about this topic.",
  defaultAuthor: "TBJ Partners",
  newsletterTitle: "Get growth tips in your inbox",
  newsletterBody: "Practical growth and AI insights from the TBJ team, no spam.",
  subscribe: "Subscribe",
  emailLabel: "Email address",
  emailPlaceholder: "Enter your email",
  subscribed: "Thanks for subscribing!",
};

const bn: BlogStrings = {
  ...en,
  pill: "টিবিজে ব্লগ",
  titleLead: "সর্বশেষ",
  titleAccent: "অন্তর্দৃষ্টি ও কৌশল",
  subtitle: "সার্চ র‍্যাঙ্কিং বাড়াতে, উচ্চ-আগ্রহী ট্রাফিক আনতে এবং গ্রাহক অর্জন খরচ কমাতে কার্যকর ও তথ্যভিত্তিক কৌশল।",
  searchLabel: "নিবন্ধ খুঁজুন",
  searchPlaceholder: "নিবন্ধ খুঁজুন...",
  filterLabel: "বিভাগ অনুযায়ী ফিল্টার",
  all: "সব",
  featured: "বিশেষ",
  readArticle: "নিবন্ধ পড়ুন",
  allArticles: "সব নিবন্ধ",
  showing: { one: "{n}টি নিবন্ধ দেখানো হচ্ছে", other: "{n}টি নিবন্ধ দেখানো হচ্ছে" },
  readTime: "{n} মিনিট পড়া",
  loadMore: "আরও নিবন্ধ দেখুন",
  showingOf: "{total}টির মধ্যে {shown}টি দেখানো হচ্ছে",
  emptyTitle: "কোনো নিবন্ধ পাওয়া যায়নি",
  emptyBody: "অন্য কোনো শব্দ বা বিভাগ দিয়ে চেষ্টা করুন।",
  noPostsTitle: "এখনও কোনো নিবন্ধ নেই",
  noPostsBody: "আমরা নতুন কন্টেন্ট তৈরি করছি। শীঘ্রই আবার দেখুন।",
  clearFilters: "ফিল্টার মুছুন",
  defaultExcerpt: "এই বিষয়ে আরও জানতে ক্লিক করুন।",
  newsletterTitle: "আপনার ইনবক্সে গ্রোথ টিপস পান",
  newsletterBody: "টিবিজে টিমের কাছ থেকে কার্যকর গ্রোথ ও এআই অন্তর্দৃষ্টি, কোনো স্প্যাম নয়।",
  subscribe: "সাবস্ক্রাইব",
  emailLabel: "ইমেইল ঠিকানা",
  emailPlaceholder: "আপনার ইমেইল লিখুন",
  subscribed: "সাবস্ক্রাইব করার জন্য ধন্যবাদ!",
};

const ar: BlogStrings = {
  ...en,
  pill: "مدونة TBJ",
  titleLead: "أحدث",
  titleAccent: "الرؤى والاستراتيجيات",
  subtitle: "تقنيات عملية قائمة على البيانات لتحسين ترتيب البحث وجذب زيارات عالية الاهتمام وخفض تكلفة اكتساب العملاء.",
  searchLabel: "ابحث في المقالات",
  searchPlaceholder: "ابحث في المقالات...",
  filterLabel: "التصفية حسب الفئة",
  all: "الكل",
  featured: "مميز",
  readArticle: "اقرأ المقال",
  allArticles: "كل المقالات",
  showing: {
    zero: "لا توجد مقالات",
    one: "عرض مقال واحد",
    two: "عرض مقالين",
    few: "عرض {n} مقالات",
    many: "عرض {n} مقالًا",
    other: "عرض {n} مقال",
  },
  readTime: "{n} دقيقة قراءة",
  loadMore: "تحميل المزيد من المقالات",
  showingOf: "عرض {shown} من {total}",
  emptyTitle: "لم يتم العثور على مقالات",
  emptyBody: "جرّب بحثًا أو فئة مختلفة.",
  noPostsTitle: "لا توجد مقالات بعد",
  noPostsBody: "نعمل على محتوى جديد. يرجى العودة قريبًا.",
  clearFilters: "مسح التصفية",
  defaultExcerpt: "انقر لقراءة المزيد حول هذا الموضوع.",
  newsletterTitle: "احصل على نصائح النمو في بريدك",
  newsletterBody: "رؤى عملية للنمو والذكاء الاصطناعي من فريق TBJ، دون رسائل مزعجة.",
  subscribe: "اشترك",
  emailLabel: "البريد الإلكتروني",
  emailPlaceholder: "أدخل بريدك الإلكتروني",
  subscribed: "شكرًا لاشتراكك!",
};

export function getBlogStrings(locale: LocaleConfig): BlogStrings {
  return locale.language === "bn" ? bn : locale.language === "ar" ? ar : en;
}

export function formatCount(strings: Plural, count: number, localeCode: string) {
  const rule = new Intl.PluralRules(localeCode).select(count);
  const template = strings[rule] ?? strings.other;
  return template.replace("{n}", new Intl.NumberFormat(localeCode).format(count));
}
