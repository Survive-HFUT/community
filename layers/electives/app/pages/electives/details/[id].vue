<script setup lang="ts">
import {
  assessmentLabel,
  campusLabel,
  categoryLabel,
  electiveTypeLabel,
  overallScore,
  OVERALL_SCORE_LABEL,
  SCORE_DIMENSIONS,
} from '../../../lib/electives/constants';
import { formatDate, formatScore } from '../../../lib/electives/format';
import type { AssessmentForm } from '../../../lib/electives/types';

definePageMeta({ layout: 'waline' });

const route = useRoute();
const { detail, pending, notFound } = useElectiveCourse(() =>
  String(route.params.id ?? ''),
);

useSeoMeta({
  title: () =>
    detail.value ? `${detail.value.course.name} · 选修课评价` : '选修课评价',
});

/** 考核形式按被提到的次数从多到少排列 */
const assessmentRows = computed(() => {
  if (!detail.value) return [];

  return (
    Object.entries(detail.value.assessmentCounts) as [AssessmentForm, number][]
  )
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([form, count]) => ({ form, label: assessmentLabel(form), count }));
});
</script>

<template>
  <WalinePage>
    <div v-if="pending" class="py-16">
      <UEmpty loading title="正在加载课程…" />
    </div>

    <div
      v-else-if="notFound || !detail"
      class="flex flex-col items-center gap-4 py-16"
    >
      <UEmpty
        icon="i-lucide-file-question"
        title="课程不存在"
        description="它可能已被删除，或者链接不正确"
      />
      <UButton
        to="/electives/overview"
        variant="soft"
        icon="i-lucide-arrow-left"
        label="返回总览"
      />
    </div>

    <div v-else class="space-y-8">
      <div class="space-y-3">
        <UButton
          to="/electives/overview"
          variant="link"
          size="xs"
          icon="i-lucide-arrow-left"
          label="返回总览"
          class="px-0"
        />

        <div class="flex flex-wrap items-center gap-2">
          <h1 class="text-xl font-semibold text-highlighted sm:text-2xl">
            {{ detail.course.name }}
          </h1>
          <UBadge color="neutral" variant="subtle" size="sm">
            {{ campusLabel(detail.course.campus) }}
          </UBadge>
          <UBadge color="neutral" variant="subtle" size="sm">
            {{ electiveTypeLabel(detail.course.type) }}
          </UBadge>
          <UBadge
            v-if="detail.course.category"
            color="primary"
            variant="subtle"
            size="sm"
          >
            {{ categoryLabel(detail.course.category) }}
          </UBadge>
        </div>

        <p class="text-sm text-muted">任课教师：{{ detail.course.teacher }}</p>
      </div>

      <section
        class="flex flex-col gap-6 border-y border-default py-6 sm:flex-row sm:gap-10"
      >
        <div class="shrink-0 space-y-2">
          <div class="flex items-baseline gap-2">
            <span class="text-4xl font-semibold tabular-nums text-highlighted">
              {{ formatScore(detail.score) }}
            </span>
            <span class="text-sm text-muted">/ 5</span>
          </div>
          <UInputRating
            :model-value="detail.score"
            readonly
            :step="0.1"
            empty-icon="i-ph-star"
            icon="i-ph-star-fill"
          />
          <p class="text-xs text-muted">{{ detail.reviewCount }} 条评价</p>
        </div>

        <div class="min-w-0 flex-1 space-y-3">
          <ElectiveScoreBar
            v-for="dimension in SCORE_DIMENSIONS"
            :key="dimension.key"
            :label="dimension.label"
            :value="detail.averages[dimension.key]"
          />
        </div>
      </section>

      <section v-if="detail.reviewCount" class="space-y-3">
        <h2 class="text-sm font-medium text-highlighted">考核形式</h2>
        <div class="flex flex-wrap gap-2">
          <UBadge
            v-for="row in assessmentRows"
            :key="row.form"
            color="neutral"
            variant="outline"
            size="sm"
          >
            {{ row.label }} · {{ row.count }} 人
          </UBadge>
        </div>
        <p v-if="detail.averageQuestions" class="text-xs text-muted">
          线上题数平均约 {{ detail.averageQuestions }} 题
        </p>
      </section>

      <section class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-sm font-medium text-highlighted">全部评价</h2>
          <UButton
            :to="`/electives/rate?course=${detail.course.id}`"
            size="sm"
            variant="soft"
            icon="i-lucide-pen-line"
            label="写评价"
          />
        </div>

        <div
          v-if="detail.reviews.length"
          class="divide-y divide-default border-t border-default"
        >
          <article
            v-for="review in detail.reviews"
            :key="review.id"
            class="py-5"
          >
            <div class="flex items-start gap-3">
              <UAvatar
                :src="review.reviewer.avatar || undefined"
                :alt="review.reviewer.name"
                size="sm"
              />
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span class="text-sm font-medium text-highlighted">
                    {{ review.reviewer.name }}
                  </span>
                  <UBadge color="neutral" variant="subtle" size="sm">
                    {{ review.term }}
                  </UBadge>
                  <span class="text-xs text-dimmed">
                    {{ formatDate(review.createdAt) }}
                  </span>
                </div>

                <div
                  class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted"
                >
                  <span class="flex items-center gap-1.5">
                    {{ OVERALL_SCORE_LABEL }}
                    <UInputRating
                      :model-value="overallScore(review.scores)"
                      readonly
                      empty-icon="i-ph-star"
                      icon="i-ph-star-fill"
                      :step="0.1"
                      size="sm"
                    />
                  </span>
                  <span
                    v-for="dimension in SCORE_DIMENSIONS"
                    :key="dimension.key"
                  >
                    {{ dimension.label }} {{ review.scores[dimension.key] }}
                  </span>
                  <span v-if="review.questions">
                    题数 {{ review.questions }}
                  </span>
                </div>

                <div class="mt-2 flex flex-wrap gap-1.5">
                  <UBadge
                    v-for="form in review.assessment"
                    :key="form"
                    color="neutral"
                    variant="outline"
                    size="sm"
                  >
                    {{ assessmentLabel(form) }}
                  </UBadge>
                </div>

                <p
                  v-if="review.comment"
                  class="mt-3 text-sm whitespace-pre-wrap"
                >
                  {{ review.comment }}
                </p>
              </div>
            </div>
          </article>
        </div>

        <div v-else class="flex flex-col items-center gap-4 py-10">
          <UEmpty
            icon="i-lucide-message-circle-dashed"
            title="还没有评价"
            description="成为第一个分享体验的人"
          />
          <UButton
            :to="`/electives/rate?course=${detail.course.id}`"
            icon="i-lucide-pen-line"
            label="写第一条评价"
          />
        </div>
      </section>
    </div>
  </WalinePage>
</template>
