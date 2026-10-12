import { getPageMetadata } from "@/lib/seo-meta";
import { resolveRouteLocale } from "@/lib/i18n";
import BookACallClient from "./BookACallClient";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale = resolveRouteLocale(localeParam);
  return getPageMetadata("book-a-call", {
    title: "Book a Conversation | TBJ Growth",
    description: "Pick a time that works for you and book a free growth strategy call with TBJ Growth Tech.",
    path: "/book-a-call",
  }, locale?.code);
}

export default async function BookACallPage() {
  return <BookACallClient />;
}
