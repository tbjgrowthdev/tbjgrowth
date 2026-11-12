import { notFound } from "next/navigation";
import LandingPage, { generateMetadata as landingMetadata } from "../landing";

// Rendered and cached at runtime, not at build time — see the comment in
// app/landing-pages/layout.tsx. The optional catch-all matches only the bare
// URL; anything below it 404s.
export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ rest?: string[] }> };

export async function generateMetadata({ params }: Props) {
  if ((await params).rest) notFound();
  return landingMetadata();
}

export default async function Page({ params }: Props) {
  if ((await params).rest) notFound();
  return <LandingPage />;
}
