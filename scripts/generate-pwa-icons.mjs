/**
 * Generates PNG icons for the PWA manifest.
 * - public/icons/icon.svg: rounded tile, used for "any" icons.
 * - public/icons/icon-full.svg: full-bleed square, used where the OS applies its
 *   own mask (apple-touch-icon, Android maskable icons).
 * Run: node scripts/generate-pwa-icons.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const iconsDir = join(root, 'public', 'icons');
const svgPath = join(iconsDir, 'icon.svg');
const fullSvgPath = join(iconsDir, 'icon-full.svg');

mkdirSync(iconsDir, { recursive: true });

let resvg;
try {
  const mod = await import('@resvg/resvg-js');
  resvg = mod.default ?? mod;
} catch {
  console.error(
    'Missing @resvg/resvg-js. Install it with: npm install -D @resvg/resvg-js'
  );
  process.exit(1);
}

const svg = readFileSync(svgPath, 'utf8');
const fullSvg = readFileSync(fullSvgPath, 'utf8');

/** "any" icons: rounded tile with transparent corners. */
const rounded = [
  { name: 'icon-192x192.png', size: 192 },
  { name: 'icon-512x512.png', size: 512 },
  { name: 'icon-192.png', size: 192 }, // alias for older refs
  { name: 'icon-512.png', size: 512 },
];

/** Opaque squares: iOS rounds the corners itself, Android crops maskable icons. */
const fullBleed = [
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-maskable-192.png', size: 192 },
  { name: 'icon-maskable-512.png', size: 512 },
];

function renderPng(sourceSvg, size) {
  const renderer = new resvg.Resvg(sourceSvg, {
    fitTo: { mode: 'width', value: size },
  });
  return renderer.render().asPng();
}

for (const [source, list] of [
  [svg, rounded],
  [fullSvg, fullBleed],
]) {
  for (const { name, size } of list) {
    writeFileSync(join(iconsDir, name), renderPng(source, size));
    console.log(`Wrote public/icons/${name}`);
  }
}
