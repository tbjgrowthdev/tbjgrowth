# TBJ মোবাইল অ্যাপ — Design (Capacitor + PWA)

তারিখ: 2026-11-16 (আপডেট 2026-11-19) · অবস্থা: **implementation prompt দেওয়া হয়েছে** · লেখক: Claude (আসিফের সঙ্গে আলোচনার ভিত্তিতে)

> **সর্বশেষ সিদ্ধান্ত (এই অংশ নিচের যেকোনো iOS/store উল্লেখের ওপরে প্রাধান্য পাবে):**
> - আপাতত **শুধু Android**। iPhone-এ সাইটটাই PWA ("Add to Home Screen") হিসেবে চলবে। Apple Developer account এখন লাগছে না।
> - অ্যাপের **APK ওয়েবসাইট থেকে ডাউনলোড** করা যাবে (public সাইটে "অ্যাপ ডাউনলোড" পেজ/বাটন, ইনস্টলের ধাপ ও iPhone-এর নির্দেশনা সহ)। APK গিট রিপোতে থাকবে না, R2 বা GitHub Releases-এ থাকবে।
> - **Google Play-তে পরে তোলা হবে।** তাই শুরু থেকেই package ID (যেমন `com.tbjgrowthtech.app`) ও signing keystore এক রাখতে হবে, আর keystore-এর backup থাকতে হবে।
> - Firebase (push-এর জন্য) লাগবে, তবে Apple-এর অংশ ছাড়া। Apple-সংক্রান্ত অংশ (§৬, demo reviewer account, TestFlight) পরের পর্বের জন্য রাখা আছে।

## ১. উদ্দেশ্য ও কেন

TBJ Growth Tech-এর ওয়েবসাইটটাই (public পেজ + `/admin` panel) ফোনে একটা অ্যাপ হিসেবে দিতে হবে।

- **ক্লায়েন্ট/ভিজিটর** অ্যাপে সাইট দেখবে, সার্ভিস/কেস স্টাডি পড়বে, booking ও contact form পূরণ করবে।
- **TBJ টিম** একই অ্যাপে login করে ফোন থেকেই সবকিছু manage করবে (leads, bookings, posts, approvals, analytics, monitoring ইত্যাদি)।
- নতুন lead/booking এলে ফোনে push notification যাবে। এখন শুধু email যায়।

আলোচনায় আসিফ যা বলেছেন: অ্যাপ "মূলত ওয়েবসাইটের মতোই", ক্লায়েন্টরা visit করবে, আর "সবকিছু manage করার জন্য" admin panel-ও লাগবে। তিনটা পথের মধ্যে তিনি **Capacitor wrapper (পথ ২)** বেছে নিয়েছেন।

## ২. লক্ষ্য, অ-লক্ষ্য, anti-goal

**লক্ষ্য**
- একটা কোডবেস: ওয়েবে যা deploy হয়, অ্যাপে তা-ই দেখায়। Cloudflare-এ push দিলে অ্যাপও আপডেট হয়, store release ছাড়াই।
- আপাতত Android: ওয়েবসাইট থেকে APK ডাউনলোড; পরে Google Play। iOS পরে (এখন PWA)।
- Admin-এর সব সেকশন ফোনে ব্যবহারযোগ্য (প্রথমে leads, bookings, posts/approvals)।
- Admin-এর জন্য push notification + biometric lock।

**অ-লক্ষ্য (এই ভার্সনে নয়)**
- native UI-তে নতুন করে লেখা (React Native/Expo)।
- ক্লায়েন্টদের জন্য আলাদা account/login বা ক্লায়েন্টদের কাছে push। এখন ক্লায়েন্টের কোনো account নেই।
- offline-এ admin ব্যবহার।
- নতুন REST API (`/api/mobile/*`)। এটা লাগবে না।

**anti-goal (এগুলো হলে ব্যর্থ, কাজ করলেও)**
- store-এ reject হওয়া কারণ অ্যাপটা "শুধু ওয়েবসাইট মোড়ানো"।
- admin পেজ ফোনে cache হয়ে logout-এর পরও দেখা যাওয়া।
- push-এ ক্লায়েন্টের নাম/ফোন/মেসেজের মতো ব্যক্তিগত তথ্য lock screen-এ দেখা যাওয়া।
- ওয়েবের জন্য ঠিক থাকা কোনো কিছু (SEO, middleware, redirect, locale) অ্যাপের কারণে ভেঙে যাওয়া।

