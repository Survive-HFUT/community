<script setup lang="ts">
import {
  ELECTIVE_CAMPUSES,
  ELECTIVE_CATEGORIES,
  ELECTIVE_TYPES,
} from '../../lib/electives/constants';

definePageMeta({ layout: 'waline' });

const {
  searchInput,
  type,
  campus,
  category,
  sort,
  courses,
  total,
  source,
  pending,
  error,
  refresh,
} = useElectiveCourses();

const typeItems = [{ label: '全部类型', value: 'all' }, ...ELECTIVE_TYPES];
const campusItems = [{ label: '全部校区', value: 'all' }, ...ELECTIVE_CAMPUSES];
const categoryItems = [
  { label: '全部类别', value: 'all' },
  ...ELECTIVE_CATEGORIES,
];
const sortItems = [
  { label: '综合评分 ↓', value: 'score' },
  { label: '评价数 ↓', value: 'reviews' },
  { label: '学习轻松度 ↓', value: 'ease' },
  { label: '课程名称', value: 'name' },
];

useSeoMeta({ title: '选修课评价' });
</script>

<template>
  <WalinePage title="选修课评价" description="看看同学怎么说，再决定选哪门课">
    <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <UInput
        v-model="searchInput"
        icon="i-lucide-search"
        placeholder="搜索课程名或教师"
        class="w-full sm:max-w-xs"
      />
      <USelect v-model="type" :items="typeItems" class="w-full sm:w-36" />
      <USelect v-model="campus" :items="campusItems" class="w-full sm:w-32" />
      <USelect
        v-model="category"
        :items="categoryItems"
        class="w-full sm:w-56"
      />
      <USelect v-model="sort" :items="sortItems" class="w-full sm:w-40" />
    </div>

    <div class="mt-6 flex flex-wrap items-center justify-between gap-3">
      <p class="text-xs text-muted">
        {{ pending ? '正在加载…' : `共 ${total} 门课程` }}
      </p>
      <UButton
        to="/electives/rate"
        icon="i-lucide-pen-line"
        size="sm"
        label="写评价"
      />
    </div>

    <p v-if="source" class="mt-2 text-xs text-dimmed">
      目录快照：{{ source.term }}，来源：
      <template v-for="(item, index) in source.sources" :key="item.url">
        <span v-if="index">、</span>
        <a
          :href="item.url"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary underline-offset-2 hover:underline"
        >
          {{ item.label }}
        </a>
      </template>
    </p>

    <div class="mt-2 flex items-center gap-3">
      <p v-if="error" class="text-xs text-error">课程列表加载失败</p>
      <UButton
        v-if="error"
        color="error"
        variant="link"
        size="xs"
        label="重试"
        @click="refresh()"
      />
    </div>

    <div
      v-if="courses.length"
      class="mt-2 divide-y divide-default border-t border-default"
    >
      <ElectiveCourseRow
        v-for="summary in courses"
        :key="summary.course.id"
        :summary="summary"
      />
    </div>

    <div v-else-if="pending" class="py-16">
      <UEmpty loading title="正在加载课程…" />
    </div>

    <div v-else class="py-16">
      <UEmpty
        icon="i-lucide-search-x"
        title="没有匹配的课程"
        description="试试换个关键词，或放宽筛选条件"
      />
    </div>
  </WalinePage>
</template>
