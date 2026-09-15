<script setup lang="ts">
import {
  ASSESSMENT_FORMS,
  CATEGORY_TYPES,
  ELECTIVE_CAMPUSES,
  ELECTIVE_CATEGORIES,
  ELECTIVE_TYPES,
  OVERALL_SCORE_HINT,
  OVERALL_SCORE_LABEL,
  QUESTIONS_TYPE,
  SCORE_DIMENSIONS,
  currentTerm,
  overallScore,
  recentTerms,
} from '../../lib/electives/constants';
import {
  hasElectiveReviewDraft,
  readElectiveReviewDraft,
  writeElectiveReviewDraft,
} from '../../lib/electives/draft';
import { apiErrorMessage, formatScore } from '../../lib/electives/format';
import type {
  AssessmentForm,
  ElectiveCampus,
  ElectiveCategory,
  ElectiveCourse,
  ElectiveScores,
  ElectiveType,
} from '../../lib/electives/types';
// 复用 waline layer 的 toast 单例（由 waline 布局在其 setup 中 install）
import { toast } from '../../../../waline/app/composables/waline-toast';

definePageMeta({ layout: 'waline', middleware: 'waline-auth' });

const route = useRoute();
const auth = useWalineAuth();

const form = reactive({
  courseName: '',
  teacher: '',
  type: 'offline' as ElectiveType,
  campus: 'tunxilu' as ElectiveCampus,
  category: undefined as ElectiveCategory | undefined,
  term: currentTerm(),
  /** 题数在 UInput 里始终是字符串，提交前再解析 */
  questions: '',
  assessment: [] as AssessmentForm[],
  comment: '',
  scores: {
    learnEase: 0,
    highScoreEase: 0,
    checkinEase: 0,
    homeworkEase: 0,
    examEase: 0,
  } as ElectiveScores,
});

const submitting = ref(false);
const draftReady = ref(false);
const draftRestored = ref(false);
const draftStatus = ref<'idle' | 'saved' | 'unavailable'>('idle');

/** 通识教育类别只有线下选修课与线上慕课需要填 */
const showCategory = computed(() => CATEGORY_TYPES.includes(form.type));
/** 题数只有线上慕课需要填 */
const showQuestions = computed(() => form.type === QUESTIONS_TYPE);

/**
 * 五项都打上分后即时预览综合评分（计算规则见 constants.ts 的 `overallScore`）。
 * 没填完时返回 0 并显示为「—」，避免拿半份数据算出一个误导性的分数。
 */
const scorePreview = computed(() => {
  const complete = SCORE_DIMENSIONS.every(
    (dimension) => form.scores[dimension.key] > 0,
  );
  return complete ? overallScore(form.scores) : 0;
});

const termItems = computed(() => recentTerms(8));

const { courses } = useElectiveCourses();

const courseItems = computed(() =>
  courses.value.map((summary) => ({
    label: `${summary.course.name}（${summary.course.teacher}）`,
    value: summary.course.id,
  })),
);

/**
 * 仅用于「选择已有课程」下拉的 UI 状态。
 * 评价真正挂到哪门课，由提交时的「课程名 + 任课教师」决定（见 resolveCourseId）。
 */
const selectedCourseId = ref('');

const draftStorageKey = computed(
  () =>
    `community:elective-review-draft:${auth.user.value?.objectId ?? 'anonymous'}`,
);

function saveDraft() {
  if (!draftReady.value || !import.meta.client) return;

  try {
    const saved = writeElectiveReviewDraft(
      window.localStorage,
      draftStorageKey.value,
      form,
      selectedCourseId.value,
    );
    draftStatus.value = saved ? 'saved' : 'idle';
  } catch {
    // 隐私模式或浏览器禁用 storage 时，评价仍可正常提交。
    draftStatus.value = 'unavailable';
  }
}

function restoreDraft() {
  if (!import.meta.client) {
    draftReady.value = true;
    return;
  }

  try {
    const saved = readElectiveReviewDraft(
      window.localStorage,
      draftStorageKey.value,
    );
    if (saved) {
      form.courseName = saved.form.courseName;
      form.teacher = saved.form.teacher;
      form.type = saved.form.type;
      form.campus = saved.form.campus;
      form.category = saved.form.category;
      form.term = saved.form.term;
      form.questions = saved.form.questions;
      form.assessment = [...saved.form.assessment];
      form.comment = saved.form.comment;
      Object.assign(form.scores, saved.form.scores);
      selectedCourseId.value = saved.selectedCourseId;
      draftRestored.value = hasElectiveReviewDraft(
        saved.form,
        saved.selectedCourseId,
      );
      if (draftRestored.value) {
        draftStatus.value = 'saved';
        toast('已恢复上次未提交的评价草稿');
      }
    }
  } catch {
    draftStatus.value = 'unavailable';
  } finally {
    // 恢复动作完成后才允许 watch 写回，避免用初始空表单覆盖草稿。
    draftReady.value = true;
  }
}

