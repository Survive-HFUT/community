<script setup lang="ts">
import { login } from '../lib/waline/auth';
import { isExternalUrl, notifyOpener } from '../lib/waline/notify-opener';

definePageMeta({
  layout: 'waline',
  middleware: 'waline-guest',
});

const route = useRoute();
const auth = useWalineAuth();

const email = ref((route.query.email as string) || '');
const password = ref('');
const code = ref('');
const remember = ref(false);
const showCode = ref(false);
const loading = ref(false);
const error = ref('');

/** 透传原始 query（redirect / email 等），保证弹窗登录与整页跳转都不丢上下文 */
const forwardedQuery = computed(() => {
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(route.query)) {
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

const registerQuery = computed(() => ({
  ...forwardedQuery.value,
  email: email.value || forwardedQuery.value.email || '',
}));

const oauthQuery = computed(() => ({
  ...forwardedQuery.value,
  email: email.value || forwardedQuery.value.email || '',
}));

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    const data = await login(
      email.value,
      password.value,
      code.value || undefined,
    );
    await auth.login(data.token, remember.value);

    // 子窗口（Waline 评论组件弹窗登录）→ 通知父窗口并关闭弹窗
    if (notifyOpener(auth.user.value ?? data, data.token, remember.value)) {
      return;
    }

    // 移动端整页跳转回调：redirect 为绝对 URL 时携带 token 跳回父页面
    const redirect = (route.query.redirect as string) || '';
    if (isExternalUrl(redirect)) {
      const sep = redirect.includes('?') ? '&' : '?';
      window.location.href = `${redirect}${sep}token=${encodeURIComponent(
        data.token,
      )}`;
      return;
    }

    if (redirect.startsWith('/api/') || redirect.startsWith('/github')) {
      window.location.href = redirect;
      return;
    }

    await navigateTo(redirect || '/');
  } catch (e: any) {
    if (e?.needs2fa) {
      showCode.value = true;
      error.value = '该账号已开启两步验证，请输入验证码后重新登录。';
    } else {
      error.value = e?.message || '登录失败，请检查邮箱和密码。';
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <WalineAuthShell title="登录" description="登录后即可评论与维护个人档案">
    <form class="space-y-5" @submit.prevent="submit">
      <UFormField label="邮箱" required>
        <UInput
          v-model="email"
          type="email"
          autocomplete="username"
          placeholder="you@example.com"
          class="w-full"
          size="xl"
          required
        />
      </UFormField>

      <UFormField label="密码" required>
        <UInput
          v-model="password"
          type="password"
          autocomplete="current-password"
          placeholder="请输入密码"
          class="w-full"
          size="xl"
          required
        />
      </UFormField>

      <UFormField
        v-if="showCode"
        label="两步验证码"
        help="请在身份验证器 App 中查看当前 6 位验证码"
      >
        <UInput
          v-model="code"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          placeholder="6 位数字"
          size="xl"
          class="w-full"
        />
      </UFormField>

      <UCheckbox v-model="remember" label="记住我（30 天内免登录）" />

      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :description="error"
      />

      <UButton
        type="submit"
        color="primary"
        size="lg"
        class="w-full justify-center"
        :loading="loading"
        label="登录"
      />
    </form>

    <template #footer>
      还没有账号？
      <NuxtLink
        :to="{ path: '/register', query: registerQuery }"
        class="font-medium text-primary hover:underline"
      >
        立即注册
      </NuxtLink>
      <span class="mx-1.5 text-dimmed">·</span>
      <NuxtLink
        :to="{ path: '/oauth', query: oauthQuery }"
        class="font-medium text-primary hover:underline"
      >
        社交账号登录
      </NuxtLink>
    </template>
  </WalineAuthShell>
</template>
