<script setup lang="ts">
import { register } from '../lib/waline/auth';

definePageMeta({
  layout: 'waline',
  middleware: 'waline-guest',
});

const route = useRoute();

const displayName = ref('');
const email = ref((route.query.email as string) || '');
const password = ref('');
const confirmPassword = ref('');
const url = ref('');
const loading = ref(false);
const error = ref('');

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

const loginQuery = computed(() => ({
  ...forwardedQuery.value,
  email: email.value.trim() || forwardedQuery.value.email || '',
}));

async function submit() {
  error.value = '';
  if (password.value !== confirmPassword.value) {
    error.value = '两次输入的密码不一致。';
    return;
  }

  loading.value = true;
  try {
    await register({
      display_name: displayName.value.trim() || undefined,
      email: email.value.trim(),
      password: password.value,
      url: url.value.trim() || undefined,
    });
    await navigateTo({ path: '/login', query: loginQuery.value });
  } catch (e: any) {
    error.value = e?.message || '注册失败，请重试。';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <WalineAuthShell title="注册" description="未来，从此处启航">
    <form class="space-y-5" @submit.prevent="submit">
      <UFormField label="昵称">
        <UInput
          v-model="displayName"
          autocomplete="nickname"
          placeholder="如何称呼你（可选）"
          size="xl"
          class="w-full"
        />
      </UFormField>

      <UFormField label="邮箱" required>
        <UInput
          v-model="email"
          type="email"
          autocomplete="email"
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
          autocomplete="new-password"
          placeholder="至少 6 位"
          minlength="6"
          class="w-full"
          size="xl"
          required
        />
      </UFormField>

      <UFormField label="确认密码" required>
        <UInput
          v-model="confirmPassword"
          type="password"
          autocomplete="new-password"
          placeholder="再次输入密码"
          minlength="6"
          class="w-full"
          size="xl"
          required
        />
      </UFormField>

      <UFormField label="主页">
        <UInput
          v-model="url"
          type="url"
          autocomplete="url"
          placeholder="https://（可选）"
          size="xl"
          class="w-full"
        />
      </UFormField>

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
        label="注册"
      />
    </form>

    <template #footer>
      已有账号？
      <NuxtLink
        :to="{ path: '/login', query: loginQuery }"
        class="font-medium text-primary hover:underline"
      >
        去登录
      </NuxtLink>
    </template>
  </WalineAuthShell>
</template>
