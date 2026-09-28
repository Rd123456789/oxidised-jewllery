import fs from 'node:fs/promises';
import path from 'node:path';
import { publishSvgAsset } from './assets.js';

const OUTPUT_DIR = path.resolve(process.cwd(), 'uploads', 'seed');
const PUBLIC_PREFIX = '/uploads/seed';

const palettes = [
  ['#f6efe6', '#8a5a2b', '#2f2118'],
  ['#eef1f4', '#5c6b7a', '#20262c'],
  ['#f7ecec', '#a8463f', '#2b1a19'],
  ['#eef5ef', '#4f6f52', '#1d2a1f'],
  ['#f3effa', '#6b5b95', '#231d33'],
  ['#fbf3e4', '#c08a2e', '#33260f'],
];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Uploads the placeholder when Cloudinary is configured, and otherwise writes it under
 * `server/uploads/seed`. Hosts with an ephemeral disk need the former, so that a seeded
 * store still has images after a restart.
 */
async function writeSvg(fileName: string, svg: string): Promise<string> {
  const remote = await publishSvgAsset(fileName, svg);

  if (remote) {
    return remote;
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(path.join(OUTPUT_DIR, fileName), svg, 'utf8');

  return `${PUBLIC_PREFIX}/${fileName}`;
}

export async function createProductImage(
  slug: string,
  label: string,
  index: number,
): Promise<string> {
  const [background, accent] = palettes[index % palettes.length] ?? palettes[0]!;
  const rotation = (index * 18) % 60;

  // No baked-in text: the product card renders the name underneath, so any copy here
  // would read as a duplicate watermark on every tile.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1250" viewBox="0 0 1000 1250" role="img" aria-label="${escapeXml(label)}">
  <defs>
    <linearGradient id="bg" x1="0.1" y1="0" x2="0.9" y2="1">
      <stop offset="0%" stop-color="${background}"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0.34"/>
    </linearGradient>
    <radialGradient id="light" cx="0.5" cy="0.36" r="0.5">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1000" height="1250" fill="url(#bg)"/>
  <rect width="1000" height="1250" fill="url(#light)"/>
  <g transform="translate(500 560) rotate(${rotation})" fill="none" stroke="${accent}" stroke-width="7" opacity="0.8">
    <circle r="132"/>
    <circle r="92" stroke-dasharray="12 16"/>
    <circle r="54"/>
    <g stroke-linecap="round">
      <path d="M0 -196 L0 -246"/>
      <path d="M0 196 L0 246"/>
      <path d="M-196 0 L-246 0"/>
      <path d="M196 0 L246 0"/>
      <path d="M-140 -140 L-176 -176"/>
      <path d="M140 140 L176 176"/>
      <path d="M-140 140 L-176 176"/>
      <path d="M140 -140 L176 -176"/>
    </g>
    <circle r="18" fill="${accent}" stroke="none"/>
  </g>
  <g fill="none" stroke="${accent}" stroke-width="3" opacity="0.3">
    <circle cx="810" cy="200" r="52"/>
    <circle cx="190" cy="1050" r="38"/>
  </g>
</svg>`;

  return writeSvg(`${slug}-${index}.svg`, svg);
}

/**
 * Deliberately contains no text: the storefront renders the banner title and subtitle as
 * HTML on top of the image, so any baked-in copy would show through as a ghost duplicate.
 */
export async function createBannerImage(slug: string, index = 0): Promise<string> {
  const [background, accent] = palettes[index % palettes.length] ?? palettes[0]!;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="900" viewBox="0 0 1920 900" role="img" aria-label="Decorative banner background">
  <defs>
    <linearGradient id="hero" x1="0" y1="0" x2="0.85" y2="1">
      <stop offset="0%" stop-color="${background}"/>
      <stop offset="55%" stop-color="${accent}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0.9"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.78" cy="0.45" r="0.42">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1920" height="900" fill="url(#hero)"/>
  <rect width="1920" height="900" fill="url(#glow)"/>
  <g transform="translate(1500 450)" fill="none" stroke="#ffffff" stroke-opacity="0.32" stroke-width="4">
    <circle r="250"/>
    <circle r="185" stroke-dasharray="16 20"/>
    <circle r="120"/>
    <circle r="58" fill="#ffffff" fill-opacity="0.10" stroke="none"/>
  </g>
  <g fill="none" stroke="#ffffff" stroke-opacity="0.16" stroke-width="3">
    <circle cx="1180" cy="720" r="90"/>
    <circle cx="230" cy="820" r="60"/>
  </g>
</svg>`;

  return writeSvg(`${slug}.svg`, svg);
}

export async function createLogoImage(): Promise<string> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="80" viewBox="0 0 320 80" role="img" aria-label="Oxidised Jewellery">
  <rect width="320" height="80" fill="none"/>
  <g transform="translate(40 40)" fill="none" stroke="#8a5a2b" stroke-width="4">
    <circle r="22"/>
    <circle r="12" stroke-dasharray="5 6"/>
  </g>
  <text x="82" y="48" font-family="Georgia, 'Times New Roman', serif" font-size="26" fill="#2f2118">Oxidised</text>
  <text x="196" y="48" font-family="Helvetica, Arial, sans-serif" font-size="16" letter-spacing="4" fill="#8a5a2b">JEWELLERY</text>
</svg>`;

  return writeSvg('logo.svg', svg);
}
