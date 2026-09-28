/**
 * Placeholder services shown when no AgencyService rows exist in the database yet.
 * Shared between the homepage services section and the /services/[slug] detail
 * page so links always resolve to something, even before an admin has added
 * real services.
 */
export const fallbackServices = [
  {
    id: "web-design",
    slug: "web-design",
    iconName: "Globe",
    title: "Web Design & Development",
    subtitle: "Conversion-focused websites",
    description:
      "Custom-built, mobile-first websites designed to convert visitors into customers. Fast, SEO-optimized, and built with modern frameworks.",
    content: null as string | null,
    features: JSON.stringify([
      { icon: "Monitor", text: "Responsive Design" },
      { icon: "Palette", text: "UI/UX Excellence" },
      { icon: "Code2", text: "Next.js & React" },
      { icon: "Zap", text: "Performance Optimized" },
    ]),
    gradient: "from-brand-orange-deep to-brand-orange",
    bgGradient: "from-brand-orange/10 to-brand-orange/10",
    shadowColor: "shadow-brand-orange/20",
    statValue: "98%",
    statLabel: "PageSpeed Score",
  },
  {
    id: "smm",
    slug: "smm",
    iconName: "Share2",
    title: "Social Media Marketing",
    subtitle: "Build your community",
    description:
      "Strategic social media management across all major platforms. Content creation, community engagement, and paid social campaigns that drive real results.",
    content: null as string | null,
    features: JSON.stringify([
      { icon: "Users", text: "Community Growth" },
      { icon: "MessageSquare", text: "Content Strategy" },
      { icon: "Megaphone", text: "Paid Social Ads" },
      { icon: "TrendingUp", text: "Analytics & Insights" },
    ]),
    gradient: "from-charcoal to-off-black",
    bgGradient: "from-charcoal/10 to-off-black/10",
    shadowColor: "shadow-charcoal/20",
    statValue: "2.5M+",
    statLabel: "Monthly Reach",
  },
];
