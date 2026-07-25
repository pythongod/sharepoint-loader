// Writes the extension's toolbar icons. Unlike the Chrome Web Store artwork in
// generate-store-assets.py, these files are part of the package and are
// committed, so this generator is dependency-free and runs on any platform.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sizes = [16, 48, 128];

const BLUE = [15, 108, 189];
const WHITE = [255, 255, 255];

// Icon: three stacked bars of decreasing width above a downward arrow — a list
// being pulled down into view.
function draw(size) {
  const pixel = (x, y) => {
    const u = x / size;
    const v = y / size;

    // Rounded corners.
    const r = 0.16;
    const dx = Math.max(r - u, u - (1 - r), 0);
    const dy = Math.max(r - v, v - (1 - r), 0);

    if (Math.hypot(dx, dy) > r) return null;

    const bars = [
      { top: 0.22, bottom: 0.31, left: 0.22, right: 0.78 },
      { top: 0.37, bottom: 0.46, left: 0.22, right: 0.66 },
      { top: 0.52, bottom: 0.61, left: 0.22, right: 0.54 },
    ];

    for (const bar of bars) {
      if (v >= bar.top && v <= bar.bottom && u >= bar.left && u <= bar.right) return WHITE;
    }

    // Arrow head: a downward triangle under the bars.
    const arrowTop = 0.62;
    const arrowBottom = 0.82;

    if (v >= arrowTop && v <= arrowBottom) {
      const progress = (v - arrowTop) / (arrowBottom - arrowTop);
      const halfWidth = 0.2 * (1 - progress);

      if (Math.abs(u - 0.62) <= halfWidth) return WHITE;
    }

    return BLUE;
  };

  // One filter byte (0 = none) per scanline, then RGBA samples.
  const raw = Buffer.alloc(size * (size * 4 + 1));

  let offset = 0;

  for (let y = 0; y < size; y += 1) {
    raw[offset] = 0;
    offset += 1;

    for (let x = 0; x < size; x += 1) {
      const colour = pixel(x + 0.5, y + 0.5);

      if (colour === null) {
        raw.writeUInt32BE(0, offset);
      } else {
        raw[offset] = colour[0];
        raw[offset + 1] = colour[1];
        raw[offset + 2] = colour[2];
        raw[offset + 3] = 255;
      }

      offset += 4;
    }
  }

  return raw;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;

  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;

  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;

  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);

  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);

  length.writeUInt32BE(data.length);

  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);

  crc.writeUInt32BE(crc32(body));

  return Buffer.concat([length, body, crc]);
}

function png(size) {
  const header = Buffer.alloc(13);

  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(draw(size), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of sizes) {
  const target = join(root, 'icons', `icon-${size}.png`);

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, png(size));
  console.log(`Wrote ${target}`);
}
