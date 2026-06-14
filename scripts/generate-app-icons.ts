/**
 * Generates PWA / Apple / Android icon PNGs from public/icons/source/app-icon.jpg
 *
 * Usage: npm run icons:generate
 */
import { mkdirSync, existsSync } from "fs";
import { resolve } from "path";
import sharp from "sharp";

const ROOT = resolve(process.cwd(), "public/icons");
const SOURCE = resolve(ROOT, "source/app-icon.jpg");

const SIZES = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "favicon-32.png", size: 32 },
] as const;

async function main() {
  if (!existsSync(SOURCE)) {
    console.error(`Missing source icon: ${SOURCE}`);
    console.error("Place app-icon.jpg at public/icons/source/app-icon.jpg");
    process.exit(1);
  }

  mkdirSync(ROOT, { recursive: true });

  for (const { name, size } of SIZES) {
    const out = resolve(ROOT, name);
    await sharp(SOURCE)
      .resize(size, size, { fit: "cover", position: "centre" })
      .png({ compressionLevel: 9 })
      .toFile(out);
    console.log(`Wrote ${out}`);
  }

  console.log("App icons generated.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
