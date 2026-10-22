import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getCurrentAdmin } from "@/app/(admin)/actions/profile";
import { LayoutDashboard, FileText, FileEdit, LineChart, Settings, Briefcase, Users, Star, BrainCircuit, ShieldAlert, UserCircle, Tag, Folder, Route, Target, CalendarClock, HelpCircle, History, Images, Link2Off, Search as SearchIcon, ArrowDownUp, Languages, Activity, BookOpen, Sparkles, RefreshCw, Lightbulb, Copy, HeartPulse, Globe2, Download, TrendingUp, ClipboardCheck, Unlink, Network, Layers, MapPin, FileStack, FlaskConical, GitCompare, Stethoscope, Plug, Zap, BarChart3, Gauge } from "lucide-react";
import { LogoutButton } from "@/components/Admin/LogoutButton";
import { isValidImageSrc } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";

// Applies to every /admin/* route via metadata inheritance — the whole admin
// dashboard is behind auth and must never appear in search results.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

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
  const canExport = hasPermission(role, "EXPORT");
  const canTranslate = hasPermission(role, "EDIT");
  const canCreateContent = hasPermission(role, "CREATE");

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Sidebar — pinned to the viewport; only its own nav list scrolls if it's
          taller than the screen, independently of the main content below. */}
      <aside className="w-64 flex-shrink-0 bg-card border-r border-border flex flex-col h-full">
        <div className="h-16 flex-shrink-0 flex items-center px-6 border-b border-border">
          <span className="text-xl font-bold text-foreground">TBJ Admin</span>
        </div>
        <nav className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-1">
          <Link href="/admin" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
            <LayoutDashboard size={20} />
            Dashboard
          </Link>
          <Link href="/admin/search" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
            <SearchIcon size={20} />
            Search
          </Link>
          <Link href="/admin/pages" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
            <FileText size={20} />
            Pages
          </Link>
          <Link href="/admin/posts" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
            <FileEdit size={20} />
            Blog Posts
          </Link>
          <Link href="/admin/categories" className="flex items-center gap-3 pl-9 pr-3 py-1.5 text-sm text-caption hover:bg-tint rounded-md transition-colors">
            <Folder size={16} />
            Categories
          </Link>
          <Link href="/admin/tags" className="flex items-center gap-3 pl-9 pr-3 py-1.5 text-sm text-caption hover:bg-tint rounded-md transition-colors">
            <Tag size={16} />
            Tags
          </Link>
          <Link href="/admin/cases" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
            <Briefcase size={20} />
            Case Studies
          </Link>
          <Link href="/admin/locations" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
            <MapPin size={20} />
            Locations
          </Link>
          <Link href="/admin/services" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
            <LayoutDashboard size={20} />
            Services
          </Link>
          <Link href="/admin/pricing" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
            <Tag size={20} />
            Pricing
          </Link>
          <Link href="/admin/testimonials" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
            <Star size={20} />
            Testimonials
          </Link>
          <Link href="/admin/partners" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
            <Users size={20} />
            Partners
          </Link>
          {canManageMedia && (
            <Link href="/admin/media" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
              <Images size={20} />
              Media Library
            </Link>
          )}
          {canTranslate && (
            <Link href="/admin/translations" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
              <Languages size={20} />
              Translations
            </Link>
          )}
          {canCreateContent && (
            <Link href="/admin/ai-pipeline" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
              <Sparkles size={20} />
              AI Content Pipeline
            </Link>
          )}
          {canTranslate && (
            <Link href="/admin/content-refresh" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
              <RefreshCw size={20} />
              Content Refresh
            </Link>
          )}
          {canTranslate && (
            <Link href="/admin/content-recommendations" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
              <Lightbulb size={20} />
              Content Recommendations
            </Link>
          )}
          {canTranslate && (
            <Link href="/admin/content-cannibalization" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
              <Copy size={20} />
              Content Cannibalization
            </Link>
          )}
          {canTranslate && (
            <Link href="/admin/content-health" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
              <HeartPulse size={20} />
              Content Health Score
            </Link>
          )}
          {canTranslate && (
            <Link href="/admin/seo-performance-feedback" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
              <Stethoscope size={20} />
              SEO Performance Feedback
            </Link>
          )}
          {canTranslate && (
            <Link href="/admin/automation" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
              <Zap size={20} />
              Automation Engine
            </Link>
          )}
          {canTranslate && (
            <Link href="/admin/canonical-hreflang" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
              <Globe2 size={20} />
              Canonical &amp; Hreflang
            </Link>
          )}
          <Link href="/admin/faqs" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
            <HelpCircle size={20} />
            FAQ
          </Link>
          <Link href="/admin/systems" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
            <BrainCircuit size={20} />
            TBJ Systems
          </Link>
          <Link href="/admin/booking" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
            <CalendarClock size={20} />
            Booking
          </Link>
          {canManageUsers && (
            <Link href="/admin/leads" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
              <FileText size={20} />
              Leads
            </Link>
          )}
          {canManageSeo && (
            <>
              <Link href="/admin/seo" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
                <LineChart size={20} />
                SEO & Analytics
              </Link>
              <Link href="/admin/redirects" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
                <Route size={20} />
                Redirects
              </Link>
              <Link href="/admin/keywords" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
                <Target size={20} />
                Keyword Tracking
              </Link>
              <Link href="/admin/link-monitor" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
                <Link2Off size={20} />
                Link Monitor
              </Link>
              <Link href="/admin/seo-audits" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
                <ClipboardCheck size={20} />
                Automated SEO Audits
              </Link>
              <Link href="/admin/orphan-pages" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
                <Unlink size={20} />
                Orphan Page Detection
              </Link>
              <Link href="/admin/link-graph" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
                <Network size={20} />
                Internal Link Graph
              </Link>
              <Link href="/admin/topic-clusters" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
                <Layers size={20} />
                Topic Clusters
              </Link>
              <Link href="/admin/programmatic-seo" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
                <FileStack size={20} />
                Programmatic SEO
              </Link>
              <Link href="/admin/seo-experiments" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
                <FlaskConical size={20} />
                SEO Experiments
              </Link>
              <Link href="/admin/seo-change-log" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
                <GitCompare size={20} />
                SEO Change Impact
              </Link>
              <Link href="/admin/gsc-import" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
                <Download size={20} />
                Search Console Import
              </Link>
              <Link href="/admin/ga4-import" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
                <TrendingUp size={20} />
                GA4 Analytics Integration
              </Link>
            </>
          )}
          {canManageSettings && (
            <>
              <Link href="/admin/monitoring" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
                <Activity size={20} />
                Monitoring
              </Link>
              <Link href="/admin/observability" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
                <Gauge size={20} />
                Observability
              </Link>
              <Link href="/admin/brand-kb" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
                <BookOpen size={20} />
                Brand Knowledge Base
              </Link>
              <Link href="/admin/settings" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
                <Settings size={20} />
                Settings
              </Link>
              <Link href="/admin/executive-analytics" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
                <BarChart3 size={20} />
                Executive Analytics
              </Link>
            </>
          )}
          {canManageIntegrations && (
            <Link href="/admin/integrations" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
              <Plug size={20} />
              Integration Hub
            </Link>
          )}
          {canExport && (
            <Link href="/admin/import-export" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
              <ArrowDownUp size={20} />
              Import / Export
            </Link>
          )}
          <div className="pt-4 mt-4 border-t border-border space-y-1">
            <Link href="/admin/profile" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
              <UserCircle size={20} />
              My Profile
            </Link>
            {canManageUsers && (
              <>
                <Link href="/admin/admins" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
                  <ShieldAlert size={20} />
                  Team Members
                </Link>
                <Link href="/admin/audit-log" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
                  <History size={20} />
                  Audit Log
                </Link>
              </>
            )}
            <LogoutButton />
          </div>
        </nav>
      </aside>

      {/* Main Content — its own scroll region, independent of the sidebar's. */}
      <main className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Top Navbar — stays pinned above the scrolling content. */}
        <header className="h-16 flex-shrink-0 bg-card border-b border-border flex items-center px-6 justify-between">
          <div className="text-sm text-caption">Welcome back, {userName}</div>
          <Link
            href="/admin/profile"
            className="relative w-8 h-8 rounded-full overflow-hidden bg-brand-orange-deep flex items-center justify-center text-white text-sm font-semibold hover:ring-2 hover:ring-brand-orange-light transition-all"
            title="My Profile"
          >
            {isValidImageSrc(userImage) ? (
              <Image src={userImage} alt={userName} fill className="object-cover" />
            ) : (
              <span>{userName.charAt(0).toUpperCase()}</span>
            )}
          </Link>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
