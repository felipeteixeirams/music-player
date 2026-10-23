import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function createCRC32Table() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
}

const crcTable = createCRC32Table();
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcBuf = Buffer.alloc(4);
  const typeAndData = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(typeAndData), 0);

  return Buffer.concat([lenBuf, typeAndData, crcBuf]);
}

function generatePng(width, height, isMaskable = false) {
  const rowBytes = 1 + width * 4; // 1 filter byte + RGBA
  const rawData = Buffer.alloc(height * rowBytes);

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * (isMaskable ? 0.35 : 0.42);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Deep dark indigo / obsidian background with radial gradient
      const normY = y / height;
      const bgR = Math.round(10 + normY * 15);
      const bgG = Math.round(9 + normY * 12);
      const bgB = Math.round(20 + normY * 25);

      if (dist <= radius) {
        // Inner music aura bars
        const inBarZone = Math.abs(dy) < radius * 0.7;
        const barIdx = Math.floor((x - (cx - radius * 0.6)) / (radius * 0.22));
        const barX = (x - (cx - radius * 0.6)) % (radius * 0.22);

        if (inBarZone && barIdx >= 0 && barIdx < 6 && barX < radius * 0.14) {
          // Purple to cyan gradient bars
          const t = barIdx / 5;
          const barR = Math.round(168 * (1 - t) + 6 * t);
          const barG = Math.round(85 * (1 - t) + 182 * t);
          const barB = Math.round(247 * (1 - t) + 212 * t);
          rawData[pxOffset] = barR;
          rawData[pxOffset + 1] = barG;
          rawData[pxOffset + 2] = barB;
          rawData[pxOffset + 3] = 255;
        } else {
          // Circular gradient halo
          const haloIntensity = 1 - (dist / radius);
          rawData[pxOffset] = Math.min(255, Math.round(bgR + 120 * haloIntensity));
          rawData[pxOffset + 1] = Math.min(255, Math.round(bgG + 40 * haloIntensity));
          rawData[pxOffset + 2] = Math.min(255, Math.round(bgB + 200 * haloIntensity));
          rawData[pxOffset + 3] = 255;
        }
      } else {
        rawData[pxOffset] = bgR;
        rawData[pxOffset + 1] = bgG;
        rawData[pxOffset + 2] = bgB;
        rawData[pxOffset + 3] = 255;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Header
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 6; // Color type: 6 (RGBA)
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // IDAT Chunk
  const idatChunk = makeChunk('IDAT', compressed);

  // IEND Chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), generatePng(192, 192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), generatePng(512, 512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), generatePng(512, 512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), generatePng(180, 180, false));

console.log('Successfully generated all PWA icons (192x192, 512x512, maskable, apple-touch-icon).');
