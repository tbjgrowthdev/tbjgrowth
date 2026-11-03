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

// ---- Single post page ----
// All of the post page's copy lives here, including the sidebar call-to-action,
// so it can be edited in one place.
export type PostStrings = {
  backToBlog: string;
  readTime: string; // {n}
  copyLink: string;
  linkCopied: string;
  shareLinkedIn: string;
  shareX: string;
  share: string;
  onThisPage: string;
  contentsLabel: string;
  writtenBy: string;
  authorRole: string;
  authorBio: string;
  ctaTitle: string;
  ctaBody: string;
  ctaButton: string;
  tags: string;
  keepReading: string;
  viewAll: string;
  typeBlog: string;
  readingProgress: string;
};

const postEn: PostStrings = {
  backToBlog: "Back to Blog",
  readTime: "{n} min read",
  copyLink: "Copy link",
  linkCopied: "Link copied",
  shareLinkedIn: "Share on LinkedIn",
  shareX: "Share on X",
  share: "Share",
  onThisPage: "On this page",
  contentsLabel: "Table of contents",
  writtenBy: "Written by",
  authorRole: "Growth Expert",
  authorBio: "Expert in B2B SaaS growth, technical SEO, and scaling recurring revenue.",
  ctaTitle: "Want results like this for your SaaS?",
  ctaBody: "Book a free growth strategy call and see where your quickest wins are.",
  ctaButton: "Book a free call",
  tags: "Tags",
  keepReading: "Keep reading",
  viewAll: "View all posts",
  typeBlog: "Blog",
  readingProgress: "Reading progress",
};

const postBn: PostStrings = {
  ...postEn,
  backToBlog: "ব্লগে ফিরে যান",
  readTime: "{n} মিনিট পড়া",
  copyLink: "লিংক কপি করুন",
  linkCopied: "লিংক কপি হয়েছে",
  shareLinkedIn: "লিংকডইনে শেয়ার করুন",
  shareX: "এক্সে শেয়ার করুন",
  share: "শেয়ার",
  onThisPage: "এই পাতায়",
  contentsLabel: "সূচিপত্র",
  writtenBy: "লিখেছেন",
  authorRole: "গ্রোথ বিশেষজ্ঞ",
  authorBio: "B2B SaaS গ্রোথ, টেকনিক্যাল এসইও এবং রিকারিং রেভিনিউ বাড়ানোর বিশেষজ্ঞ।",
  ctaTitle: "আপনার SaaS-এর জন্য এমন ফলাফল চান?",
  ctaBody: "একটি বিনামূল্যের গ্রোথ স্ট্র্যাটেজি কল বুক করুন এবং দেখুন কোথায় দ্রুত সুফল পাওয়া যাবে।",
  ctaButton: "বিনামূল্যে কল বুক করুন",
  tags: "ট্যাগ",
  keepReading: "আরও পড়ুন",
  viewAll: "সব পোস্ট দেখুন",
  typeBlog: "ব্লগ",
  readingProgress: "পড়ার অগ্রগতি",
};

const postAr: PostStrings = {
  ...postEn,
  backToBlog: "العودة إلى المدونة",
  readTime: "{n} دقيقة قراءة",
  copyLink: "نسخ الرابط",
  linkCopied: "تم نسخ الرابط",
  shareLinkedIn: "المشاركة على لينكدإن",
  shareX: "المشاركة على X",
  share: "مشاركة",
  onThisPage: "في هذه الصفحة",
  contentsLabel: "جدول المحتويات",
  writtenBy: "بقلم",
  authorRole: "خبير نمو",
  authorBio: "خبير في نمو شركات SaaS للأعمال، وتحسين محركات البحث التقني، وزيادة الإيرادات المتكررة.",
  ctaTitle: "هل تريد نتائج مثل هذه لشركتك؟",
  ctaBody: "احجز مكالمة استراتيجية مجانية للنمو واكتشف أين تكمن أسرع المكاسب.",
  ctaButton: "احجز مكالمة مجانية",
  tags: "الوسوم",
  keepReading: "تابع القراءة",
  viewAll: "عرض كل المقالات",
  typeBlog: "المدونة",
  readingProgress: "تقدم القراءة",
};

export function getPostStrings(locale: LocaleConfig): PostStrings {
  return locale.language === "bn" ? postBn : locale.language === "ar" ? postAr : postEn;
}
