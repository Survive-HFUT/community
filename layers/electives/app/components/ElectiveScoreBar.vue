<script setup lang="ts">
import { formatScore, scorePercent } from '../lib/electives/format';

/** 详情页的单个维度均分条 */
const props = defineProps<{
  label: string;
  /** 1–5 的均分，0 表示暂无评分 */
  value: number;
}>();

const percent = computed(() => scorePercent(props.value));
</script>

<template>
  <div class="flex items-center gap-3">
    <span class="w-18 shrink-0 text-sm text-muted">{{ label }}</span>
    <div class="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-elevated">
      <div
        class="h-full rounded-full bg-primary transition-[width] duration-300"
        :style="{ width: `${percent}%` }"
      />
    </div>
    <span class="w-8 shrink-0 text-right text-sm tabular-nums text-highlighted">
      {{ formatScore(value) }}
    </span>
  </div>
</template>