## ৩. Constraints (রিপো থেকে যাচাই করা)

- Next.js 16 App Router, Cloudflare Workers-এ OpenNext দিয়ে deploy। GitHub push → Cloudflare auto-deploy।
- **Admin-এর সব mutation Server Action।** এগুলো same-origin ছাড়া চলে না, আর কোনো REST API নেই (`docs/api.md`)। তাই WebView-কে অবশ্যই **live production origin** (`tbjgrowthtech.com`) থেকে লোড হতে হবে। static export বা bundled কপি চলবে না।
- Auth: NextAuth v4, credentials + TOTP, JWT cookie। প্রতিটা login-এ `AdminSession` row তৈরি হয়, আর `requireSession()` প্রতিবার `revokedAt` দেখে। এই কারণে "Revoke" তাৎক্ষণিক কাজ করে। অ্যাপে এটা ভাঙা যাবে না।
- `middleware.ts` (Edge) শুধু `/admin`, `/login` পাহারা দেয়, আর public পথে locale rewrite করে (en-gb, en-bd, bn-bd, en-ae, ar-ae)।
- Neon HTTP adapter-এ multi-statement transaction নেই (`docs/known-limitations.md`)। নতুন DB লেখার কাজে সতর্ক থাকতে হবে।
- `AutomationEvent` enum-এ এখন শুধু SEO-সংক্রান্ত ইভেন্ট (CONTENT_PUBLISHED, RANKING_DECLINE ইত্যাদি)। lead বা booking-এর কোনো event নেই।
- Lead তৈরি হয় `app/(admin)/actions/forms.ts`-এ (`formSubmission.create`), booking তৈরি হয় `app/(admin)/actions/booking.ts`-এ (`booking.create`)। push trigger এই দুই জায়গা থেকেই যাবে।
- PWA-র কিছু নেই এখন: manifest, service worker, আইকন কোনোটাই না।
- Admin-এ responsive class আছে (প্রায় ৫৬টা ফাইলে) এবং বহু টেবিলে horizontal scroll আছে, কিন্তু মোবাইল-সম্পূর্ণ করা হয়নি।

## ৪. Approaches (বিবেচিত তিনটা)

| পথ | কী | কেন নয় / কেন হ্যাঁ |
|---|---|---|
| ১. শুধু PWA | install করা যায় এমন সাইট | store-এ থাকে না, iOS push সীমিত। **এটা ধাপ ১ হিসেবে নেওয়া হয়েছে**, তারপর ২-এ উঠবে। |
| **২. Capacitor wrapper (বেছে নেওয়া)** | native খোলসে live সাইট + native push/biometric | একই কোডবেস, ২–৩ সপ্তাহ, store-এ publish। ঝুঁকি: Apple 4.2 (নিচে প্রশমন)। |
| ৩. React Native/Expo | সব নতুন করে native | ৪৫+ admin সেকশন ও public সাইট নতুন করে লিখতে হবে, কয়েক মাস। অপ্রয়োজনীয়। |

আসিফ **পথ ২** বেছেছেন। সুপারিশও এটাই ছিল।

## ৫. সিদ্ধান্তগুলো

**আসিফের সিদ্ধান্ত:** পথ ২ (Capacitor)। অ্যাপে public সাইট ও পুরো admin দুটোই থাকবে।

