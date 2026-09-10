<script setup lang="ts">
/**
 * 首页 / 导航用的入口卡片（纯展示组件）。
 *
 * 与 `useSiteLinks()` 的 `SiteLink` 结构兼容，也接受手写的 `{ to, label, description, icon }`。
 */
defineProps<{
  to: string;
  label: string;
  icon?: string;
  description?: string;
}>();
</script>

<template>
  <NuxtLink
    :to="to"
    class="flex items-start gap-3 rounded-lg border border-default p-4 transition-colors hover:border-primary/60 hover:bg-elevated/50"
  >
    <UIcon
      v-if="icon"
      :name="icon"
      class="mt-0.5 size-5 shrink-0 text-primary"
    />
    <div class="min-w-0">
      <div class="font-medium text-highlighted">{{ label }}</div>
      <div v-if="description" class="mt-0.5 text-sm text-muted">
        {{ description }}
      </div>
    </div>
  </NuxtLink>
</template>
