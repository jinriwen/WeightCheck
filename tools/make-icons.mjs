// 生成 PWA 图标(纯 node,无依赖)。用法: node tools/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return buf => {
    let c = -1;
    for (const b of buf) c = t[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      raw[p++] = r; raw[p++] = g; raw[p++] = b; raw[p++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const BG = [23, 166, 115];      // 绿色底
const FG = [255, 255, 255];     // 白色圆环
const PROGRESS = 0.72;          // 环的进度
const SS = 3;                   // 超采样倍数(抗锯齿)

// 一个「进度环 + 中心点」的图标,留足 maskable 安全区
function makeIcon(size) {
  const c = size / 2, rOut = size * 0.30, rIn = size * 0.215, rDot = size * 0.075;
  return png(size, (x, y) => {
    let hit = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const dx = x + (sx + 0.5) / SS - c, dy = y + (sy + 0.5) / SS - c;
      const d = Math.hypot(dx, dy);
      if (d <= rDot) { hit++; continue; }
      if (d >= rIn && d <= rOut) {
        // 从正上方顺时针的角度 0..1
        const a = (Math.atan2(dx, -dy) / (2 * Math.PI) + 1) % 1;
        if (a <= PROGRESS) hit++;
      }
    }
    const t = hit / (SS * SS);
    return [
      Math.round(BG[0] + (FG[0] - BG[0]) * t),
      Math.round(BG[1] + (FG[1] - BG[1]) * t),
      Math.round(BG[2] + (FG[2] - BG[2]) * t),
      255,
    ];
  });
}

mkdirSync(new URL('../icons/', import.meta.url), { recursive: true });
for (const s of [192, 512]) {
  const out = new URL(`../icons/icon-${s}.png`, import.meta.url);
  writeFileSync(out, makeIcon(s));
  console.log(`icons/icon-${s}.png`);
}
