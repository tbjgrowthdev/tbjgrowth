// Generates the PWA / app icons from the "TB" mark in the brand logo.
//
//   node scripts/generate-app-icons.mjs
//
// Output (committed): public/icons/*.png, and the 1024px sources the
// Android flavors build their launcher icons from (mobile/assets/<flavor>/).
// Re-run after the logo changes.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

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

// Android launcher sources. Client = brand ivory; Admin = dark, so the two
// apps are easy to tell apart on one phone.
for (const [flavor, src, bg] of [["client", light, IVORY], ["admin", dark, OFF_BLACK]]) {
  mkdirSync(`mobile/assets/${flavor}`, { recursive: true });
  await (await icon(src, 1024, bg, 0.5)).toFile(`mobile/assets/${flavor}/icon-only.png`);
  await (await icon(src, 1024, bg, 0.42)).toFile(`mobile/assets/${flavor}/icon-foreground.png`);
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: bg } }).png().toFile(`mobile/assets/${flavor}/icon-background.png`);
  await (await icon(src, 2732, bg, 0.2)).toFile(`mobile/assets/${flavor}/splash.png`);
  await (await icon(src, 2732, bg, 0.2)).toFile(`mobile/assets/${flavor}/splash-dark.png`);
}
console.log("icons written");
