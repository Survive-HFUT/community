<script setup lang="ts">
import { get2FASetup, verify2FA } from '../lib/waline/auth';
import type { UserInfo } from '../lib/waline/types';
import { updateProfile } from '../lib/waline/user';
import { toast } from '../composables/waline-toast';

definePageMeta({
  layout: 'waline',
  middleware: 'waline-auth',
});

const auth = useWalineAuth();
const route = useRoute();

const user = computed(() => auth.user.value);

const profile = ref({
  display_name: '',
  url: '',
  avatar: '',
  label: '',
  notify_admin_comment: true,
  notify_reply: true,
});
const saving = ref(false);

const newPassword = ref('');
const confirmPassword = ref('');
const changingPassword = ref(false);

// 两步验证
const setup2fa = ref(false);
const setup = ref<{ otpauth_url: string; secret: string } | null>(null);
const setupCode = ref('');
const setupLoading = ref(false);
const setupError = ref('');
const copied = ref('');

const providerLabels: Record<string, string> = {
  github: 'GitHub',
  twitter: 'Twitter',
  facebook: 'Facebook',
  google: 'Google',
  weibo: '微博',
  qq: 'QQ',
};

const socials = computed(() => {
  const u = user.value;
  if (!u) return [];
  return (
    [
      ['github', u.github],
      ['twitter', u.twitter],
      ['facebook', u.facebook],
      ['google', u.google],
      ['weibo', u.weibo],
      ['qq', u.qq],
    ] as [string, string | undefined][]
  ).map(([key, value]) => ({
    key,
    label: providerLabels[key] || key,
    value,
  }));
});

/** 生成社交账号绑定链接：携带当前用户 JWT 作为 state，回调回 /profile */
function bindUrl(key: string) {
  return `/api/oauth?type=${encodeURIComponent(key)}&redirect=/profile&state=${encodeURIComponent(auth.token.value || '')}`;
}

const bindErrorMap: Record<string, string> = {
  oauth_failed: '绑定失败：第三方授权失败，请重试。',
  oauth_no_id: '绑定失败：未能从第三方获取到账号信息。',
  oauth_already_bound: '绑定失败：该社交账号已绑定到其他账户。',
  oauth_create_failed: '绑定失败：创建账户失败，请重试。',
  account_banned: '绑定失败：该账号已被封禁。',
  server_error: '绑定失败：服务器错误，请稍后重试。',
  oauth_error: '绑定失败：OAuth 授权出错，请重试。',
};

onMounted(async () => {
  // 绑定回调 URL 为 /profile?token=...（无 lng 参数）；
  // 评论组件头像弹窗为 /profile?lng=...&token=...（仅自动登录，不提示绑定）。
  if (route.query.error) {
    toast(
      bindErrorMap[route.query.error as string] || '绑定失败，请重试。',
      'err',
    );
  } else if (route.query.token && !route.query.lng) {
    toast('社交账号绑定成功');
  }

  await auth.init();
  applyUser(auth.user.value);
});

function applyUser(u: UserInfo | null) {
  if (!u) return;
  profile.value = {
    display_name: u.display_name || '',
    url: u.url || '',
    avatar: u.avatar || '',
    label: u.label || '',
    notify_admin_comment: (u.notify_admin_comment ?? 1) !== 0,
    notify_reply: (u.notify_reply ?? 1) !== 0,
  };
}

async function saveProfile() {
  saving.value = true;
  try {
    await updateProfile({
      display_name: profile.value.display_name.trim(),
      url: profile.value.url.trim(),
      avatar: profile.value.avatar.trim(),
      label: profile.value.label.trim(),
      notify_admin_comment: profile.value.notify_admin_comment ? 1 : 0,
      notify_reply: profile.value.notify_reply ? 1 : 0,
    });
    await auth.init();
    applyUser(auth.user.value);
    toast('资料已更新');
  } catch (e: any) {
    toast(e?.message || '保存失败', 'err');
  } finally {
    saving.value = false;
  }
}