**আমার call (আসিফ চাইলে বদলাবেন):**
- Capacitor প্রজেক্ট থাকবে একই রিপোর `mobile/` ফোল্ডারে। Cloudflare build যেন `mobile/` বদলে অযথা deploy না করে, সেই ব্যবস্থা builder দেখবে।
- WebView `server.url` মোডে production domain-এ যাবে। অন্য domain-এ গেলে (যেমন Google, WhatsApp লিংক) system browser-এ খুলবে, `allowNavigation` allowlist দিয়ে।
- Push নেবে FCM (Android সরাসরি, iOS-এ APNs-কে FCM-এর মধ্য দিয়ে)। Worker থেকে FCM HTTP v1 কল হবে `fetch` দিয়ে (service-account JWT WebCrypto দিয়ে সাইন)।
- Push trigger: lead, booking, approval-এর অপেক্ষায় থাকা content, uptime/error alert। শুরুতে সরাসরি `forms.ts`/`booking.ts`-এ hook। automation engine-এ নতুন event যোগ করা লাগবে কিনা সেটা builder সিদ্ধান্ত নেবে।
- Push-এর লেখা সাধারণ রাখা ("নতুন lead এসেছে"), ব্যক্তিগত তথ্য ছাড়া। ট্যাপ করলে নির্দিষ্ট admin পেজে যাবে, সেখানে login লাগবে।
- নতুন টেবিল `PushDevice` (userId, adminSessionId, platform, token, createdAt, lastSeenAt)। session revoke বা logout হলে token মুছবে।
- Biometric lock শুধু অ্যাপ খোলা/foreground-এ ফেরার সময়, admin session থাকলে।
- Apple review-এর জন্য একটা **সীমিত-permission demo account** (যেমন CONTRIBUTOR) থাকবে। reviewer-কে কখনও admin/super-admin credential দেওয়া হবে না।
- Android আগে release (এখন APK ডাউনলোড, পরে Play Store)। iOS পরে, চাইলে।

## ৬. Apple 4.2 ঝুঁকি প্রশমন

শুধু ওয়েবসাইট মোড়ানো হলে reject হতে পারে। তাই অ্যাপে অন্তত এগুলো থাকবে: native push notification, biometric lock, native splash/আইকন, share sheet, ফোনের back-gesture ও safe-area-র সঠিক আচরণ, offline হলে সুন্দর error স্ক্রিন। Review notes-এ এগুলো লিখে দেওয়া হবে।

## ৭. কাজের ধাপ ও শেষের মাপকাঠি

1. **PWA ভিত্তি** — `app/manifest.ts`, আইকন (192/512, maskable), service worker (public asset cache করবে, `/admin`, `/login`, `/api` কখনও নয়)। *শেষ:* ফোনে "Install" করা যায়, Lighthouse PWA চেক পাস, admin cache হয় না।
2. **Admin মোবাইল অডিট** — leads, bookings, posts/approvals, dashboard আগে; তারপর বাকি সেকশন। sidebar, টেবিল, ফর্ম, editor (Tiptap) ছোট স্ক্রিনে। *শেষ:* ৩৬০px প্রস্থে প্রথম ৪টা এলাকার প্রতিটা কাজ করা যায়।
3. **Push backend** — `PushDevice` migration, FCM sender, lead/booking/approval/alert hook, প্রতি ইভেন্টের on/off setting, session revoke-এ token মোছা। *শেষ:* test সহ, নতুন lead-এ ডিভাইসে notification আসে।
4. **Capacitor প্রজেক্ট** — Android+iOS, native push রেজিস্ট্রেশন, biometric lock, deep link, external-link allowlist, splash/আইকন। *শেষ:* দুই প্ল্যাটফর্মে real ডিভাইসে login থেকে push পর্যন্ত পুরো ফ্লো চলে।
5. **ডাউনলোড পেজ ও APK বিতরণ (এখনকার release)** — public সাইটে ডাউনলোড পেজ/বাটন (ইনস্টল ধাপ, "অজানা উৎস" নির্দেশনা, iPhone-এর "Add to Home Screen" নির্দেশনা), সাইন করা release APK R2/GitHub Releases-এ। *শেষ:* real Android ফোনে সাইট থেকে APK নামিয়ে ইনস্টল করে login ও push পর্যন্ত চলে।
6. **Google Play (পরে)** — Play account, store listing, screenshot, privacy policy, Internal Testing → production। iOS চাইলে তখন Apple account, demo account ও TestFlight।

## ৮. ঝুঁকি ও পরীক্ষা

