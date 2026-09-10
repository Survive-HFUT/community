/**
 * MD5 hash utility.
 *
 * 优先使用 Web Crypto —— Cloudflare workerd 额外支持 `crypto.subtle.digest('MD5')`。
 * 但 Nitro 的 dev 服务器跑在 Node 上，Node 的 WebCrypto **不支持 MD5**，
 * 因此这里带一个纯 JS 兜底实现，保证 `pnpm dev` 下头像/邮箱哈希同样可用。
 */

export async function md5(text: string): Promise<string> {
  try {
    const data = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('MD5', data);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return md5Fallback(text);
  }
}

// ---------- 纯 JS MD5 兜底实现 ----------

const SHIFT = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5,
  9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11,
  16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15,
  21,
];

const K = new Uint32Array(64);
for (let i = 0; i < 64; i++) {
  K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
}

function md5Fallback(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const length = bytes.length;

  // 补齐：0x80 + 若干 0，末尾 8 字节写入 bit 长度（小端）
  const padded = new Uint8Array((((length + 8) >> 6) + 1) * 64);
  padded.set(bytes);
  padded[length] = 0x80;

  const view = new DataView(padded.buffer);
  const bitLength = length * 8;
  view.setUint32(padded.length - 8, bitLength >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor(bitLength / 4294967296), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const m = new Uint32Array(16);

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      m[i] = view.getUint32(offset + i * 4, true);
    }

    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;

    for (let i = 0; i < 64; i++) {
      let f: number;
      let g: number;

      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }

      const sum = (f + a + K[i] + m[g]) >>> 0;
      a = d;
      d = c;
      c = b;
      b = (b + ((sum << SHIFT[i]) | (sum >>> (32 - SHIFT[i])))) >>> 0;
    }

    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  return [a0, b0, c0, d0].map(wordToHexLE).join('');
}

function wordToHexLE(word: number): string {
  let out = '';
  for (let i = 0; i < 4; i++) {
    out += ((word >>> (i * 8)) & 0xff).toString(16).padStart(2, '0');
  }
  return out;
}
