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

const sizes = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-maskable-512.png', size: 512, pad: 0.12 },
  { name: 'apple-touch-icon.png', size: 180 },
];

for (const { name, size, pad = 0 } of sizes) {
  const inner = pad > 0 ? Math.round(size * (1 - pad * 2)) : size;
  const offset = pad > 0 ? Math.round(size * pad) : 0;
  const wrapped =
    pad > 0
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#2C1E16"/>
  <g transform="translate(${offset} ${offset}) scale(${inner / 512})">
    ${svg.replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}
  </g>
</svg>`
      : svg;

  const renderer = new resvg.Resvg(wrapped, {
    fitTo: { mode: 'width', value: size },
  });
  const png = renderer.render().asPng();
  writeFileSync(join(iconsDir, name), png);
  console.log(`Wrote public/icons/${name}`);
}
