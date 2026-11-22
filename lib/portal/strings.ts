// Client Hub copy, English and Bangla. Every user-visible portal string lives
// here; pages pick the table with portalStrings(ctx.language).
//
// Keep both tables in step: the type of `bn` is the type of `en`, so a key
// missing from either is a compile error.

const en = {
  appName: "TBJ Client Hub",
  brand: "TBJ Growth Tech",
  tabs: { home: "Home", projects: "Projects", reports: "Reports", billing: "Billing", more: "More" },
  login: {
    eyebrow: "For TBJ clients",
    title: "Sign in",
    intro: "Enter the email your account manager invited. We'll email you a 6-digit code.",
    emailLabel: "Email address",
    emailPlaceholder: "you@company.com",
    sendCode: "Email me a code",
    codeSentTo: "If {email} has a client account, a code is on its way. It expires in 10 minutes.",
    codeLabel: "6-digit code",
    verify: "Sign in",
    resend: "Send a new code",
    changeEmail: "Use a different email",
    working: "Please wait…",
    genericError: "Something went wrong. Please try again.",
    inviteOnly: "Accounts are by invitation only. Ask your TBJ account manager if you need access.",
    switchLanguage: "বাংলা",
  },
  home: {
    title: "Home",
    welcome: "Welcome",
    emptyTitle: "Nothing here yet",
    emptyBody: "When your team starts a project, its progress, updates and requests for approval appear here.",
  },
  signOut: "Sign out",
} as const;

type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };
export type PortalStrings = Widen<typeof en>;

const bn: PortalStrings = {
  appName: "TBJ ক্লায়েন্ট হাব",
  brand: "TBJ Growth Tech",
  tabs: { home: "হোম", projects: "প্রজেক্ট", reports: "রিপোর্ট", billing: "বিল", more: "আরও" },
  login: {
    eyebrow: "TBJ-র ক্লায়েন্টদের জন্য",
    title: "সাইন ইন",
    intro: "অ্যাকাউন্ট ম্যানেজার যে ইমেইলে আমন্ত্রণ পাঠিয়েছেন সেটি লিখুন। আমরা ৬ অঙ্কের একটি কোড ইমেইল করব।",
    emailLabel: "ইমেইল ঠিকানা",
    emailPlaceholder: "you@company.com",
    sendCode: "কোড পাঠান",
    codeSentTo: "{email} যদি ক্লায়েন্ট অ্যাকাউন্ট হয়, কোড পাঠানো হয়েছে। মেয়াদ ১০ মিনিট।",
    codeLabel: "৬ অঙ্কের কোড",
    verify: "সাইন ইন",
    resend: "নতুন কোড পাঠান",
    changeEmail: "অন্য ইমেইল দিন",
    working: "অপেক্ষা করুন…",
    genericError: "কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।",
    inviteOnly: "শুধু আমন্ত্রণে অ্যাকাউন্ট খোলা হয়। দরকার হলে আপনার TBJ অ্যাকাউন্ট ম্যানেজারকে জানান।",
    switchLanguage: "English",
  },
  home: {
    title: "হোম",
    welcome: "স্বাগতম",
    emptyTitle: "এখনও কিছু নেই",
    emptyBody: "আপনার টিম প্রজেক্ট শুরু করলে তার অগ্রগতি, আপডেট ও অনুমোদনের অনুরোধ এখানে দেখা যাবে।",
  },
  signOut: "সাইন আউট",
};

export type PortalLanguage = "en" | "bn";

export function portalStrings(language: PortalLanguage | string | null | undefined): PortalStrings {
  return language === "bn" ? bn : en;
}

/** Replaces {name} placeholders. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? values[k] : m));
}
