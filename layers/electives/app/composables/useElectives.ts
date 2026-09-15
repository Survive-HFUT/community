import type {
  ElectiveCampus,
  ElectiveCategory,
  ElectiveCourseDetail,
  ElectiveCourseSummary,
  ElectiveReview,
  ElectiveReviewInput,
  ElectiveType,
} from '../lib/electives/types';
import { request } from '../../../waline/app/lib/waline/client';

interface ElectiveCourseListResponse {
  data: ElectiveCourseSummary[];
  total: number;
  source?: {
    term: string;
    sources: Array<{ label: string; url: string }>;
  };
}

interface ElectiveCourseDetailResponse {
  data: ElectiveCourseDetail;
}

/** `all` 表示该筛选条件不限 */
type FilterValue<T extends string> = T | 'all';

export type ElectiveCourseSort = 'score' | 'reviews' | 'ease' | 'name';

/**
 * 课程总览的筛选条件 + 数据。
 *
 * `searchInput` 是输入框的即时值，`q` 是防抖 250ms 后的查询值；
 * `useFetch` 会监听这些 ref，任一变化就自动重新请求。
 */
export function useElectiveCourses() {
  const searchInput = ref('');
  const q = ref('');
  const type = ref<FilterValue<ElectiveType>>('all');
  const campus = ref<FilterValue<ElectiveCampus>>('all');
  const category = ref<FilterValue<ElectiveCategory>>('all');
  const sort = ref<ElectiveCourseSort>('score');

  let timer: ReturnType<typeof setTimeout> | undefined;
  watch(searchInput, (value) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      q.value = value.trim();
    }, 250);
  });
  onScopeDispose(() => {
    if (timer) clearTimeout(timer);
  });

  const { data, pending, error, refresh } =
    useFetch<ElectiveCourseListResponse>('/api/electives/courses', {
      query: { q, type, campus, category, sort },
    });

  const courses = computed(() => data.value?.data ?? []);
  const total = computed(() => data.value?.total ?? 0);
  const source = computed(() => data.value?.source);

  return {
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
  };
}

/** 单个课程的详情 */
export function useElectiveCourse(id: MaybeRefOrGetter<string>) {
  const { data, pending, error, refresh } =
    useFetch<ElectiveCourseDetailResponse>(
      () => `/api/electives/courses/${encodeURIComponent(toValue(id))}`,
    );

  const detail = computed(() => data.value?.data ?? null);
  const notFound = computed(
    () => (error.value as { statusCode?: number } | null)?.statusCode === 404,
  );

  return { detail, pending, error, notFound, refresh };
}

/** 提交一条评价，返回服务端创建的记录（用来跳转到对应课程详情） */
export async function submitElectiveReview(
  input: ElectiveReviewInput,
): Promise<ElectiveReview> {
  return request<ElectiveReview>('/electives/reviews', {
    method: 'POST',
    body: input,
  });
}
