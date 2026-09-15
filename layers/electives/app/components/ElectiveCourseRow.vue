<script setup lang="ts">
import {
  campusLabel,
  categoryLabel,
  electiveTypeLabel,
  SCORE_DIMENSIONS,
} from '../lib/electives/constants';
import { formatScore } from '../lib/electives/format';
import type { ElectiveCourseSummary } from '../lib/electives/types';

/** 总览页的列表行；整行是一个指向详情页的链接 */
defineProps<{ summary: ElectiveCourseSummary }>();
</script>

<template>
  <NuxtLink
    :to="`/electives/details/${summary.course.id}`"
    class="-mx-2 flex flex-col gap-3 rounded-lg px-2 py-4 transition-colors hover:bg-elevated/60 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
  >
    <div class="min-w-0">
      <div class="flex flex-wrap items-center gap-2">
        <span class="font-medium text-highlighted">
          {{ summary.course.name }}
        </span>
        <UBadge color="neutral" variant="subtle" size="sm">
          {{ campusLabel(summary.course.campus) }}
        </UBadge>
        <UBadge color="neutral" variant="subtle" size="sm">
          {{ electiveTypeLabel(summary.course.type) }}
        </UBadge>
      </div>

      <p class="mt-1 text-xs text-muted">
        {{ summary.course.teacher }}
        <template v-if="summary.course.category">
          · {{ categoryLabel(summary.course.category) }}
        </template>
      </p>
      <p
        v-if="summary.course.courseCode || summary.course.credits"
        class="mt-1 text-xs text-dimmed"
      >
        <template v-if="summary.course.courseCode">
          课程代码 {{ summary.course.courseCode }}
        </template>
        <template v-if="summary.course.credits">
          · {{ summary.course.credits }} 学分
        </template>
      </p>

      <div
        v-if="summary.reviewCount"
        class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-dimmed"
      >
        <span v-for="dimension in SCORE_DIMENSIONS" :key="dimension.key">
          {{ dimension.label }}
          {{ formatScore(summary.averages[dimension.key]) }}
        </span>
      </div>
      <p v-else class="mt-2 text-xs text-dimmed">还没有评价，来做第一个</p>
    </div>

    <div
      class="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-1"
    >
      <div class="flex items-center gap-2">
        <span class="text-lg font-semibold tabular-nums text-highlighted">
          {{ formatScore(summary.score) }}
        </span>
        <UInputRating
          :model-value="summary.score"
          readonly
          size="sm"
          empty-icon="i-ph-star"
          icon="i-ph-star-fill"
          :step="0.1"
        />
      </div>
      <span class="text-xs text-muted">{{ summary.reviewCount }} 条评价</span>
    </div>
  </NuxtLink>
</template>