- নতুন কোড `tests/`-এর বিদ্যমান node test runner-এ। `npm run check:actions` যেন নতুন action/route-ও কভার করে।
- cookie ও session: WebView-তে NextAuth cookie টিকে থাকে কিনা, কত দিন, সেটা real ডিভাইসে যাচাই করতে হবে।
- locale rewrite ও redirect (middleware) অ্যাপে ঠিক চলে কিনা, `bn-bd`/`ar-ae` (RTL) সহ।
- Cloudflare Workers-এর সীমা: FCM কল ও JWT সাইন Worker-এ চলবে কিনা prototype-এ আগে দেখা।

## ৯. Builder-এর হাতে ছাড়া

- আইকন/splash-এর ডিজাইন, navigation-এর খুঁটিনাটি, push-এর হুবহু লেখা।
- service worker-এর cache কৌশল (শর্ত: `/admin`, `/login`, `/api` cache নয়)।
- `PushDevice`-এর index ও পরিষ্কার করার নিয়ম।
- Capacitor-এর plugin বাছাই ও ভার্সন।

## ৯ক. Builder-check-এর পর যোগ হওয়া সিদ্ধান্ত (আমার call)

- **Push কে পাবে:** প্রতিটা user নিজে প্রতি ইভেন্টের জন্য on/off করবে (per-user preference টেবিল)। ডিফল্ট চালু শুধু SUPER_ADMIN, ADMIN, EDITOR-এর জন্য। CONTRIBUTOR ও SEO_MANAGER-এর জন্য lead/booking push ডিফল্ট বন্ধ, কারণ lead-এ ক্লায়েন্টের ব্যক্তিগত তথ্য থাকে। push-এর লেখায় সেই তথ্য থাকবে না।
- **Apple reviewer account:** আলাদা demo user, CONTRIBUTOR role, **2FA বন্ধ** (TOTP optional, তাই কোনো নতুন auth পথ বা exemption লাগবে না), শুধু নকল ডেমো ডেটা দেখায়। push-এর feature reviewer-কে দেখানো হবে review notes ও একটা ছোট ভিডিও দিয়ে, লাইভ push দিয়ে নয়।
- **Session:** বিদ্যমান ৩০ দিনের JWT থাকবে। অ্যাপ ৫ মিনিট background-এ থাকলে biometric চাইবে। biometric ব্যর্থ হলে শুধু lock থাকবে, logout বা revoke হবে না। "পাসওয়ার্ড দিয়ে ঢুকুন" বেছে নিলে অ্যাপের cookie মুছে আবার login করতে হবে। `PushDevice` row মুছবে logout, revoke বা ৩০ দিন ডিভাইস না দেখা গেলে।
- **Cloudflare path filter:** builder প্রথম ধাপে Cloudflare project-এর build settings দেখে ঠিক করবে।

## ১০. খোলা প্রশ্ন (আসিফের উত্তর লাগবে)

- Firebase, Apple Developer ও Google Play account এখন আছে কিনা, কার নামে, আর কোম্পানি account হলে D-U-N-S নম্বর আছে কিনা। (Apple enrollment-এ দিন থেকে সপ্তাহ লাগতে পারে, তাই iOS-এর সময়সীমা এর ওপর নির্ভর করে।)
- সাইটে privacy policy পেজ আছে কিনা। রিপোতে শুধু footer-এ একটা উল্লেখ পেয়েছি, আলাদা পেজ পাইনি। দুই store-এই policy URL বাধ্যতামূলক।
- production domain কি শুধু `tbjgrowthtech.com`, নাকি `www` বা অন্য domain আছে? আর অ্যাপ test করার জন্য staging আছে কিনা।

(নিচের প্রশ্নগুলো আগের তালিকার, উত্তর লাগলে দেবেন:)


- অ্যাপের নাম ও bundle ID কী হবে (যেমন `com.tbjgrowthtech.app`)?
- Apple/Google developer account কার নামে (কোম্পানি/এজেন্সি নাকি ব্যক্তিগত) হবে?
- ক্লায়েন্টদের জন্য push (যেমন booking নিশ্চিতকরণ/রিমাইন্ডার) পরে চান কিনা, সেটা এখন সিদ্ধান্ত লাগবে না, তবে চাইলে ভবিষ্যতে ক্লায়েন্ট-পরিচয়ের একটা উপায় লাগবে।
