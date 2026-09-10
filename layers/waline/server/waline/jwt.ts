/**
 * 极简 JWT（HS256）实现，只依赖 Web Crypto，可在 Workers / Node / 浏览器运行。
 * 与上游 Waline-on-Worker 的实现保持字节级兼容（同样的 header、iat/exp、base64url 编码）。
 */

interface JwtPayload {
  id: number;
  iat?: number;
  exp?: number;
}

/** 默认有效期 30 天，与登录 Cookie 的 Max-Age 保持一致 */
const DEFAULT_EXPIRES_IN = 86400 * 30;

export async function signJwt(
  payload: Record<string, unknown>,
  secret: string,
  expiresIn = DEFAULT_EXPIRES_IN,
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresIn };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(body));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

export async function verifyJwt(
  token: string,
  secret: string,
): Promise<JwtPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, payload, sig] = parts;
  const signingInput = `${header}.${payload}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  const signatureBytes = base64UrlDecode(sig);
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    signatureBytes,
    new TextEncoder().encode(signingInput),
  );

  if (!valid) return null;

  const decoded = JSON.parse(
    new TextDecoder().decode(base64UrlDecode(payload)),
  ) as JwtPayload;

  if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return decoded;
}

function base64UrlEncode(data: string | ArrayBuffer): string {
  const bytes =
    typeof data === 'string'
      ? new TextEncoder().encode(data)
      : new Uint8Array(data);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): ArrayBuffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}