function clearDraft() {
  if (!import.meta.client) return;
  try {
    window.localStorage.removeItem(draftStorageKey.value);
    draftStatus.value = 'idle';
  } catch {
    draftStatus.value = 'unavailable';
  }
}

function handlePageHide() {
  saveDraft();
}

function applyCourse(course: ElectiveCourse) {
  form.courseName = course.name;
  form.teacher = course.teacher;
  form.type = course.type;
  form.campus = course.campus;
  form.category = course.category;
}

watch(selectedCourseId, (id) => {
  if (!id) return;
  const summary = courses.value.find((item) => item.course.id === id);
  if (summary) applyCourse(summary.course);
});

/** 带 `?course=<id>` 进来时预选课程；课程列表是异步的，所以列表到货后也要再试一次 */
function applyPreselect() {
  const courseId =
    typeof route.query.course === 'string' ? route.query.course : '';
  if (!courseId || selectedCourseId.value || draftRestored.value) return;
  if (courses.value.some((item) => item.course.id === courseId)) {
    selectedCourseId.value = courseId;
  }
}

watch(courses, applyPreselect);

watch(form, saveDraft, { deep: true, flush: 'sync' });
watch(selectedCourseId, saveDraft, { flush: 'sync' });

onMounted(() => {
  restoreDraft();
  applyPreselect();
  window.addEventListener('pagehide', handlePageHide);
});

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener('pagehide', handlePageHide);
  }
});

// 切到不需要类别的类型就清掉已选类别；非慕课清掉题数
watch(
  () => form.type,
  (type) => {
    if (!CATEGORY_TYPES.includes(type)) form.category = undefined;
    if (type !== QUESTIONS_TYPE) form.questions = '';
  },
);

/** 命中已收录的课程就挂在它下面，否则服务端会新建一门 */
function resolveCourseId(): string | undefined {
  const name = form.courseName.trim();
  const teacher = form.teacher.trim();
  return courses.value.find(
    (item) => item.course.name === name && item.course.teacher === teacher,
  )?.course.id;
}

