// Generates the PWA / app icons from the "TB" mark in the brand logo.
//
//   node scripts/generate-app-icons.mjs
//
// Output (committed): public/icons/*.png, and the 1024px sources the
// Android flavors build their launcher icons from (mobile/assets/<flavor>/).
// Re-run after the logo changes.
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";

const IVORY = "#FDFBFA";
const OFF_BLACK = "#1B1512";

// The mark is the left ~175px of the 1000x200 wordmark.
async function mark(src) {
  const cropped = await sharp(src).extract({ left: 0, top: 0, width: 175, height: 200 }).png().toBuffer();
  return sharp(cropped).trim().png().toBuffer();
}

// Square icon: the mark centred on a solid background, taking `scale` of the side.
async function icon(markPng, size, background, scale) {
  const inner = Math.round(size * scale);
  const resized = await sharp(markPng).resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: resized, gravity: "center" }])
    .png();
}

const light = await mark("public/primarylogo.png");
const dark = await mark("public/primary-logo-dark.png");

mkdirSync("public/icons", { recursive: true });
await (await icon(light, 192, IVORY, 0.72)).toFile("public/icons/icon-192.png");
await (await icon(light, 512, IVORY, 0.72)).toFile("public/icons/icon-512.png");
// Maskable: keep the mark inside the 80% safe zone.
await (await icon(light, 512, IVORY, 0.56)).toFile("public/icons/maskable-512.png");
await (await icon(light, 180, IVORY, 0.72)).toFile("public/icons/apple-touch-icon.png");

// 1024px app icons (Google Play listing, download pages). Client = brand
// ivory; Admin = dark, so the two apps are easy to tell apart on one phone.
for (const [flavor, src, bg] of [["client", light, IVORY], ["admin", dark, OFF_BLACK]]) {
  mkdirSync(`mobile/assets/${flavor}`, { recursive: true });
  await (await icon(src, 1024, bg, 0.5)).toFile(`mobile/assets/${flavor}/icon-only.png`);
}
console.log("icons written");

// Android flavor resources (mobile/android/app/src/<flavor>/res). They
// override main's, so every density/orientation main ships is written here.
// Skipped until the Android project exists (`npx cap add android`).
import { existsSync, readdirSync } from "node:fs";

const ANDROID = "mobile/android/app/src";
const LAUNCHER = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

if (existsSync(`${ANDROID}/main/res`)) {
  for (const [flavor, src, bg] of [["client", light, IVORY], ["admin", dark, OFF_BLACK]]) {
    const res = `${ANDROID}/${flavor}/res`;
    for (const [density, size] of Object.entries(LAUNCHER)) {
      const dir = `${res}/mipmap-${density}`;
      mkdirSync(dir, { recursive: true });
      await (await icon(src, size, bg, 0.62)).toFile(`${dir}/ic_launcher.png`);
      await (await icon(src, size, bg, 0.56)).toFile(`${dir}/ic_launcher_round.png`);
      // Adaptive foreground is 108dp with a 66dp safe zone: transparent around the mark.
      const fg = Math.round(size * 2.25);
      await (await icon(src, fg, { r: 0, g: 0, b: 0, alpha: 0 }, 0.42)).toFile(`${dir}/ic_launcher_foreground.png`);
    }
    mkdirSync(`${res}/values`, { recursive: true });
    writeFileSync(
      `${res}/values/ic_launcher_background.xml`,
      `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${bg}</color>\n</resources>\n`
    );
    for (const dir of readdirSync(`${ANDROID}/main/res`).filter((d) => d.startsWith("drawable"))) {
      const splash = `${ANDROID}/main/res/${dir}/splash.png`;
      if (!existsSync(splash)) continue;
      const { width, height } = await sharp(splash).metadata();
      const side = Math.round(Math.min(width, height) * 0.3);
      const mark = await sharp(src).resize(side, side, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
      mkdirSync(`${res}/${dir}`, { recursive: true });
      await sharp({ create: { width, height, channels: 4, background: bg } })
        .composite([{ input: mark, gravity: "center" }])
        .png()
        .toFile(`${res}/${dir}/splash.png`);
    }
  }
  console.log("android flavor icons + splash written");
}
