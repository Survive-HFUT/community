<script setup lang="ts">
import { installToast } from '../composables/waline-toast';

// 捕获 Nuxt UI 的 toast API（必须在 <UApp> 内部执行，根 app.vue 已提供 UApp）
installToast();

const auth = useWalineAuth();
const route = useRoute();

/**
 * 顶栏导航项。
 *
 * 全部来自站点导航注册表（`app/composables/useSiteLinks.ts`），
 * 所以新增 layer 只要在自己的 plugin 里调用 `registerSiteLinks(...)`
 * 就能出现在这里，**不需要修改本文件**。
 */
const navLinks = useSiteLinks('header');

const displayName = computed(
  () => auth.user.value?.display_name || auth.user.value?.email || '账户',
);

const mobileNavItems = computed(() => [
  navLinks.value.map((link) => ({
    label: link.label,
    icon: link.icon,
    onSelect: () => navigateTo(link.to),
  })),
]);

const userMenuItems = computed(() => {
  const groups: Record<string, unknown>[][] = [];

  if (auth.user.value?.email) {
    groups.push([{ label: auth.user.value.email, type: 'label' }]);
  }
  groups.push([
    {
      label: '个人资料',
      icon: 'i-lucide-user-round',
      onSelect: () => navigateTo('/profile'),
    },
  ]);
  groups.push([
    {
      label: '退出登录',
      icon: 'i-lucide-log-out',
      color: 'error',
      onSelect: () => logout(),
    },
  ]);

  return groups;
});

function logout() {
  auth.logout();
  navigateTo('/login');
}
</script>

<template>
  <!--
    服务端无法得知登录态（token 存在 sessionStorage），因此所有依赖 `auth` 的部分
    都包在 <ClientOnly> 里，回退内容固定渲染「匿名态」。
    否则登录用户加载预渲染页面（如 /）时会出现 hydration 不匹配：
    Vue 复用服务端节点却不更新属性，可能得到「文案对了但链接错了」的导航。
  -->
  <header
    class="sticky top-0 z-50 border-b border-default bg-default/80 backdrop-blur"
  >
    <UContainer class="flex h-[var(--ui-header-height)] items-center gap-2">
      <NuxtLink
        to="/"
        class="flex shrink-0 items-center gap-2 font-semibold text-highlighted"
      >
        <UIcon name="i-lucide-messages-square" class="size-5 text-primary" />
        <span class="hidden sm:inline">活在肥宣社区</span>
      </NuxtLink>

      <!-- 桌面端内联导航（内容随 layer 注册表变化，仅客户端渲染） -->
      <ClientOnly>
        <nav
          v-if="navLinks.length"
          class="ml-2 hidden items-center gap-0.5 md:flex"
        >
          <UButton
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            :label="link.label"
            color="neutral"
            size="sm"
            :variant="route.path === link.to ? 'soft' : 'ghost'"
          />
        </nav>
      </ClientOnly>

      <div class="ml-auto flex items-center gap-0.5">
        <ThemeToggle />

        <ClientOnly>
          <template v-if="auth.isLoggedIn.value">
            <UDropdownMenu :items="userMenuItems" :content="{ align: 'end' }">
              <UButton color="neutral" variant="ghost" size="sm">
                <UAvatar
                  :src="auth.user.value?.avatar || undefined"
                  :alt="displayName"
                  size="xs"
                />
                <span class="hidden max-w-32 truncate sm:inline">
                  {{ displayName }}
                </span>
                <UIcon name="i-lucide-chevron-down" class="size-3.5" />
              </UButton>
            </UDropdownMenu>
          </template>

          <template v-else>
            <UButton
              to="/login"
              label="登录"
              color="neutral"
              variant="ghost"
              size="sm"
            />
            <UButton to="/register" label="注册" color="primary" size="sm" />
          </template>

          <!-- 服务端固定渲染匿名态，与首屏一致 -->
          <template #fallback>
            <UButton
              to="/login"
              label="登录"
              color="neutral"
              variant="ghost"
              size="sm"
            />
            <UButton to="/register" label="注册" color="primary" size="sm" />
          </template>
        </ClientOnly>

        <!-- 移动端导航 -->
        <ClientOnly>
          <UDropdownMenu
            v-if="navLinks.length"
            :items="mobileNavItems"
            :content="{ align: 'end' }"
            class="md:hidden"
          >
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-lucide-menu"
              square
              aria-label="导航菜单"
            />
          </UDropdownMenu>
        </ClientOnly>
      </div>
    </UContainer>
  </header>
</template>
