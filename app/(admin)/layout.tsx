import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getCurrentAdmin } from "@/app/(admin)/actions/profile";
import { LayoutDashboard, Blocks, FileText, FileEdit, LineChart, Settings, Briefcase, BrainCircuit, ShieldAlert, UserCircle, Tag, Folder, Route, Target, CalendarClock, HelpCircle, History, Images, Link2Off, Search as SearchIcon, ArrowDownUp, Languages, Activity, BookOpen, Sparkles, RefreshCw, Lightbulb, Copy, HeartPulse, Globe2, Download, TrendingUp, ClipboardCheck, Unlink, Network, Layers, MapPin, FileStack, FlaskConical, GitCompare, Stethoscope, Plug, Zap, BarChart3, Gauge, Wrench, CircleDollarSign, Handshake, Inbox, Star } from "lucide-react";
import { LogoutButton } from "@/components/Admin/LogoutButton";
import ThemeToggle from "@/components/Admin/ThemeToggle";
import VisitSiteMenu from "@/components/Admin/VisitSiteMenu";
import { AdminSidebarProvider, SidebarFrame, SidebarToggle } from "@/components/Admin/AdminSidebar";
import { NavItem, SidebarCollapseButton, TopSearch } from "@/components/Admin/AdminNav";
import { Toaster } from "@/components/Admin/Toast";
import { isValidImageSrc } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";
import "../admin.css";

// Applies to every /admin/* route via metadata inheritance — the whole admin
// dashboard is behind auth and must never appear in search results.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type NavEntry = { href: string; label: string; icon: React.ComponentType<{ size?: number }>; show?: boolean; sub?: boolean };
type NavGroup = { title: string; items: NavEntry[] };

