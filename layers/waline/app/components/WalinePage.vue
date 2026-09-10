<script setup lang="ts">
/**
 * 标准页面外壳：统一内容宽度、左右内边距与顶部留白。
 *
 * 所有后台页面都套这一层，保证导航栏、标题、内容左右边缘完全对齐
 * （宽度由主题里的 `--ui-container` 控制）。
 */
defineProps<{
  title?: string;
  description?: string;
}>();
</script>

<template>
  <UContainer class="py-8 sm:py-10">
    <header v-if="title" class="mb-6">
      <h1 class="text-xl font-semibold text-highlighted sm:text-2xl">
        {{ title }}
      </h1>
      <p v-if="description" class="mt-1.5 text-sm text-muted">
        {{ description }}
      </p>
    </header>

    <slot />
  </UContainer>
</template>
