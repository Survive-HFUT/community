<script setup lang="ts">
/**
 * 登录 / 注册 / OAuth 页的居中外壳。
 *
 * 高度撑满顶栏与页脚之间的剩余空间，卡片在水平与垂直方向都居中。
 */
defineProps<{
  title: string;
  description?: string;
}>();
</script>

<template>
  <div class="flex flex-1 items-center justify-center px-4 py-10">
    <div class="w-full max-w-sm">
      <div class="mb-6 text-center">
        <h1 class="text-xl font-semibold text-highlighted">{{ title }}</h1>
        <p v-if="description" class="mt-1.5 text-sm text-muted">
          {{ description }}
        </p>
      </div>

      <UCard>
        <slot />
      </UCard>

      <div v-if="$slots.footer" class="mt-5 text-center text-sm text-muted">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>
