import { getPageMetadata } from "@/lib/seo-meta";
import BookACallClient from "./BookACallClient";

export async function generateMetadata() {
  return getPageMetadata("book-a-call", {
    title: "Book a Conversation | TBJ Growth",
    description: "Pick a time that works for you and book a free growth strategy call with TBJ Growth Tech.",
    path: "/book-a-call",
  });
}

export default async function BookACallPage() {
  return <BookACallClient />;
}
