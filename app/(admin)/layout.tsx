import Link from "next/link";
import Image from "next/image";
import { getCurrentAdmin } from "@/app/(admin)/actions/profile";
import { LayoutDashboard, FileText, FileEdit, LineChart, Settings, Briefcase, Users, Star, BrainCircuit, ShieldAlert, UserCircle, Tag, Folder, Route, Target, CalendarClock } from "lucide-react";
import { LogoutButton } from "@/components/Admin/LogoutButton";
import { isValidImageSrc } from "@/lib/utils";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentAdmin = await getCurrentAdmin();
  const userName = currentAdmin?.name || "Admin";
  const userImage = currentAdmin?.image;
  const isAdmin = currentAdmin?.role === "ADMIN";

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <span className="text-xl font-bold text-foreground">TBJ Admin</span>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1">
          <Link href="/admin" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
            <LayoutDashboard size={20} />
            Dashboard
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
          <Link href="/admin/systems" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
            <BrainCircuit size={20} />
            TBJ Systems
          </Link>
          <Link href="/admin/booking" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
            <CalendarClock size={20} />
            Booking
          </Link>
          {isAdmin && (
            <>
              <Link href="/admin/leads" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
                <FileText size={20} />
                Leads
              </Link>
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
              <Link href="/admin/settings" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
                <Settings size={20} />
                Settings
              </Link>
            </>
          )}
          <div className="pt-4 mt-4 border-t border-border space-y-1">
            <Link href="/admin/profile" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
              <UserCircle size={20} />
              My Profile
            </Link>
            {isAdmin && (
              <Link href="/admin/admins" className="flex items-center gap-3 px-3 py-2 text-muted hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light rounded-md transition-colors">
                <ShieldAlert size={20} />
                Team Members
              </Link>
            )}
            <LogoutButton />
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Top Navbar */}
        <header className="h-16 bg-card border-b border-border flex items-center px-6 justify-between">
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
        <div className="flex-1 p-6 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
