<script setup lang="ts">
import { getSettings, updateSettings } from '../lib/waline/settings';
import type { Settings } from '../lib/waline/types';
import { fetchVersions } from '../lib/waline/version';
import { toast } from '../composables/waline-toast';

definePageMeta({
  layout: 'waline',
  middleware: 'waline-auth',
  requiresAdmin: true,
});

/**
 * 站点设置页
 */

const form = reactive({
  waline_client_version: 'v3',
  waline_admin_version: '',
  comment_default_status: 'approved',
  user_comment_default_status: 'approved',
});

const activeTab = ref<'comment' | 'frontend'>('comment');

const settingTabs = [
  { label: '评论策略', value: 'comment' },
  { label: '前端版本', value: 'frontend' },
];

const saving = ref(false);
const loading = ref(true);

// 版本选择器
const clientVersions = ref<string[]>([]);
const clientLatest = ref('');
const adminVersions = ref<string[]>([]);
const adminLatest = ref('');
const refreshingClient = ref(false);
const refreshingAdmin = ref(false);

const commentStatusOptions = [
  { value: 'approved', label: '直接通过 (approved)' },
  { value: 'waiting', label: '等待审核 (waiting)' },
];

const clientVersionItems = computed(() => [
  {
    label: `latest${clientLatest.value ? ` (${clientLatest.value})` : ''}`,
    value: 'latest',
  },
  ...clientVersions.value.map((v) => ({ label: v, value: v })),
]);

const adminVersionItems = computed(() => [
  {
    label: `latest${adminLatest.value ? ` (${adminLatest.value})` : ''}`,
    value: 'latest',
  },
  ...adminVersions.value.map((v) => ({ label: v, value: v })),
]);

function populate(s: Settings) {
  form.waline_client_version = s.waline_client_version || 'v3';
  form.waline_admin_version = s.waline_admin_version || '';
  form.comment_default_status = s.comment_default_status || 'approved';
  form.user_comment_default_status =
    s.user_comment_default_status || 'approved';
}

async function refreshVersions(kind: 'client' | 'admin') {
  const pkg = kind === 'client' ? '@waline/client' : '@waline/admin';
  if (kind === 'client') refreshingClient.value = true;
  else refreshingAdmin.value = true;

  try {
    const data = await fetchVersions(pkg);
    if (kind === 'client') {
      clientVersions.value = data.versions;
      clientLatest.value = data.latest;
    } else {
      adminVersions.value = data.versions;
      adminLatest.value = data.latest;
    }
  } catch (e: any) {
    toast(e?.message || '获取版本失败', 'err');
  } finally {
    if (kind === 'client') refreshingClient.value = false;
    else refreshingAdmin.value = false;
  }
}

function selectVersion(kind: 'client' | 'admin', version: string | number) {
  if (!version) return;
  const value = String(version);
  if (kind === 'client') form.waline_client_version = value;
  else form.waline_admin_version = value;
}

async function save() {
  saving.value = true;
  try {
    await updateSettings({
      waline_client_version: form.waline_client_version.trim() || 'v3',
      waline_admin_version: form.waline_admin_version.trim() || '',
      comment_default_status: form.comment_default_status,
      user_comment_default_status: form.user_comment_default_status,
    });
    toast('设置已保存');
  } catch (e: any) {
    toast(e?.message || '保存失败', 'err');
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  try {
    populate(await getSettings());
  } catch (e: any) {
    toast(e?.message || '加载设置失败', 'err');
  } finally {
    loading.value = false;
  }

  refreshVersions('client');
  refreshVersions('admin');
});
</script>

<template>
  <WalinePage title="设置" description="评论策略与前端版本配置">
    <div
      v-if="loading"
      class="flex items-center justify-center gap-2 py-16 text-sm text-muted"
    >
      <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />
      加载中…
    </div>

    <template v-else>
      <UTabs
        v-model="activeTab"
        :items="settingTabs"
        :content="false"
        class="mb-5"
      />

      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <div class="divide-y divide-default">
          <!-- 前端版本 -->
          <section
            v-show="activeTab === 'frontend'"
            class="space-y-5 p-5 sm:p-6"
          >
            <UFormField label="@waline/client CDN 版本">
              <template #help>
                输入版本号（如 <code>v3</code>），留空默认使用
                <code>latest</code>。
              </template>
              <div class="flex flex-wrap items-center gap-2">
                <UInput
                  v-model="form.waline_client_version"
                  placeholder="v3"
                  class="w-full sm:w-40"
                />
                <USelect
                  :model-value="form.waline_client_version"
                  :items="clientVersionItems"
                  placeholder="选择版本…"
                  class="w-full sm:w-44"
                  @update:model-value="selectVersion('client', $event)"
                />
                <UButton
                  color="neutral"
                  variant="subtle"
                  icon="i-lucide-refresh-cw"
                  label="刷新"
                  :loading="refreshingClient"
                  @click="refreshVersions('client')"
                />
              </div>
            </UFormField>

            <UFormField label="@waline/admin CDN 版本">
              <template #help>
                输入版本号（如 <code>0.34.1</code>），留空默认使用
                <code>latest</code>。
              </template>
              <div class="flex flex-wrap items-center gap-2">
                <UInput
                  v-model="form.waline_admin_version"
                  placeholder="latest"
                  class="w-full sm:w-40"
                />
                <USelect
                  :model-value="form.waline_admin_version"
                  :items="adminVersionItems"
                  placeholder="选择版本…"
                  class="w-full sm:w-44"
                  @update:model-value="selectVersion('admin', $event)"
                />
                <UButton
                  color="neutral"
                  variant="subtle"
                  icon="i-lucide-refresh-cw"
                  label="刷新"
                  :loading="refreshingAdmin"
                  @click="refreshVersions('admin')"
                />
              </div>
            </UFormField>
          </section>

          <!-- 评论策略 -->
          <section v-show="activeTab === 'comment'" class="p-5 sm:p-6">
            <h2 class="mb-4 font-medium text-highlighted">默认状态</h2>
            <div class="space-y-5">
              <UFormField
                label="匿名评论默认状态"
                help="未登录用户发表评论的默认状态，优先于环境变量 AUDIT。"
              >
                <USelect
                  v-model="form.comment_default_status"
                  :items="commentStatusOptions"
                  class="w-full sm:w-64"
                />
              </UFormField>

              <UFormField label="已登录用户评论默认状态">
                <USelect
                  v-model="form.user_comment_default_status"
                  :items="commentStatusOptions"
                  class="w-full sm:w-64"
                />
              </UFormField>
            </div>
          </section>
        </div>
      </UCard>

      <div class="mt-5 flex justify-end">
        <UButton
          color="primary"
          :loading="saving"
          label="保存设置"
          @click="save"
        />
      </div>
    </template>
  </WalinePage>
</template>
