<script setup lang="ts">
import {
  deleteComment,
  getCommentList,
  replyComment,
  updateComment,
} from '../lib/waline/comment';
import type { Comment, CommentStatus } from '../lib/waline/types';
import { toast } from '../composables/waline-toast';

definePageMeta({
  layout: 'waline',
  middleware: 'waline-auth',
  requiresAdmin: true,
});

const auth = useWalineAuth();

const status = ref<CommentStatus | ''>('');
const keyword = ref('');
const ownerMine = ref(false);
const page = ref(1);
const pageSize = 20;
const list = ref<Comment[]>([]);
const totalPages = ref(1);
const loading = ref(false);

const replyFor = ref<string | number | null>(null);
const replyText = ref('');
const replying = ref(false);

const statusTabs: { value: CommentStatus | ''; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'approved', label: '已通过' },
  { value: 'waiting', label: '待审核' },
  { value: 'spam', label: '垃圾' },
];

function statusColor(c: Comment) {
  if (c.status === 'approved') return 'success';
  if (c.status === 'waiting') return 'warning';
  return 'error';
}

function statusLabel(c: Comment) {
  if (c.status === 'approved') return '已通过';
  if (c.status === 'waiting') return '待审核';
  return '垃圾';
}

function formatTime(ms: number) {
  if (!ms) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

async function load() {
  loading.value = true;
  try {
    const resp = await getCommentList({
      page: page.value,
      pageSize,
      status: status.value,
      keyword: keyword.value.trim(),
      owner: ownerMine.value ? 'mine' : '',
    });
    list.value = resp.data;
    totalPages.value = Math.max(1, resp.totalPages || 1);
    if (page.value > totalPages.value) page.value = totalPages.value;
  } catch (e: any) {
    toast(e?.message || '加载评论失败', 'err');
  } finally {
    loading.value = false;
  }
}

function onStatusChange(value: string | number) {
  const next = value as CommentStatus | '';
  if (status.value === next) return;
  status.value = next;
  page.value = 1;
  load();
}

function onPageChange(next: number) {
  page.value = next;
  load();
}

function search() {
  page.value = 1;
  load();
}

async function mutate(
  id: string | number,
  data: Record<string, unknown>,
  okMsg: string,
) {
  try {
    await updateComment(id, data);
    toast(okMsg);
    load();
  } catch (e: any) {
    toast(e?.message || '操作失败', 'err');
  }
}

async function remove(c: Comment) {
  const extra = c.children?.length ? '及其全部回复' : '';
  if (!window.confirm(`确定删除该评论${extra}？`)) return;

  try {
    await deleteComment(c.objectId);
    toast('已删除');
    load();
  } catch (e: any) {
    toast(e?.message || '删除失败', 'err');
  }
}

function toggleReply(c: Comment) {
  replyFor.value = replyFor.value === c.objectId ? null : c.objectId;
  replyText.value = c.at ? `@${c.at} ` : '';
}

async function submitReply(c: Comment) {
  const text = replyText.value.trim();
  if (!text) {
    toast('请输入回复内容', 'err');
    return;
  }

  replying.value = true;
  try {
    await replyComment({
      comment: text,
      nick: auth.user.value?.display_name || undefined,
      mail: auth.user.value?.email || undefined,
      url: c.url || `${location.origin}/`,
      pid: c.objectId,
      rid: c.rid ?? c.objectId,
      at: c.nick,
    });
    replyFor.value = null;
    replyText.value = '';
    toast('回复已发布');
    load();
  } catch (e: any) {
    toast(e?.message || '回复失败', 'err');
  } finally {
    replying.value = false;
  }
}

watch(ownerMine, () => {
  page.value = 1;
  load();
});

onMounted(load);
</script>

<template>
  <WalinePage
    title="评论管理"
    :description="`第 ${page} / ${totalPages} 页 · 本页 ${list.length} 条`"
  >
    <!-- 筛选工具栏 -->
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <UTabs
        :items="statusTabs"
        :model-value="status"
        :content="false"
        @update:model-value="onStatusChange"
      />

      <div class="flex flex-1 items-center gap-2">
        <UInput
          v-model="keyword"
          icon="i-lucide-search"
          placeholder="搜索评论内容…"
          class="w-full sm:ml-auto sm:w-64"
          @keyup.enter="search"
        />
        <UButton
          color="neutral"
          variant="subtle"
          label="搜索"
          @click="search"
        />
      </div>
    </div>

    <UCheckbox v-model="ownerMine" label="只看我的" class="mb-4" />

    <!-- 加载中 -->
    <div
      v-if="loading"
      class="flex items-center justify-center gap-2 py-16 text-sm text-muted"
    >
      <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />
      加载中…
    </div>

    <!-- 空状态 -->
    <UEmpty
      v-else-if="!list.length"
      icon="i-lucide-message-square-dashed"
      title="暂无评论"
      description="当前筛选条件下没有找到评论"
      variant="naked"
    />

    <!-- 评论列表：用分隔线代替卡片背景，减少视觉噪声 -->
    <ul v-else class="divide-y divide-default border-y border-default">
      <li
        v-for="c in list"
        :key="String(c.objectId)"
        class="py-5"
        :class="c.pid ? 'pl-6 sm:pl-12' : ''"
      >
        <div class="flex gap-3">
          <UAvatar
            :src="c.avatar || undefined"
            :alt="c.nick"
            size="sm"
            class="mt-0.5 shrink-0"
          />

          <div class="min-w-0 flex-1">
            <!-- 元信息 -->
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span class="font-medium text-highlighted">{{ c.nick }}</span>
              <UIcon
                v-if="c.pid"
                name="i-lucide-corner-down-right"
                class="size-3.5 text-dimmed"
              />
              <span v-if="c.at" class="text-muted">@{{ c.at }}</span>
              <span v-if="c.mail" class="text-xs text-dimmed">{{
                c.mail
              }}</span>
              <span class="text-xs text-dimmed">{{ formatTime(c.time) }}</span>
              <UBadge :color="statusColor(c)" variant="subtle" size="sm">
                {{ statusLabel(c) }}
              </UBadge>
              <UBadge
                v-if="c.sticky"
                color="primary"
                variant="subtle"
                size="sm"
              >
                置顶
              </UBadge>
            </div>

            <!-- 正文（用原始 markdown 文本，避免渲染 HTML） -->
            <p
              class="mt-2 text-sm break-words whitespace-pre-wrap text-default"
            >
              {{ c.orig || c.comment }}
            </p>

            <!-- 附加信息 -->
            <div
              class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-dimmed"
            >
              <span v-if="c.browser || c.os">
                {{ [c.browser, c.os].filter(Boolean).join(' / ') }}
              </span>
              <span v-if="c.ip">IP: {{ c.ip }}</span>
              <span class="inline-flex items-center gap-1">
                <UIcon name="i-lucide-thumbs-up" class="size-3.5" />
                {{ c.like }}
              </span>
              <span v-if="c.url" class="truncate">URL: {{ c.url }}</span>
            </div>

            <!-- 操作 -->
            <div class="mt-3 flex flex-wrap items-center gap-2">
              <UButton
                v-if="c.status !== 'approved'"
                color="neutral"
                variant="subtle"
                size="xs"
                icon="i-lucide-check"
                label="通过"
                @click="mutate(c.objectId, { status: 'approved' }, '已通过')"
              />
              <UButton
                v-if="c.status !== 'waiting'"
                color="neutral"
                variant="subtle"
                size="xs"
                icon="i-lucide-clock"
                label="待审"
                @click="
                  mutate(c.objectId, { status: 'waiting' }, '已设为待审核')
                "
              />
              <UButton
                v-if="c.status !== 'spam'"
                color="neutral"
                variant="subtle"
                size="xs"
                icon="i-lucide-flag"
                label="垃圾"
                @click="mutate(c.objectId, { status: 'spam' }, '已标记为垃圾')"
              />
              <UButton
                color="neutral"
                variant="ghost"
                size="xs"
                :icon="c.sticky ? 'i-lucide-pin-off' : 'i-lucide-pin'"
                :label="c.sticky ? '取消置顶' : '置顶'"
                @click="
                  mutate(
                    c.objectId,
                    { sticky: c.sticky ? 0 : 1 },
                    c.sticky ? '已取消置顶' : '已置顶',
                  )
                "
              />
              <UButton
                color="neutral"
                variant="ghost"
                size="xs"
                icon="i-lucide-message-square"
                label="回复"
                @click="toggleReply(c)"
              />
              <UButton
                color="error"
                variant="ghost"
                size="xs"
                icon="i-lucide-trash-2"
                label="删除"
                @click="remove(c)"
              />
            </div>

            <!-- 回复表单 -->
            <div
              v-if="replyFor === c.objectId"
              class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
            >
              <UTextarea
                v-model="replyText"
                :rows="2"
                placeholder="回复内容…"
                class="w-full"
                autofocus
              />
              <div class="flex items-center gap-2">
                <UButton
                  color="primary"
                  size="sm"
                  icon="i-lucide-send"
                  label="发布"
                  :loading="replying"
                  @click="submitReply(c)"
                />
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  label="取消"
                  @click="replyFor = null"
                />
              </div>
            </div>
          </div>
        </div>
      </li>
    </ul>

    <div v-if="totalPages > 1" class="mt-6 flex justify-center">
      <UPagination
        :page="page"
        :total="totalPages * pageSize"
        :items-per-page="pageSize"
        :sibling-count="1"
        show-edges
        @update:page="onPageChange"
      />
    </div>
  </WalinePage>
</template>
