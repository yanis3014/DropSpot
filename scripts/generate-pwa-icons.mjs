/**
 * Generates PNG icons for the PWA manifest from public/icons/icon.svg.
 * Run: node scripts/generate-pwa-icons.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const iconsDir = join(root, 'public', 'icons');
const svgPath = join(iconsDir, 'icon.svg');

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

/** Full-bleed icons (rounded tile already in the SVG). */
const fullBleed = [
  { name: 'icon-192x192.png', size: 192 },
  { name: 'icon-512x512.png', size: 512 },
  { name: 'icon-192.png', size: 192 }, // alias for older refs
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

/** Maskable: solid safe-zone padding for Android adaptive icons. */
const maskable = [
  { name: 'icon-maskable-512.png', size: 512, pad: 0.14 },
  { name: 'icon-maskable-192.png', size: 192, pad: 0.14 },
];

function renderPng(sourceSvg, size) {
  const renderer = new resvg.Resvg(sourceSvg, {
    fitTo: { mode: 'width', value: size },
  });
  return renderer.render().asPng();
}

for (const { name, size } of fullBleed) {
  writeFileSync(join(iconsDir, name), renderPng(svg, size));
  console.log(`Wrote public/icons/${name}`);
}

for (const { name, size, pad } of maskable) {
  const inner = Math.round(size * (1 - pad * 2));
  const offset = Math.round(size * pad);
  const wrapped = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#2C1E16"/>
  <g transform="translate(${offset} ${offset}) scale(${inner / 512})">
    ${svg.replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}
  </g>
</svg>`;
  writeFileSync(join(iconsDir, name), renderPng(wrapped, size));
  console.log(`Wrote public/icons/${name}`);
}
