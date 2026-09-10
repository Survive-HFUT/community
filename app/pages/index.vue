<script setup lang="ts">
import type { SiteLink } from '#layers/waline/app/composables/useSiteLinks';

/**
 * 首页。
 *
 * 入口列表 = 未登录时的账号入口 + 各 layer 注册的功能入口，
 * 后者来自 `layers/waline/app/composables/useSiteLinks.ts` 的注册表，
 * 新 layer 只要在自己的 plugin 里 `registerSiteLinks(...)` 即可出现在这里，
 * 不需要修改本文件。
 *
 * 复用 waline 布局，让首页与其它页面共享同一套导航栏 / 页脚与内容宽度。
 *
 * ⚠️ `/` 是预渲染页面（见 nuxt.config.ts 的 nitro.prerender），服务端拿不到登录态，
 * 所以入口网格必须包在 `<ClientOnly>` 里：否则服务端渲染出的访客卡片会被客户端
 * 复用时保留旧的 `href`，出现「标签是仪表盘、链接却指向 /login」的错位。
 */
definePageMeta({
  layout: 'waline',
});

const auth = useWalineAuth();

/** 未登录时的账号入口；同时作为 ClientOnly 的服务端回退内容（必须与客户端首帧一致） */
const guestEntries: SiteLink[] = [
  {
    to: '/login',
    label: '登录',
    icon: 'i-lucide-log-in',
    description: '邮箱 + 密码 / 两步验证',
  },
  {
    to: '/register',
    label: '注册',
    icon: 'i-lucide-user-plus',
    description: '首个注册账号自动成为管理员',
  },
];

/** 各 layer 注册的功能入口（已按登录态与权限过滤） */
const featureEntries = useSiteLinks('home');

const entries = computed<SiteLink[]>(() =>
  auth.isLoggedIn.value
    ? featureEntries.value
    : [...guestEntries, ...featureEntries.value],
);

useSeoMeta({ title: '活在肥宣社区' });
</script>

<template>
  <UContainer class="py-12 sm:py-16">
    <h1 class="text-2xl font-semibold text-highlighted sm:text-3xl">
      活在肥宣社区
    </h1>
    <p class="mt-2 text-muted">选择一个入口开始使用</p>

    <ClientOnly>
      <div class="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SiteLinkCard
          v-for="entry in entries"
          :key="entry.to"
          :to="entry.to"
          :label="entry.label"
          :icon="entry.icon"
          :description="entry.description"
        />
      </div>

      <template #fallback>
        <div class="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SiteLinkCard
            v-for="entry in guestEntries"
            :key="entry.to"
            :to="entry.to"
            :label="entry.label"
            :icon="entry.icon"
            :description="entry.description"
          />
        </div>
      </template>
    </ClientOnly>
  </UContainer>
</template>
