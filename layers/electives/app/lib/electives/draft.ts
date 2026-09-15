import {
  ASSESSMENT_FORMS,
  currentTerm,
  ELECTIVE_CAMPUSES,
  ELECTIVE_CATEGORIES,
  ELECTIVE_TYPES,
  SCORE_DIMENSIONS,
} from './constants';
import type {
  AssessmentForm,
  ElectiveCampus,
  ElectiveCategory,
  ElectiveScores,
  ElectiveType,
} from './types';

export const ELECTIVE_REVIEW_DRAFT_VERSION = 1;

export interface ElectiveReviewDraftState {
  courseName: string;
  teacher: string;
  type: ElectiveType;
  campus: ElectiveCampus;
  category?: ElectiveCategory;
  term: string;
  questions: string;
  assessment: AssessmentForm[];
  comment: string;
  scores: ElectiveScores;
}

export interface StoredElectiveReviewDraft {
  version: typeof ELECTIVE_REVIEW_DRAFT_VERSION;
  updatedAt: number;
  selectedCourseId: string;
  form: ElectiveReviewDraftState;
}

function hasValue<T extends string>(
  options: readonly { value: T }[],
  value: unknown,
): value is T {
  return (
    typeof value === 'string' &&
    options.some((option) => option.value === value)
  );
}

function readScore(value: unknown): number {
  const score = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(score) && score >= 0 && score <= 5 ? score : 0;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** 草稿为空时删除它，避免下次进入评价页恢复一份空表单。 */
export function hasElectiveReviewDraft(
  form: ElectiveReviewDraftState,
  selectedCourseId = '',
): boolean {
  return Boolean(
    selectedCourseId ||
    form.courseName.trim() ||
    form.teacher.trim() ||
    form.category ||
    form.questions.trim() ||
    form.assessment.length ||
    form.comment.trim() ||
    SCORE_DIMENSIONS.some((dimension) => form.scores[dimension.key] > 0),
  );
}

/** 从 localStorage 中读取并清洗草稿，避免旧版本/脏值破坏表单。 */
export function readElectiveReviewDraft(
  storage: Storage,
  key: string,
): StoredElectiveReviewDraft | null {
  const raw = storage.getItem(key);
  if (!raw) return null;

  try {
    const saved = JSON.parse(raw) as Record<string, unknown>;
    if (saved.version !== ELECTIVE_REVIEW_DRAFT_VERSION) return null;

    const input = (saved.form ?? {}) as Record<string, unknown>;
    const rawScores = (input.scores ?? {}) as Record<string, unknown>;
    const rawAssessment = Array.isArray(input.assessment)
      ? input.assessment
      : [];
    const assessment = [
      ...new Set(
        rawAssessment.filter((value): value is AssessmentForm =>
          hasValue(ASSESSMENT_FORMS, value),
        ),
      ),
    ];

    return {
      version: ELECTIVE_REVIEW_DRAFT_VERSION,
      updatedAt:
        typeof saved.updatedAt === 'number' ? saved.updatedAt : Date.now(),
      selectedCourseId: readString(saved.selectedCourseId),
      form: {
        courseName: readString(input.courseName),
        teacher: readString(input.teacher),
        type: hasValue(ELECTIVE_TYPES, input.type) ? input.type : 'offline',
        campus: hasValue(ELECTIVE_CAMPUSES, input.campus)
          ? input.campus
          : 'tunxilu',
        category: hasValue(ELECTIVE_CATEGORIES, input.category)
          ? input.category
          : undefined,
        term: readString(input.term) || currentTerm(),
        questions:
          typeof input.questions === 'number'
            ? String(input.questions)
            : readString(input.questions),
        assessment,
        comment: readString(input.comment),
        scores: {
          learnEase: readScore(rawScores.learnEase),
          highScoreEase: readScore(rawScores.highScoreEase),
          checkinEase: readScore(rawScores.checkinEase),
          homeworkEase: readScore(rawScores.homeworkEase),
          examEase: readScore(rawScores.examEase),
        },
      },
    };
  } catch {
    return null;
  }
}

/** 保存当前草稿；返回 false 表示当前表单没有需要缓存的内容。 */
export function writeElectiveReviewDraft(
  storage: Storage,
  key: string,
  form: ElectiveReviewDraftState,
  selectedCourseId: string,
): boolean {
  if (!hasElectiveReviewDraft(form, selectedCourseId)) {
    storage.removeItem(key);
    return false;
  }

  storage.setItem(
    key,
    JSON.stringify({
      version: ELECTIVE_REVIEW_DRAFT_VERSION,
      updatedAt: Date.now(),
      selectedCourseId,
      form: {
        ...form,
        assessment: [...form.assessment],
        scores: { ...form.scores },
      },
    } satisfies StoredElectiveReviewDraft),
  );
  return true;
}