// Runs before first paint so a collapsed sidebar never flashes open (see app/admin.css).
const SIDEBAR_INIT = `try{if(localStorage.getItem("tbj-admin-sidebar")==="collapsed")document.documentElement.dataset.sb="collapsed"}catch(e){}`;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentAdmin = await getCurrentAdmin();
  const userName = currentAdmin?.name || "Admin";
  const userImage = currentAdmin?.image;
  const role = currentAdmin?.role;
  // Was a literal role === "ADMIN" check before SUPER_ADMIN/SEO_MANAGER
  // existed — that excluded Super Admins from this whole nav section and
  // SEO Managers from the SEO tools that are actually their domain.
  const canManageUsers = hasPermission(role, "USER_MANAGEMENT");
  const canManageSeo = hasPermission(role, "SEO_MANAGEMENT");
  const canManageSettings = hasPermission(role, "SETTINGS_MANAGEMENT");
  const canManageIntegrations = hasPermission(role, "INTEGRATION_MANAGEMENT");
  const canManageMedia = hasPermission(role, "MEDIA_MANAGEMENT");
  const canManagePricing = hasPermission(role, "PRICING_MANAGEMENT");
  const canExport = hasPermission(role, "EXPORT");
  const canTranslate = hasPermission(role, "EDIT");
  const canCreateContent = hasPermission(role, "CREATE");

  const seoItems: NavEntry[] = [
    { href: "/admin/seo", label: "SEO & Analytics", icon: LineChart },
    { href: "/admin/redirects", label: "Redirects", icon: Route },
    { href: "/admin/keywords", label: "Keyword Tracking", icon: Target },
    { href: "/admin/link-monitor", label: "Link Monitor", icon: Link2Off },
    { href: "/admin/seo-audits", label: "Automated SEO Audits", icon: ClipboardCheck },
    { href: "/admin/orphan-pages", label: "Orphan Page Detection", icon: Unlink },
    { href: "/admin/link-graph", label: "Internal Link Graph", icon: Network },
    { href: "/admin/topic-clusters", label: "Topic Clusters", icon: Layers },
    { href: "/admin/programmatic-seo", label: "Programmatic SEO", icon: FileStack },
    { href: "/admin/seo-experiments", label: "SEO Experiments", icon: FlaskConical },
    { href: "/admin/seo-change-log", label: "SEO Change Impact", icon: GitCompare },
    { href: "/admin/gsc-import", label: "Search Console Import", icon: Download },
    { href: "/admin/ga4-import", label: "GA4 Analytics Integration", icon: TrendingUp },
  ].map((item) => ({ ...item, show: canManageSeo }));

  const groups: NavGroup[] = [
    {
      title: "Overview",
      items: [
        { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
        { href: "/admin/search", label: "Search", icon: SearchIcon },
      ],
    },
    {
      title: "Content",
      items: [
        { href: "/admin/pages", label: "Pages", icon: FileText },
        { href: "/admin/blocks", label: "Reusable Blocks", icon: Blocks, sub: true },
        { href: "/admin/posts", label: "Blog Posts", icon: FileEdit },
        { href: "/admin/categories", label: "Categories", icon: Folder, sub: true },
        { href: "/admin/tags", label: "Tags", icon: Tag, sub: true },
        { href: "/admin/cases", label: "Case Studies", icon: Briefcase },
        { href: "/admin/locations", label: "Locations", icon: MapPin },
        { href: "/admin/services", label: "Services", icon: Wrench },
        { href: "/admin/pricing", label: "Pricing", icon: CircleDollarSign, show: canManagePricing },
        { href: "/admin/testimonials", label: "Testimonials", icon: Star },
        { href: "/admin/partners", label: "Partners", icon: Handshake },
        { href: "/admin/faqs", label: "FAQ", icon: HelpCircle },
        { href: "/admin/systems", label: "TBJ Systems", icon: BrainCircuit },
        { href: "/admin/media", label: "Media Library", icon: Images, show: canManageMedia },
        { href: "/admin/translations", label: "Translations", icon: Languages, show: canTranslate },
      ],
    },
    {
      title: "Intelligence",
      items: [
        { href: "/admin/ai-pipeline", label: "AI Content Pipeline", icon: Sparkles, show: canCreateContent },
        { href: "/admin/content-refresh", label: "Content Refresh", icon: RefreshCw, show: canTranslate },
        { href: "/admin/content-recommendations", label: "Content Recommendations", icon: Lightbulb, show: canTranslate },
        { href: "/admin/content-cannibalization", label: "Content Cannibalization", icon: Copy, show: canTranslate },
        { href: "/admin/content-health", label: "Content Health Score", icon: HeartPulse, show: canTranslate },
        { href: "/admin/seo-performance-feedback", label: "SEO Performance Feedback", icon: Stethoscope, show: canTranslate },
        { href: "/admin/automation", label: "Automation Engine", icon: Zap, show: canTranslate },
        { href: "/admin/canonical-hreflang", label: "Canonical & Hreflang", icon: Globe2, show: canTranslate },
      ],
    },
    {
      title: "Leads",
      items: [
        { href: "/admin/booking", label: "Booking", icon: CalendarClock },
        { href: "/admin/leads", label: "Leads", icon: Inbox, show: canManageUsers },
      ],
    },
    { title: "SEO", items: seoItems },
    {
      title: "System",
      items: [
        { href: "/admin/monitoring", label: "Monitoring", icon: Activity, show: canManageSettings },
        { href: "/admin/observability", label: "Observability", icon: Gauge, show: canManageSettings },
        { href: "/admin/brand-kb", label: "Brand Knowledge Base", icon: BookOpen, show: canManageSettings },
        { href: "/admin/settings", label: "Settings", icon: Settings, show: canManageSettings },
        { href: "/admin/executive-analytics", label: "Executive Analytics", icon: BarChart3, show: canManageSettings },
        { href: "/admin/integrations", label: "Integration Hub", icon: Plug, show: canManageIntegrations },
        { href: "/admin/import-export", label: "Import / Export", icon: ArrowDownUp, show: canExport },
      ],
    },
    {
      title: "Account",
      items: [
        { href: "/admin/profile", label: "My Profile", icon: UserCircle },
        { href: "/admin/admins", label: "Team Members", icon: ShieldAlert, show: canManageUsers },
        { href: "/admin/audit-log", label: "Audit Log", icon: History, show: canManageUsers },
      ],
    },
  ];

  return (
    <AdminSidebarProvider>
    <script dangerouslySetInnerHTML={{ __html: SIDEBAR_INIT }} />
    {/* `relative` makes this the containing block for anything position:absolute inside the admin (sr-only inputs,
        dropdown panels, ...). Without it such elements resolve against the page itself, escape this overflow-hidden clip
        and stretch the document, which shows up as an extra scrollbar and the whole layout scrolling up with a blank
        strip below. `h-dvh` tracks the visible viewport on mobile, where 100vh is taller than the screen. */}
    <div className="admin-shell relative h-dvh bg-background flex overflow-hidden">
      {/* Sidebar — pinned to the viewport; only its own nav list scrolls if it's
          taller than the screen, independently of the main content below. */}
      <SidebarFrame>
        <div className="flex-shrink-0 px-5 pt-5 pb-3">
          <Link href="/admin" aria-label="TBJ Growth Tech admin home" className="block w-fit rounded-2xl">
            {/* The logo is never recolored: it always sits on a white tile so it stays legible in dark mode. */}
            <span className="admin-brand-wide inline-flex items-center rounded-2xl bg-white px-3 py-2 ring-1 ring-[var(--border-c)]">
              <Image src="/primarylogo.png" alt="TBJ Growth Tech" width={1000} height={200} priority className="h-8 w-auto" />
            </span>
            <span className="admin-brand-mark h-11 w-11 overflow-hidden rounded-2xl bg-white ring-1 ring-[var(--border-c)]">
              <Image src="/primarylogo.png" alt="TBJ Growth Tech" width={1000} height={200} priority className="h-11 w-auto max-w-none" />
            </span>
          </Link>
          <div className="admin-brand-tag mt-1.5 flex justify-end pr-1">
            <span className="eyebrow rounded-full border border-border px-2 py-0.5 !text-[0.625rem]">Admin</span>
          </div>
        </div>
        <nav aria-label="Admin" className="flex-1 overflow-y-auto scrollbar-thin px-4 pb-4 pt-2">
          {groups.map((group) => {
            const items = group.items.filter((i) => i.show !== false);
            if (items.length === 0) return null;
            return (
              <div key={group.title} className="admin-nav-group">
                <p className="eyebrow admin-nav-title">
                  <span>{group.title}</span>
                </p>
                <div className="space-y-0.5">
                  {items.map(({ href, label, icon: Icon, sub }) => (
                    <NavItem key={href} href={href} sub={sub} icon={<Icon size={sub ? 15 : 18} />}>
                      {label}
                    </NavItem>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="flex-shrink-0 space-y-0.5 border-t border-border px-4 py-3">
          <SidebarCollapseButton />
          <LogoutButton />
        </div>
      </SidebarFrame>

      {/* Main Content — its own scroll region, independent of the sidebar's. */}
      <main className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Top Navbar — stays pinned above the scrolling content. */}
        <header className="flex-shrink-0 bg-card/90 backdrop-blur border-b border-border flex items-center gap-3 px-4 sm:px-5 py-3">
          <SidebarToggle />
          <TopSearch />
          <div className="ml-auto flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <VisitSiteMenu />
            <ThemeToggle />
            <Link href="/admin/profile" className="avatar-ring" title={`My Profile (${userName})`} aria-label={`My Profile (${userName})`}>
              {isValidImageSrc(userImage) ? (
                <Image src={userImage} alt="" fill className="object-cover" />
              ) : (
                <span aria-hidden="true">{userName.charAt(0).toUpperCase()}</span>
              )}
            </Link>
          </div>
        </header>

        {/* Page Content */}
        {/* `relative`: absolute descendants are positioned (and clipped/scrolled) inside this region, not against the page. */}
        <div className="admin-canvas relative flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-5 lg:p-6">
          {children}
        </div>
      </main>
    </div>
    <Toaster />
    </AdminSidebarProvider>
  );
}