async function changePassword() {
  if (newPassword.value.length < 6) {
    toast('新密码至少 6 位', 'err');
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    toast('两次输入的密码不一致', 'err');
    return;
  }

  changingPassword.value = true;
  try {
    await updateProfile({ password: newPassword.value });
    newPassword.value = '';
    confirmPassword.value = '';
    toast('密码已更新');
  } catch (e: any) {
    toast(e?.message || '修改失败', 'err');
  } finally {
    changingPassword.value = false;
  }
}

async function start2fa() {
  setupLoading.value = true;
  setupError.value = '';
  try {
    setup.value = await get2FASetup();
    setup2fa.value = true;
  } catch (e: any) {
    setupError.value = e?.message || '获取两步验证信息失败';
  } finally {
    setupLoading.value = false;
  }
}

async function confirm2fa() {
  if (!setup.value) return;
  if (!/^\d{6}$/.test(setupCode.value)) {
    setupError.value = '请输入 6 位验证码';
    return;
  }

  setupLoading.value = true;
  setupError.value = '';
  try {
    await verify2FA(setup.value.secret, setupCode.value);
    setup2fa.value = false;
    setup.value = null;
    setupCode.value = '';
    await auth.init();
    toast('两步验证已启用');
  } catch (e: any) {
    setupError.value = e?.message || '验证失败，请重试';
  } finally {
    setupLoading.value = false;
  }
}

async function copy(text: string, key: string) {
  try {
    await navigator.clipboard.writeText(text);
    copied.value = key;
    setTimeout(() => (copied.value = ''), 1500);
  } catch {
    toast('复制失败，请手动复制', 'err');
  }
}
</script>

