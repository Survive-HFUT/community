import { md5 } from './hash';

/**
 * Gravatar avatar URL generation
 */
export async function getAvatar(email: string): Promise<string> {
  if (!email) return '';
  const hash = await md5(email.trim().toLowerCase());
  return `https://gravatar.com/avatar/${hash}?d=mp`;
}
