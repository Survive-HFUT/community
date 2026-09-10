import { uiRedirectHandler } from '../../waline/ui-redirect';

/**
 * 旧地址 `/ui/**` → 对应的新路径（302，保留 query）。
 * 例如 `/ui/login?redirect=/comments` → `/login?redirect=/comments`
 */
export default defineEventHandler((event) => uiRedirectHandler(event));
