// After `cap sync android`, writes a capacitor.config.json per product flavor.
// Android merges flavor assets over main, so each app gets its own start URL.
//
//   node scripts/flavor-configs.mjs   (run by `npm run sync`)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const MAIN = "android/app/src/main/assets/capacitor.config.json";
const ORIGIN = "https://tbjgrowthtech.com";

export const FLAVORS = {
  // appendUserAgent lets the site recognise each app before any script runs
  // (lib/native-lock.ts ADMIN_UA_MARK / CLIENT_UA_MARK: biometric lock, and
  // middleware keeping the client app on /portal). Keep them in sync.
  admin: { appId: "com.tbjgrowthtech.admin", appName: "TBJ Admin", url: `${ORIGIN}/admin`, appendUserAgent: "TBJAdminApp" },
  // The client app is the Client Hub: it opens /portal, never public pages.
  client: { appId: "com.tbjgrowthtech.app", appName: "TBJ Growth Tech", url: `${ORIGIN}/portal`, appendUserAgent: "TBJClientApp" },
};

const base = JSON.parse(readFileSync(MAIN, "utf8"));
for (const [flavor, f] of Object.entries(FLAVORS)) {
  const config = { ...base, appId: f.appId, appName: f.appName, server: { ...base.server, url: f.url } };
  if (f.appendUserAgent) config.appendUserAgent = f.appendUserAgent;
  const dir = `android/app/src/${flavor}/assets`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/capacitor.config.json`, JSON.stringify(config, null, "\t") + "\n");
  console.log(`${flavor}: ${f.appId} -> ${f.url}`);
}
