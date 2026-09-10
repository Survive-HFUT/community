<script setup lang="ts">
import BrandIcon, { type BrandName } from '../components/BrandIcon.vue';
import { isExternalUrl, notifyOpener } from '../lib/waline/notify-opener';

definePageMeta({
  layout: 'waline',
  middleware: 'waline-guest',
});

/**
 * 第三方 OAuth 登录页，同时承担回调页职责。
 * 流程（见 layers/waline/server/waline/services/oauth.ts）：
 *  1. 点击提供商 → 跳转 /api/oauth?type=X&redirect=/oauth → 302 到第三方授权服务
 *  2. 授权完成后回跳 /api/oauth?type=X&code=... → 服务端签发 JWT
 *  3. 服务端 302 到 /oauth?token=<jwt>（成功）或 /oauth?error=<code>（失败）
 */
const CALLBACK = '/oauth';

const providers: { type: string; label: string; icon: BrandName }[] = [
  { type: 'github', label: 'GitHub', icon: 'github' },
  { type: 'twitter', label: 'Twitter', icon: 'twitter' },
  { type: 'facebook', label: 'Facebook', icon: 'facebook' },
  { type: 'google', label: 'Google', icon: 'google' },
  { type: 'weibo', label: '微博', icon: 'weibo' },
  { type: 'qq', label: 'QQ', icon: 'qq' },
];

const errorMap: Record<string, string> = {
  oauth_failed: '第三方授权失败，请重试。',
  oauth_no_id: '未能从第三方获取到账号信息。',
  oauth_already_bound: '该社交账号已绑定到其他账户。',
  oauth_create_failed: '创建账户失败，请重试。',
  account_banned: '该账号已被封禁，无法登录。',
  server_error: '服务器错误，请稍后重试。',
  oauth_error: 'OAuth 授权出错，请重试。',
};

const route = useRoute();
const auth = useWalineAuth();

const errorMessage = ref('');

const forwardedQuery = computed(() => {
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(route.query)) {
    if (key === 'token' || key === 'error') continue;
    if (Array.isArray(value)) {
      if (value[0]) query[key] = value[0];
      continue;
    }
    if (typeof value === 'string') {
      query[key] = value;
    }
  }
  return query;
});

function buildCallbackPath(): string {
  const redirect = forwardedQuery.value.redirect;
  if (!redirect) return CALLBACK;
  return `${CALLBACK}?${new URLSearchParams({ redirect }).toString()}`;
}

function oauthUrl(type: string) {
  return `/api/oauth?type=${encodeURIComponent(type)}&redirect=${encodeURIComponent(buildCallbackPath())}`;
}

const isProcessing = computed(() => !!route.query.token);

onMounted(async () => {
  const token = route.query.token as string | undefined;
  const error = route.query.error as string | undefined;

  if (token) {
    // 社交登录属于主动持久化登录，直接写入 localStorage（相当于「记住我」）
    auth.setToken(token, true);
    await auth.init();
    // 子窗口（Waline 评论组件弹窗）OAuth 登录：通知父窗口并关闭弹窗
    if (auth.user.value && notifyOpener(auth.user.value, token, true)) return;

    const redirect = forwardedQuery.value.redirect || '';
    if (isExternalUrl(redirect)) {
      const sep = redirect.includes('?') ? '&' : '?';
      window.location.href = `${redirect}${sep}token=${encodeURIComponent(token)}`;
      return;
    }

    if (redirect.startsWith('/api/') || redirect.startsWith('/github')) {
      window.location.href = redirect;
      return;
    }

    await navigateTo(redirect || '/');
    return;
  }

  if (error) {
    errorMessage.value = errorMap[error] || '第三方登录失败，请重试。';
  }
});
</script>

<template>
  <WalineAuthShell
    title="社交账号登录"
    description="选择一个第三方账号快速登录"
  >
    <div v-if="isProcessing" class="flex flex-col items-center gap-3 py-6">
      <UIcon
        name="i-lucide-loader-circle"
        class="size-5 animate-spin text-primary"
      />
      <span class="text-sm text-muted">登录中…</span>
    </div>

    <div v-else class="space-y-4">
      <UAlert
        v-if="errorMessage"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :description="errorMessage"
      />

      <div class="flex flex-col gap-2">
        <UButton
          v-for="provider in providers"
          :key="provider.type"
          color="neutral"
          variant="outline"
          size="lg"
          external
          class="w-full justify-center"
          :href="oauthUrl(provider.type)"
        >
          <BrandIcon :name="provider.icon" class="size-4" />
          使用 {{ provider.label }} 登录
        </UButton>
      </div>
    </div>

    <template #footer>
      或
      <NuxtLink
        :to="{ path: '/login', query: forwardedQuery }"
        class="font-medium text-primary hover:underline"
      >
        使用邮箱密码登录
      </NuxtLink>
    </template>
  </WalineAuthShell>
</template>
