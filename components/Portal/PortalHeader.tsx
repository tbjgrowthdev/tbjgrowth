import Image from "next/image";
import Link from "next/link";

// Top bar of the signed-in portal. The logo goes to the portal home, never to
// the public website (the client app has no public pages).
export default function PortalHeader({ title, brand }: { title: string; brand: string }) {
  return (
    <header className="portal-header">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
        <Link href="/portal" className="flex shrink-0 items-center" aria-label={brand}>
          <Image src="/primarylogo.png" alt={brand} width={1000} height={200} sizes="120px" priority className="h-7 w-auto dark:hidden" />
          <Image src="/primary-logo-dark.png" alt={brand} width={1000} height={200} sizes="120px" priority className="hidden h-7 w-auto dark:block" />
        </Link>
        <span className="ml-auto truncate text-sm font-semibold text-muted">{title}</span>
      </div>
    </header>
  );
}