/** 题数留空返回 undefined；填了但不是正整数也返回 undefined（由 validate 拦下） */
function parseQuestions(): number | undefined {
  const raw = form.questions.trim();
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function validate(): string | null {
  if (!form.courseName.trim()) return '请填写课程名称';
  if (!form.teacher.trim()) return '请填写任课教师';
  if (showCategory.value && !form.category) return '请选择通识教育类别';
  if (!form.term) return '请选择学期';
  if (!form.assessment.length) return '请至少选择一种考核形式';

  const missing = SCORE_DIMENSIONS.find(
    (dimension) => !form.scores[dimension.key],
  );
  if (missing) return `请为「${missing.label}」打分（1–5 星）`;

  if (showQuestions.value && form.questions.trim() && !parseQuestions()) {
    return '题数需要是大于 0 的整数';
  }

  return null;
}

async function submit() {
  const message = validate();
  if (message) {
    toast(message, 'err');
    return;
  }

  saveDraft();
  submitting.value = true;
  try {
    const review = await submitElectiveReview({
      courseId: resolveCourseId(),
      courseName: form.courseName.trim(),
      teacher: form.teacher.trim(),
      type: form.type,
      campus: form.campus,
      category: showCategory.value ? form.category : undefined,
      term: form.term,
      questions: showQuestions.value ? parseQuestions() : undefined,
      scores: { ...form.scores },
      assessment: [...form.assessment],
      comment: form.comment.trim() || undefined,
    });

    clearDraft();
    toast('评价已提交，感谢分享');
    await navigateTo(`/electives/details/${review.courseId}`);
  } catch (error) {
    toast(apiErrorMessage(error, '提交失败，请稍后再试'), 'err');
  } finally {
    submitting.value = false;
  }
}

useSeoMeta({ title: '写选修课评价' });
</script>

<template>
  <WalinePage
    title="写选修课评价"
    description="你的经验会帮到后面的同学，尽量客观一点"
  >
    <form class="max-w-3xl space-y-8" @submit.prevent="submit">
      <section class="space-y-3">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h2 class="text-sm font-medium text-highlighted">1. 选择课程</h2>
          <p class="text-xs text-muted">没找到？直接在下面填新课程</p>
        </div>
        <USelectMenu
          v-model="selectedCourseId"
          :items="courseItems"
          value-key="value"
          search-input
          placeholder="搜索已收录的课程…"
          class="w-full sm:max-w-md"
        />
      </section>

      <section class="space-y-4">
        <h2 class="text-sm font-medium text-highlighted">2. 课程信息</h2>

        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="课程名称" required>
            <UInput
              v-model="form.courseName"
              placeholder="如：电影艺术鉴赏"
              class="w-full"
            />
          </UFormField>

          <UFormField label="任课教师" required>
            <UInput
              v-model="form.teacher"
              placeholder="如：王丽"
              class="w-full"
            />
          </UFormField>

          <UFormField label="类型" required>
            <USelect
              v-model="form.type"
              :items="ELECTIVE_TYPES"
              class="w-full"
            />
          </UFormField>

          <UFormField label="校区" required>
            <USelect
              v-model="form.campus"
              :items="ELECTIVE_CAMPUSES"
              class="w-full"
            />
          </UFormField>

          <UFormField
            v-if="showCategory"
            label="通识教育类别"
            required
            class="sm:col-span-2"
          >
            <USelect
              v-model="form.category"
              :items="ELECTIVE_CATEGORIES"
              placeholder="请选择类别"
              class="w-full"
            />
          </UFormField>

          <UFormField label="学期" required>
            <USelect v-model="form.term" :items="termItems" class="w-full" />
          </UFormField>

          <UFormField v-if="showQuestions" label="题数">
            <UInput
              v-model="form.questions"
              type="number"
              min="1"
              placeholder="如：20"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField label="考核形式（可多选）" required>
          <UCheckboxGroup
            v-model="form.assessment"
            :items="ASSESSMENT_FORMS"
            orientation="horizontal"
            class="pt-1"
          />
        </UFormField>
      </section>

      <section class="space-y-3">
        <h2 class="text-sm font-medium text-highlighted">3. 打分</h2>

        <div class="divide-y divide-default border-y border-default">
          <div
            v-for="dimension in SCORE_DIMENSIONS"
            :key="dimension.key"
            class="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div class="text-sm font-medium text-highlighted">
                {{ dimension.label }}
              </div>
              <div class="text-xs text-dimmed">
                1 = {{ dimension.low }} · 5 = {{ dimension.high }}
              </div>
            </div>

            <div class="flex items-center gap-3">
              <UInputRating
                v-model="form.scores[dimension.key]"
                empty-icon="i-ph-star"
                icon="i-ph-star-fill"
                hoverable
                :step="0.5"
              />
              <span class="w-6 text-sm tabular-nums text-muted">
                {{ form.scores[dimension.key] || '—' }}
              </span>
            </div>
          </div>

          <!-- 派生项：不给输入，只展示由上面五项换算出来的结果 -->
          <div
            class="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div class="text-sm font-medium text-highlighted">
                {{ OVERALL_SCORE_LABEL }}
              </div>
              <div class="text-xs text-dimmed">{{ OVERALL_SCORE_HINT }}</div>
            </div>

            <div class="flex items-center gap-3">
              <UInputRating
                :model-value="scorePreview"
                readonly
                :step="0.1"
                empty-icon="i-ph-star"
                icon="i-ph-star-fill"
              />
              <span class="w-8 text-sm tabular-nums text-muted">
                {{ scorePreview ? formatScore(scorePreview) : '—' }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section class="space-y-3">
        <h2 class="text-sm font-medium text-highlighted">
          4. 想说点什么（可选）
        </h2>
        <UTextarea
          v-model="form.comment"
          :rows="4"
          placeholder="给分情况、点名方式、期末难不难…"
          class="w-full"
        />
      </section>

      <div class="space-y-2">
        <p class="text-xs text-muted">
          <template v-if="draftStatus === 'saved'">
            草稿已自动保存到本设备，提交成功后会清除。
          </template>
          <template v-else-if="draftStatus === 'unavailable'">
            当前浏览器无法使用本地缓存，建议提交前不要关闭页面。
          </template>
          <template v-else>填写中的内容会自动保存到本设备。</template>
        </p>
        <div class="flex items-center gap-2">
          <UButton
            type="submit"
            :loading="submitting"
            icon="i-lucide-send"
            label="提交评价"
          />
          <UButton
            to="/electives/overview"
            color="neutral"
            variant="ghost"
            label="取消"
          />
        </div>
      </div>
    </form>
  </WalinePage>
</template>
