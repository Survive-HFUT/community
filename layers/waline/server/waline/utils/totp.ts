/**
 * Minimal TOTP (Time-based One-Time Password) implementation
 * Uses Web Crypto API (HMAC-SHA1) for Cloudflare Workers compatibility
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(data: Uint8Array): string {
  let bits = '';
  for (const byte of data) {
    bits += byte.toString(2).padStart(8, '0');
  }
  let result = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    result += BASE32_ALPHABET[parseInt(chunk, 2)];
  }
  return result;
}

export function base32Decode(input: string): Uint8Array {
  const cleaned = input.replace(/=+$/, '').toUpperCase();
  let bits = '';
  for (const char of cleaned) {
    const val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }
  return bytes;
}

export function generateSecret(length = 20): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

async function hmacSha1(
  key: Uint8Array,
  data: Uint8Array,
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return new Uint8Array(sig);
}

async function generateHotp(
  secret: Uint8Array,
  counter: number,
): Promise<string> {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(0, Math.floor(counter / 0x100000000));
  view.setUint32(4, counter >>> 0);

  const mac = await hmacSha1(secret, new Uint8Array(buf));
  const offset = mac[mac.length - 1] & 0xf;
  const code =
    ((mac[offset] & 0x7f) << 24) |
    ((mac[offset + 1] & 0xff) << 16) |
    ((mac[offset + 2] & 0xff) << 8) |
    (mac[offset + 3] & 0xff);

  return (code % 1000000).toString().padStart(6, '0');
}

export async function verifyTotp(
  secret: string,
  token: string,
  window = 2,
): Promise<boolean> {
  const secretBytes = base32Decode(secret);
  const step = 30;
  const counter = Math.floor(Date.now() / 1000 / step);

  for (let i = -window; i <= window; i++) {
    const expected = await generateHotp(secretBytes, counter + i);
    if (expected === token) return true;
  }
  return false;
}
