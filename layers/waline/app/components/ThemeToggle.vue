<script setup lang="ts">
/**
 * 主题切换：跟随系统 / 浅色 / 深色。
 *
 * 默认跟随系统（`preference: 'system'`，见 layer 的 nuxt.config.ts），
 * 用户手动选择后写入 localStorage（键名 community-color-mode）。
 */
const colorMode = useColorMode();

type Mode = 'system' | 'light' | 'dark';

const options: { value: Mode; label: string; icon: string }[] = [
  { value: 'system', label: '跟随系统', icon: 'i-lucide-monitor' },
  { value: 'light', label: '浅色', icon: 'i-lucide-sun' },
  { value: 'dark', label: '深色', icon: 'i-lucide-moon' },
];

const preference = computed<Mode>(
  () => (colorMode.preference as Mode) || 'system',
);

const current = computed(
  () => options.find((o) => o.value === preference.value) ?? options[0],
);

const items = computed(() => [
  options.map((option) => ({
    label: option.label,
    icon: option.icon,
    type: 'checkbox' as const,
    checked: preference.value === option.value,
    onSelect: () => {
      colorMode.preference = option.value;
    },
  })),
]);
</script>

<template>
  <UDropdownMenu :items="items" :content="{ align: 'end' }">
    <UButton
      color="neutral"
      variant="ghost"
      size="sm"
      square
      :icon="current!.icon"
      :aria-label="`主题：${current!.label}`"
    />
  </UDropdownMenu>
</template>
