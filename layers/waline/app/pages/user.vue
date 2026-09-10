<script setup lang="ts">
import type { AdminUser } from '../lib/waline/types';
import { deleteUser, getUserList, updateUser } from '../lib/waline/user';
import { toast } from '../composables/waline-toast';

definePageMeta({
  layout: 'waline',
  middleware: 'waline-auth',
  requiresAdmin: true,
});

const auth = useWalineAuth();

const list = ref<AdminUser[]>([]);
const page = ref(1);
const pageSize = 20;
const totalPages = ref(1);
const loading = ref(false);

const editOpen = ref(false);
const editing = ref<AdminUser | null>(null);
const editForm = ref({
  display_name: '',
  url: '',
  avatar: '',
  label: '',
  type: 'guest',
});
const saving = ref(false);

const columns = [
  { id: 'user', accessorKey: 'display_name', header: '用户' },
  { id: 'email', accessorKey: 'email', header: '邮箱' },
  { id: 'type', accessorKey: 'type', header: '角色' },
  { id: 'createdAt', accessorKey: 'createdAt', header: '注册时间' },
  { id: 'actions', header: '操作' },
];

type BadgeColor = 'primary' | 'neutral' | 'error' | 'info';

const typeOptions: { value: string; label: string }[] = [
  { value: 'administrator', label: '管理员' },
  { value: 'guest', label: '访客' },
  { value: 'banned', label: '已封禁' },
];

function typeMeta(t: string): { label: string; color: BadgeColor } {
  if (t === 'administrator') return { label: '管理员', color: 'primary' };
  if (t === 'guest') return { label: '访客', color: 'neutral' };
  if (t === 'banned') return { label: '已封禁', color: 'error' };
  if (t?.startsWith('verify:')) return { label: '未验证', color: 'info' };
  return { label: t || '—', color: 'neutral' };
}

function formatDate(s?: string) {
  if (!s) return '—';
  return s.replace('T', ' ').slice(0, 16);
}

/** 未验证用户与访客是硬删除，其余是封禁 */
function isRemovable(u: AdminUser) {
  return u.type === 'guest' || !!u.type?.startsWith('verify:');
}

async function load() {
  loading.value = true;
  try {
    const resp = await getUserList(page.value, pageSize);
    list.value = resp.data;
    totalPages.value = Math.max(1, resp.totalPages || 1);
    if (page.value > totalPages.value) page.value = totalPages.value;
  } catch (e: any) {
    toast(e?.message || '加载用户失败', 'err');
  } finally {
    loading.value = false;
  }
}

function startEdit(u: AdminUser) {
  editing.value = u;
  editForm.value = {
    display_name: u.display_name || '',
    url: u.url || '',
    avatar: u.avatar || '',
    label: u.label || '',
    type: u.type || 'guest',
  };
  editOpen.value = true;
}

async function saveEdit() {
  if (!editing.value) return;

  saving.value = true;
  try {
    await updateUser(editing.value.objectId, {
      display_name: editForm.value.display_name.trim(),
      url: editForm.value.url.trim(),
      avatar: editForm.value.avatar.trim(),
      label: editForm.value.label.trim(),
      type: editForm.value.type,
    });
    toast('用户已更新');
    editOpen.value = false;
    load();
  } catch (e: any) {
    toast(e?.message || '保存失败', 'err');
  } finally {
    saving.value = false;
  }
}

async function remove(u: AdminUser) {
  if (u.objectId === auth.user.value?.objectId) {
    toast('不能删除当前登录的账号', 'err');
    return;
  }

  const action = isRemovable(u) ? '删除' : '封禁';
  if (
    !window.confirm(`确定${action}用户「${u.display_name}」（${u.email}）？`)
  ) {
    return;
  }

  try {
    await deleteUser(u.objectId);
    toast(`${action}成功`);
    if (list.value.length === 1 && page.value > 1) page.value--;
    load();
  } catch (e: any) {
    toast(e?.message || '操作失败', 'err');
  }
}

function onPageChange(next: number) {
  page.value = next;
  load();
}

onMounted(load);
</script>

<template>
  <WalinePage
    title="用户管理"
    description="查看与维护注册用户，可修改资料、角色或封禁账号"
  >
    <UTable
      :data="list"
      :columns="columns"
      :loading="loading"
      loading-color="primary"
      class="w-full"
    >
      <template #user-cell="{ row }">
        <div class="flex items-center gap-3">
          <UAvatar
            :src="row.original.avatar || undefined"
            :alt="row.original.display_name || row.original.email"
            size="sm"
          />
          <div class="min-w-0">
            <div class="truncate font-medium text-highlighted">
              {{ row.original.display_name || '—' }}
            </div>
            <div v-if="row.original.label" class="truncate text-xs text-dimmed">
              {{ row.original.label }}
            </div>
          </div>
        </div>
      </template>

      <template #email-cell="{ row }">
        <span class="text-sm text-muted">{{ row.original.email }}</span>
      </template>

      <template #type-cell="{ row }">
        <UBadge
          :color="typeMeta(row.original.type).color"
          variant="subtle"
          size="sm"
        >
          {{ typeMeta(row.original.type).label }}
        </UBadge>
      </template>

      <template #createdAt-cell="{ row }">
        <span class="text-sm text-muted">
          {{ formatDate(row.original.createdAt) }}
        </span>
      </template>

      <template #actions-cell="{ row }">
        <div class="flex justify-end gap-1">
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-pencil"
            label="编辑"
            @click="startEdit(row.original)"
          />
          <UButton
            color="error"
            variant="ghost"
            size="xs"
            :icon="
              isRemovable(row.original) ? 'i-lucide-trash-2' : 'i-lucide-ban'
            "
            :label="isRemovable(row.original) ? '删除' : '封禁'"
            @click="remove(row.original)"
          />
        </div>
      </template>

      <template #empty>
        <UEmpty
          icon="i-lucide-users"
          title="暂无用户"
          description="还没有任何注册用户"
        />
      </template>
    </UTable>

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

    <!-- 编辑用户 -->
    <UModal
      v-model:open="editOpen"
      :title="`编辑用户：${editing?.display_name || editing?.email || ''}`"
      :description="editing?.email"
    >
      <template #body>
        <form class="space-y-4" @submit.prevent="saveEdit">
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="昵称">
              <UInput v-model="editForm.display_name" class="w-full" />
            </UFormField>

            <UFormField label="角色">
              <USelect
                v-model="editForm.type"
                :items="typeOptions"
                class="w-full"
              />
            </UFormField>

            <UFormField label="主页">
              <UInput v-model="editForm.url" type="url" class="w-full" />
            </UFormField>

            <UFormField label="标签">
              <UInput v-model="editForm.label" class="w-full" />
            </UFormField>
          </div>

          <UFormField label="头像 URL">
            <UInput v-model="editForm.avatar" type="url" class="w-full" />
          </UFormField>

          <div class="flex justify-end gap-2 pt-1">
            <UButton
              color="neutral"
              variant="ghost"
              label="取消"
              @click="editOpen = false"
            />
            <UButton
              type="submit"
              color="primary"
              :loading="saving"
              label="保存"
            />
          </div>
        </form>
      </template>
    </UModal>
  </WalinePage>
</template>
