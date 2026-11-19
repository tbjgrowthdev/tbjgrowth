// After `cap sync android`, writes a capacitor.config.json per product flavor.
// Android merges flavor assets over main, so each app gets its own start URL.
//
//   node scripts/flavor-configs.mjs   (run by `npm run sync`)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const MAIN = "android/app/src/main/assets/capacitor.config.json";
const ORIGIN = "https://tbjgrowthtech.com";

export const FLAVORS = {
  admin: { appId: "com.tbjgrowthtech.admin", appName: "TBJ Admin", url: `${ORIGIN}/admin` },
  client: { appId: "com.tbjgrowthtech.app", appName: "TBJ Growth Tech", url: `${ORIGIN}/` },
};

const base = JSON.parse(readFileSync(MAIN, "utf8"));
for (const [flavor, f] of Object.entries(FLAVORS)) {
  const config = { ...base, appId: f.appId, appName: f.appName, server: { ...base.server, url: f.url } };
  const dir = `android/app/src/${flavor}/assets`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/capacitor.config.json`, JSON.stringify(config, null, "\t") + "\n");
  console.log(`${flavor}: ${f.appId} -> ${f.url}`);
}
