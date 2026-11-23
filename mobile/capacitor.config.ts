import type { CapacitorConfig } from "@capacitor/cli";

// Base config shared by both Android apps. `npm run sync` copies it into the
// app, then scripts/flavor-configs.mjs writes one per flavor that changes only
// the start URL, appId and appName:
//   admin  -> com.tbjgrowthtech.admin, "TBJ Admin",       https://tbjgrowthtech.com/admin
//   client -> com.tbjgrowthtech.app,   "TBJ Growth Tech", https://tbjgrowthtech.com/portal
// The apps load the LIVE site (Server Actions need the real origin), so a
// website deploy updates both apps with no new APK.
const config: CapacitorConfig = {
  appId: "com.tbjgrowthtech.app",
  appName: "TBJ Growth Tech",
  webDir: "www",
  server: {
    url: "https://tbjgrowthtech.com",
    // Only our own host stays inside the app; every other link (WhatsApp,
    // Google, social) opens in the phone's browser.
    allowNavigation: ["tbjgrowthtech.com"],
    // Shown (from www/) when the site can't be reached, e.g. no internet.
    errorPath: "offline.html",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
    SplashScreen: { launchShowDuration: 800, launchAutoHide: true, showSpinner: false },
  },
};

export default config;
