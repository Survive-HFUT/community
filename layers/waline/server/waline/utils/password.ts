import bcrypt from 'bcryptjs';

/**
 * Password hashing using Web Crypto API (PBKDF2).
 *
 * Workers / Node 都支持 PBKDF2，因此新密码统一使用 `$pbkdf2$...` 格式。
 * 同时兼容 LeanCloud 迁移过来的 bcrypt 哈希（`$2a$/$2b$/$2y$`）。
 *
 * 注意：`bcrypt.compareSync` 是同步 CPU 重活，仅在验证历史哈希时才会走到；
 * 若数据库是全新的，可以移除 bcryptjs 依赖。
 */

const ITERATIONS = 100000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const key = await deriveKey(password, salt);

  const hashBuffer = (await crypto.subtle.exportKey('raw', key)) as ArrayBuffer;
  const hashArray = new Uint8Array(hashBuffer);

  // Format: $pbkdf2$iterations$base64salt$base64hash
  return `$pbkdf2$${ITERATIONS}$${uint8ToBase64(salt)}$${uint8ToBase64(hashArray)}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  // Support bcrypt format from LeanCloud migration
  if (
    stored.startsWith('$2a$') ||
    stored.startsWith('$2b$') ||
    stored.startsWith('$2y$')
  ) {
    return bcrypt.compareSync(password, stored);
  }

  // Support phpass format from migrated data
  if (stored.startsWith('$P$') || stored.startsWith('$H$')) {
    return false;
  }

  if (!stored.startsWith('$pbkdf2$')) {
    return false;
  }

  const parts = stored.split('$');
  // parts: ['', 'pbkdf2', iterations, salt, hash]
  if (parts.length !== 5) return false;

  const iterations = parseInt(parts[2], 10);
  const salt = base64ToUint8(parts[3]);
  const expectedHash = base64ToUint8(parts[4]);

  const key = await deriveKey(password, salt, iterations);
  const actualHash = new Uint8Array(
    (await crypto.subtle.exportKey('raw', key)) as ArrayBuffer,
  );

  if (actualHash.length !== expectedHash.length) return false;

  // Constant-time comparison
  let diff = 0;
  for (let i = 0; i < actualHash.length; i++) {
    diff |= actualHash[i] ^ expectedHash[i];
  }
  return diff === 0;
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations = ITERATIONS,
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey'],
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'HMAC', hash: 'SHA-256', length: KEY_LENGTH * 8 },
    true,
    ['sign'],
  );
}

function uint8ToBase64(arr: Uint8Array): string {
  let binary = '';
  for (const byte of arr) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToUint8(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
