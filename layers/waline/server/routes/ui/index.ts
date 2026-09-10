import { uiRedirectHandler } from '../../waline/ui-redirect';

/** 旧地址 `/ui` → `/dashboard`（302，保留 query） */
export default defineEventHandler((event) => uiRedirectHandler(event));