<template>
  <WalinePage
    title="账户管理"
    description="管理你的个人资料、登录密码与两步验证"
  >
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <div class="divide-y divide-default">
        <!-- 账号概览 -->
        <div class="flex items-center gap-4 p-5 sm:p-6">
          <UAvatar
            :src="user?.avatar || undefined"
            :alt="user?.display_name || user?.email || '账户'"
            size="xl"
          />
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-medium text-highlighted">
                {{ user?.display_name || user?.email }}
              </span>
              <UBadge
                :color="
                  user?.type === 'administrator'
                    ? 'primary'
                    : user?.type === 'banned'
                      ? 'error'
                      : 'neutral'
                "
                variant="subtle"
                size="sm"
              >
                {{
                  user?.type === 'administrator'
                    ? '管理员'
                    : user?.type === 'banned'
                      ? '已封禁'
                      : user?.type?.startsWith('verify:')
                        ? '未验证'
                        : '访客'
                }}
              </UBadge>
            </div>
            <div class="mt-1 truncate text-sm text-muted">
              {{ user?.email }}
            </div>
          </div>
        </div>

        <!-- 基本资料 -->
        <section class="p-5 sm:p-6">
          <h2 class="mb-4 font-medium text-highlighted">基本资料</h2>
          <form class="space-y-4" @submit.prevent="saveProfile">
            <UFormField label="昵称">
              <UInput v-model="profile.display_name" class="w-full" />
            </UFormField>

            <UFormField label="主页">
              <UInput
                v-model="profile.url"
                type="url"
                placeholder="https://"
                class="w-full"
              />
            </UFormField>

            <UFormField
              label="头像 URL"
              help="留空时使用邮箱生成的 Gravatar 头像"
            >
              <UInput
                v-model="profile.avatar"
                type="url"
                placeholder="https://…"
                class="w-full"
              />
            </UFormField>

            <UFormField label="标签">
              <UInput
                v-model="profile.label"
                placeholder="如：站长"
                class="w-full"
              />
            </UFormField>

            <UButton
              type="submit"
              color="primary"
              :loading="saving"
              label="保存资料"
            />
          </form>
        </section>

        <!-- 邮件通知 -->
        <section class="p-5 sm:p-6">
          <h2 class="mb-1 font-medium text-highlighted">邮件通知</h2>
          <p class="mb-4 text-sm text-muted">选择你希望通过邮件接收哪些通知</p>
          <form class="space-y-4" @submit.prevent="saveProfile">
            <UCheckbox
              v-model="profile.notify_admin_comment"
              label="收到新评论时通知我（管理员）"
            />
            <UCheckbox
              v-model="profile.notify_reply"
              label="有人回复我的评论时通知我"
            />
            <UButton
              type="submit"
              color="neutral"
              variant="subtle"
              :loading="saving"
              label="保存通知设置"
            />
          </form>
        </section>

        <!-- 修改密码 -->
        <section class="p-5 sm:p-6">
          <h2 class="mb-4 font-medium text-highlighted">修改密码</h2>
          <form class="space-y-4" @submit.prevent="changePassword">
            <UFormField label="新密码">
              <UInput
                v-model="newPassword"
                type="password"
                autocomplete="new-password"
                placeholder="至少 6 位"
                class="w-full"
              />
            </UFormField>

            <UFormField label="确认新密码">
              <UInput
                v-model="confirmPassword"
                type="password"
                autocomplete="new-password"
                placeholder="再次输入"
                class="w-full"
              />
            </UFormField>

            <UButton
              type="submit"
              color="neutral"
              variant="subtle"
              :loading="changingPassword"
              label="更新密码"
            />
          </form>
        </section>

        <!-- 两步验证 -->
        <section class="p-5 sm:p-6">
          <div class="mb-4 flex items-center gap-2">
            <h2 class="font-medium text-highlighted">两步验证（2FA）</h2>
            <UBadge
              v-if="user?.['2fa']"
              color="success"
              variant="subtle"
              size="sm"
            >
              已启用
            </UBadge>
          </div>

          <template v-if="!setup2fa">
            <p class="mb-4 text-sm text-muted">
              开启后，登录时除密码外还需输入身份验证器中的 6
              位动态码，增强账号安全。
            </p>
            <UButton
              v-if="!user?.['2fa']"
              color="neutral"
              variant="subtle"
              :loading="setupLoading"
              label="启用两步验证"
              @click="start2fa"
            />
          </template>

          <template v-else-if="setup">
            <ol class="space-y-4 text-sm text-muted">
              <li>
                1. 在身份验证器 App（Google Authenticator、Microsoft
                Authenticator 等）中添加账号，手动输入下面的密钥：
              </li>
              <li>
                <div class="flex flex-wrap items-center gap-2">
                  <code
                    class="rounded-sm bg-elevated px-2 py-1 font-mono text-xs text-highlighted"
                  >
                    {{ setup.secret }}
                  </code>
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    :label="copied === 'secret' ? '已复制' : '复制密钥'"
                    @click="copy(setup.secret, 'secret')"
                  />
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    :label="copied === 'url' ? '已复制' : '复制 otpauth 链接'"
                    @click="copy(setup.otpauth_url, 'url')"
                  />
                </div>
              </li>
              <li>
                <div class="flex flex-wrap items-end gap-3">
                  <UFormField
                    label="输入 6 位验证码以确认"
                    :error="setupError"
                    class="w-40"
                  >
                    <UInput
                      v-model="setupCode"
                      inputmode="numeric"
                      maxlength="6"
                      placeholder="6 位数字"
                      class="w-full"
                    />
                  </UFormField>
                  <UButton
                    color="primary"
                    :loading="setupLoading"
                    label="确认并启用"
                    @click="confirm2fa"
                  />
                </div>
              </li>
            </ol>
          </template>
        </section>

        <!-- 社交账号绑定 -->
        <section class="p-5 sm:p-6">
          <h2 class="mb-1 font-medium text-highlighted">社交账号绑定</h2>
          <p class="mb-4 text-sm text-muted">
            绑定后即可使用对应的社交账号快捷登录
          </p>

          <ul v-if="socials.length" class="divide-y divide-default">
            <li
              v-for="social in socials"
              :key="social.key"
              class="flex items-center justify-between gap-3 py-2.5"
            >
              <div class="flex items-center gap-2">
                <span class="text-sm text-highlighted">{{ social.label }}</span>
                <UBadge
                  :color="social.value ? 'success' : 'neutral'"
                  variant="subtle"
                  size="sm"
                >
                  {{ social.value ? '已绑定' : '未绑定' }}
                </UBadge>
              </div>
              <UButton
                v-if="!social.value"
                color="neutral"
                variant="ghost"
                size="sm"
                external
                label="绑定"
                :href="bindUrl(social.key)"
              />
              <span v-else class="truncate text-xs text-dimmed">
                {{ social.value }}
              </span>
            </li>
          </ul>
        </section>
      </div>
    </UCard>
  </WalinePage>
</template>
