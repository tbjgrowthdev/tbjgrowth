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
    waitingOnYou: "Waiting on you",
    activeProjects: "Your projects",
    nextMeeting: "Next meeting",
    latestUpdate: "Latest update",
    seeAllProjects: "All projects",
  },
  status: { NOT_STARTED: "Not started", IN_PROGRESS: "In progress", WAITING_ON_CLIENT: "Waiting on you", COMPLETED: "Completed" },
  projects: {
    title: "Projects",
    empty: "No projects yet.",
    progress: "{n}% done",
    due: "Due {date}",
    started: "Started {date}",
    milestones: "Milestones",
    noMilestones: "No milestones yet.",
    milestoneDone: "Done {date}",
    milestoneDue: "Due {date}",
    updates: "Updates",
    noUpdates: "No updates yet. Your team will post here as work moves on.",
    automatic: "TBJ Growth Tech",
    attachment: "Download {name}",
    approvals: "Approvals",
    back: "Projects",
    notFound: "This project isn't available.",
  },
  approvals: {
    approve: "Approve",
    requestChanges: "Request changes",
    commentLabel: "What should change?",
    commentPlaceholder: "Tell your team what to change",
    send: "Send",
    cancel: "Cancel",
    pending: "Waiting for your answer",
    approved: "You approved this",
    changesRequested: "You asked for changes",
    answeredOn: "Answered {date}",
    yourComment: "Your comment",
    errors: {
      signed_out: "Please sign in again.",
      not_found: "This request isn't available any more.",
      already_answered: "This has already been answered.",
      invalid_decision: "Something went wrong. Please try again.",
      comment_required: "Please say what should change.",
      failed: "Something went wrong. Please try again.",
    },
    thanks: "Thank you. Your team has your answer.",
  },
  meetingAt: "{date} at {time}",
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
    waitingOnYou: "আপনার উত্তরের অপেক্ষায়",
    activeProjects: "আপনার প্রজেক্ট",
    nextMeeting: "পরের মিটিং",
    latestUpdate: "সর্বশেষ আপডেট",
    seeAllProjects: "সব প্রজেক্ট",
  },
  status: { NOT_STARTED: "শুরু হয়নি", IN_PROGRESS: "কাজ চলছে", WAITING_ON_CLIENT: "আপনার অপেক্ষায়", COMPLETED: "সম্পন্ন" },
  projects: {
    title: "প্রজেক্ট",
    empty: "এখনও কোনো প্রজেক্ট নেই।",
    progress: "{n}% সম্পন্ন",
    due: "শেষ তারিখ {date}",
    started: "শুরু {date}",
    milestones: "ধাপসমূহ",
    noMilestones: "এখনও কোনো ধাপ নেই।",
    milestoneDone: "সম্পন্ন {date}",
    milestoneDue: "শেষ তারিখ {date}",
    updates: "আপডেট",
    noUpdates: "এখনও কোনো আপডেট নেই। কাজ এগোলে আপনার টিম এখানে জানাবে।",
    automatic: "TBJ Growth Tech",
    attachment: "{name} ডাউনলোড করুন",
    approvals: "অনুমোদন",
    back: "প্রজেক্ট",
    notFound: "এই প্রজেক্টটি দেখা যাচ্ছে না।",
  },
  approvals: {
    approve: "অনুমোদন দিন",
    requestChanges: "পরিবর্তন চাই",
    commentLabel: "কী বদলাতে হবে?",
    commentPlaceholder: "টিমকে লিখে জানান কী বদলাতে হবে",
    send: "পাঠান",
    cancel: "বাতিল",
    pending: "আপনার উত্তরের অপেক্ষায়",
    approved: "আপনি অনুমোদন দিয়েছেন",
    changesRequested: "আপনি পরিবর্তন চেয়েছেন",
    answeredOn: "উত্তর দিয়েছেন {date}",
    yourComment: "আপনার মন্তব্য",
    errors: {
      signed_out: "আবার সাইন ইন করুন।",
      not_found: "এই অনুরোধটি আর পাওয়া যাচ্ছে না।",
      already_answered: "এর উত্তর আগেই দেওয়া হয়েছে।",
      invalid_decision: "কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।",
      comment_required: "কী বদলাতে হবে লিখে জানান।",
      failed: "কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।",
    },
    thanks: "ধন্যবাদ। আপনার উত্তর টিমের কাছে পৌঁছেছে।",
  },
  meetingAt: "{date}, {time}",
  signOut: "সাইন আউট",
};

export type PortalLanguage = "en" | "bn";

export function portalStrings(language: PortalLanguage | string | null | undefined): PortalStrings {
  return language === "bn" ? bn : en;
}

/** Dates and times for the portal, in the client's language. Times are Dhaka time (TBJ works from Dhaka). */
export function formatDate(d: Date | string, language: PortalLanguage): string {
  return new Date(d).toLocaleDateString(language === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeZone: "Asia/Dhaka" });
}
export function formatTime(d: Date | string, language: PortalLanguage): string {
  return new Date(d).toLocaleTimeString(language === "bn" ? "bn-BD" : "en-GB", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" });
}

/** Replaces {name} placeholders. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? values[k] : m));
}
