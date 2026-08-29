"use client";

import Link from 'next/link'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { logNotFound } from '@/app/(admin)/actions/seo'

export default function NotFound() {
  const pathname = usePathname();

  useEffect(() => {
    // Log the 404 error to the database
    if (pathname) {
      logNotFound(pathname);
    }
  }, [pathname]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 bg-background">
      <h2 className="text-4xl font-bold text-foreground mb-4">404 - Page Not Found</h2>
      <p className="text-muted mb-8 max-w-md">
        The page you are looking for doesn't exist or has been moved. Our team has been notified.
      </p>
      <Link 
        href="/"
        className="px-6 py-3 bg-brand-orange text-white rounded-lg font-medium hover:bg-brand-orange-deep transition-colors"
      >
        Return Home
      </Link>
    </div>
  )
}
