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
  reports: {
    title: "Reports",
    empty: "No reports yet. Your monthly report appears here when it's ready.",
    download: "Download report",
    back: "Reports",
    notFound: "This report isn't available.",
  },
  billing: {
    title: "Billing",
    empty: "No invoices yet.",
    issued: "Issued {date}",
    due: "Due {date}",
    download: "Download invoice",
    status: { DUE: "Due", PAID: "Paid", OVERDUE: "Overdue", VOID: "Cancelled" },
    note: "Questions about an invoice? Contact your account manager from More.",
  },
  more: {
    title: "More",
    meetings: "Meetings",
    noMeetings: "No meetings booked.",
    minutes: "{n} min",
    bookTitle: "Book a call",
    noSlots: "No free times right now. Send a request and we'll find a time.",
    pickTime: "Choose a time",
    bookMessage: "What would you like to talk about? (optional)",
    book: "Book this time",
    booked: "Booked. You'll see it under Meetings.",
    taken: "That time was just taken. Please choose another.",
    contactTitle: "Contact",
    contactWith: "Your account manager: {name}",
    whatsapp: "WhatsApp",
    call: "Call",
    noContact: "Your team's contact details will appear here.",
    requestTitle: "Send a request",
    requestLabel: "Your message",
    requestPlaceholder: "Ask a question or request a change",
    requestSend: "Send request",
    requestSent: "Sent. Your team will get back to you.",
    requestEmpty: "Write your message first.",
    requestTooLong: "Please keep it under 2000 characters.",
    myRequests: "Your requests",
    requestOpen: "Open",
    requestDone: "Done",
    languageTitle: "Language",
    accountTitle: "Account",
    signedInAs: "Signed in as {email}",
    deleteTitle: "Delete my account",
    deleteBody: "Ask us to delete your portal account. Your team will confirm with you before anything is deleted.",
    deleteButton: "Request account deletion",
    deleteConfirm: "Send a deletion request to your team?",
    deleteRequested: "Deletion requested on {date}. Your team will be in touch.",
    error: "Something went wrong. Please try again.",
    notificationsTitle: "Notifications",
    notificationsBody: "Choose what the TBJ Growth Tech app tells you about.",
    notify: {
      CLIENT_PROJECT_UPDATE: "Project updates",
      CLIENT_APPROVAL_NEEDED: "Approval requests",
      CLIENT_REPORT_READY: "New reports",
      CLIENT_INVOICE_DUE: "Invoices",
      CLIENT_MEETING_REMINDER: "Meeting reminders",
    },
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
  reports: {
    title: "রিপোর্ট",
    empty: "এখনও কোনো রিপোর্ট নেই। মাসিক রিপোর্ট তৈরি হলে এখানে দেখা যাবে।",
    download: "রিপোর্ট ডাউনলোড করুন",
    back: "রিপোর্ট",
    notFound: "এই রিপোর্টটি দেখা যাচ্ছে না।",
  },
  billing: {
    title: "বিল",
    empty: "এখনও কোনো ইনভয়েস নেই।",
    issued: "ইস্যু {date}",
    due: "পরিশোধের শেষ তারিখ {date}",
    download: "ইনভয়েস ডাউনলোড করুন",
    status: { DUE: "বাকি", PAID: "পরিশোধিত", OVERDUE: "মেয়াদোত্তীর্ণ", VOID: "বাতিল" },
    note: "ইনভয়েস নিয়ে প্রশ্ন থাকলে ‘আরও’ থেকে অ্যাকাউন্ট ম্যানেজারের সঙ্গে যোগাযোগ করুন।",
  },
  more: {
    title: "আরও",
    meetings: "মিটিং",
    noMeetings: "কোনো মিটিং বুক করা নেই।",
    minutes: "{n} মিনিট",
    bookTitle: "কল বুক করুন",
    noSlots: "এখন কোনো খালি সময় নেই। অনুরোধ পাঠান, আমরা সময় ঠিক করব।",
    pickTime: "একটি সময় বেছে নিন",
    bookMessage: "কী নিয়ে কথা বলতে চান? (ঐচ্ছিক)",
    book: "এই সময় বুক করুন",
    booked: "বুক হয়েছে। মিটিং-এর তালিকায় দেখতে পাবেন।",
    taken: "এই সময়টি এইমাত্র বুক হয়ে গেছে। অন্য একটি বেছে নিন।",
    contactTitle: "যোগাযোগ",
    contactWith: "আপনার অ্যাকাউন্ট ম্যানেজার: {name}",
    whatsapp: "হোয়াটসঅ্যাপ",
    call: "কল করুন",
    noContact: "আপনার টিমের যোগাযোগের তথ্য এখানে দেখা যাবে।",
    requestTitle: "অনুরোধ পাঠান",
    requestLabel: "আপনার বার্তা",
    requestPlaceholder: "প্রশ্ন করুন বা কোনো পরিবর্তন চান",
    requestSend: "অনুরোধ পাঠান",
    requestSent: "পাঠানো হয়েছে। আপনার টিম শিগগির জানাবে।",
    requestEmpty: "আগে বার্তাটি লিখুন।",
    requestTooLong: "২০০০ অক্ষরের মধ্যে লিখুন।",
    myRequests: "আপনার অনুরোধ",
    requestOpen: "চলমান",
    requestDone: "সম্পন্ন",
    languageTitle: "ভাষা",
    accountTitle: "অ্যাকাউন্ট",
    signedInAs: "{email} হিসেবে সাইন ইন করা",
    deleteTitle: "আমার অ্যাকাউন্ট মুছুন",
    deleteBody: "পোর্টাল অ্যাকাউন্ট মোছার অনুরোধ পাঠান। কিছু মোছার আগে আপনার টিম আপনার সঙ্গে নিশ্চিত হবে।",
    deleteButton: "অ্যাকাউন্ট মোছার অনুরোধ পাঠান",
    deleteConfirm: "টিমকে অ্যাকাউন্ট মোছার অনুরোধ পাঠাবেন?",
    deleteRequested: "{date} তারিখে মোছার অনুরোধ পাঠানো হয়েছে। আপনার টিম যোগাযোগ করবে।",
    error: "কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।",
    notificationsTitle: "নোটিফিকেশন",
    notificationsBody: "TBJ Growth Tech অ্যাপ কোন বিষয়ে জানাবে বেছে নিন।",
    notify: {
      CLIENT_PROJECT_UPDATE: "প্রজেক্ট আপডেট",
      CLIENT_APPROVAL_NEEDED: "অনুমোদনের অনুরোধ",
      CLIENT_REPORT_READY: "নতুন রিপোর্ট",
      CLIENT_INVOICE_DUE: "ইনভয়েস",
      CLIENT_MEETING_REMINDER: "মিটিং মনে করিয়ে দেওয়া",
    },
  },
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

/** Money stored as integer minor units plus an ISO currency (BDT, GBP). */
export function formatMoney(amountMinor: number, currency: string, language: PortalLanguage): string {
  try {
    return new Intl.NumberFormat(language === "bn" ? "bn-BD" : "en-GB", { style: "currency", currency }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency}`;
  }
}

/** "2026-10" as a month name in the client's language. */
export function formatPeriod(period: string, language: PortalLanguage): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return period;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)).toLocaleDateString(language === "bn" ? "bn-BD" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Replaces {name} placeholders. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? values[k] : m));
}
