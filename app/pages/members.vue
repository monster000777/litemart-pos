<script setup lang="ts">
import { LoaderCircle, Pencil, Plus, Search, Trash2, Check, X, UserRound } from 'lucide-vue-next'
import Sheet from '~/components/ui/sheet/Sheet.vue'
import SheetContent from '~/components/ui/sheet/SheetContent.vue'
import SheetDescription from '~/components/ui/sheet/SheetDescription.vue'
import SheetFooter from '~/components/ui/sheet/SheetFooter.vue'
import SheetHeader from '~/components/ui/sheet/SheetHeader.vue'
import SheetTitle from '~/components/ui/sheet/SheetTitle.vue'
import type { MemberDto, MemberListResponse } from '~/types/member'

const search = ref('')
const level = ref('')
const submitting = ref(false)
const deletingId = ref<string | null>(null)
const sheetOpen = ref(false)
const editingId = ref('')
const formError = ref('')
const { toast } = useToast()
const { getApiErrorMessage } = useApiError()
const { formatDate } = useFormat()

const form = reactive({
  phone: '',
  name: '',
  level: 'NORMAL'
})

const query = computed(() => ({
  search: search.value.trim() || undefined,
  level: level.value || undefined,
  page: 1,
  pageSize: 100
}))

const { data, pending, error, refresh } = await useAsyncData(
  'members',
  () => $fetch<MemberListResponse>('/api/customers', { params: query.value }),
  { watch: [query] }
)

const members = computed(() => data.value?.items ?? [])
const isEditMode = computed(() => Boolean(editingId.value))
const editingMember = computed(() => members.value.find((m) => m.id === editingId.value))
const errorMsg = computed(() =>
  error.value ? getApiErrorMessage(error.value, '会员列表加载失败') : ''
)

const resetForm = () => {
  form.phone = ''
  form.name = ''
  form.level = 'NORMAL'
  formError.value = ''
}

const openCreate = () => {
  deletingId.value = null
  editingId.value = ''
  resetForm()
  sheetOpen.value = true
}

const openEdit = (member: MemberDto) => {
  deletingId.value = null
  editingId.value = member.id
  form.phone = member.phone
  form.name = member.name ?? ''
  form.level = member.level
  formError.value = ''
  sheetOpen.value = true
}

const closeSheet = () => {
  sheetOpen.value = false
  resetForm()
  editingId.value = ''
}

const submitForm = async () => {
  if (submitting.value) return
  submitting.value = true
  formError.value = ''

  try {
    if (isEditMode.value) {
      await $fetch(`/api/customers/${editingId.value}`, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        method: 'PATCH' as any,
        body: {
          name: form.name,
          level: form.level
        }
      })
      toast({ title: '会员已更新', variant: 'success', duration: 2500 })
    } else {
      await $fetch('/api/customers', {
        method: 'POST',
        body: {
          phone: form.phone,
          name: form.name
        }
      })
      toast({ title: '会员已创建', variant: 'success', duration: 2500 })
    }

    await refresh()
    closeSheet()
  } catch (err) {
    formError.value = getApiErrorMessage(err, '保存失败')
    toast({ title: formError.value, variant: 'error', duration: 2500 })
  } finally {
    submitting.value = false
  }
}

const confirmDelete = (member: MemberDto) => {
  deletingId.value = member.id
}

const cancelDelete = () => {
  deletingId.value = null
}

const removeMember = async (member: MemberDto) => {
  const wasEditing = editingId.value === member.id
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await $fetch(`/api/customers/${member.id}`, { method: 'DELETE' as any })
    toast({ title: '会员已删除', variant: 'success', duration: 2500 })
    await refresh()
    deletingId.value = null
    if (wasEditing) closeSheet()
  } catch (err) {
    toast({ title: getApiErrorMessage(err, '删除失败'), variant: 'error', duration: 2500 })
    deletingId.value = null
  }
}

const DEFAULT_LEVEL_CONFIG = {
  label: '普通',
  color: 'var(--text-secondary)',
  bg: 'var(--bg-input-disabled)'
}

const LEVEL_CONFIG: Record<string, typeof DEFAULT_LEVEL_CONFIG> = {
  NORMAL: DEFAULT_LEVEL_CONFIG,
  SILVER: { label: '白银', color: '#64748b', bg: '#f1f5f9' },
  GOLD: { label: '黄金', color: '#b45309', bg: '#fef3c7' }
}

const getLevelConfig = (level: string) => {
  return LEVEL_CONFIG[level] || DEFAULT_LEVEL_CONFIG
}

const getLevelStyle = (level: string) => {
  const config = getLevelConfig(level)
  return {
    color: config.color,
    background: config.bg
  }
}
</script>

<template>
  <div class="page-root">
    <!-- 顶部标题栏 -->
    <header class="page-header">
      <div class="header-left">
        <h1 class="header-title">会员管理</h1>
        <span class="header-count">{{ members.length }} 位会员</span>
      </div>
      <button type="button" class="btn-new" @click="openCreate">
        <Plus class="icon" />
        新建会员
      </button>
    </header>

    <!-- 搜索筛选 -->
    <div class="search-bar">
      <div class="search-wrap">
        <Search class="search-icon" />
        <input v-model="search" type="text" placeholder="搜索手机号或姓名" class="search-input" />
      </div>
      <select v-model="level" class="level-select">
        <option value="">全部等级</option>
        <option value="NORMAL">普通</option>
        <option value="SILVER">白银</option>
        <option value="GOLD">黄金</option>
      </select>
    </div>

    <!-- 会员列表 -->
    <div class="member-panel">
      <!-- 错误提示 -->
      <div v-if="errorMsg" class="error-banner">{{ errorMsg }}</div>

      <!-- 加载态 -->
      <div v-if="pending" class="state-empty">
        <LoaderCircle class="spin" />
        <span>加载中...</span>
      </div>

      <!-- 会员卡片 -->
      <div v-else-if="members.length" class="member-list">
        <div
          v-for="member in members"
          :key="member.id"
          class="member-card"
          :class="{ 'is-deleting': deletingId === member.id }"
        >
          <!-- 删除确认态 -->
          <template v-if="deletingId === member.id">
            <div class="delete-confirm">
              <p class="delete-text">删除用户 {{ member.phone }}</p>
              <div class="delete-actions">
                <button type="button" class="btn-confirm-yes" @click="removeMember(member)">
                  <Check class="icon-sm" /> 确认
                </button>
                <button type="button" class="btn-confirm-no" @click="cancelDelete">
                  <X class="icon-sm" /> 取消
                </button>
              </div>
            </div>
          </template>

          <!-- 正常态 -->
          <template v-else>
            <div class="member-info">
              <div class="member-avatar">
                <UserRound class="avatar-icon" />
              </div>
              <div class="member-detail">
                <div class="member-top">
                  <span class="member-name">{{ member.name || '未命名' }}</span>
                  <span class="level-badge" :style="getLevelStyle(member.level)">
                    {{ getLevelConfig(member.level).label }}
                  </span>
                </div>
                <p class="member-phone">{{ member.phone }}</p>
                <p class="member-meta">
                  {{ member.points }} 积分 · {{ formatDate(member.createdAt) }}
                </p>
              </div>
            </div>

            <div class="member-actions">
              <button type="button" class="btn-icon" @click="openEdit(member)">
                <Pencil class="icon" />
              </button>
              <button type="button" class="btn-icon btn-icon-danger" @click="confirmDelete(member)">
                <Trash2 class="icon" />
              </button>
            </div>
          </template>
        </div>
      </div>

      <!-- 空态 -->
      <div v-else class="state-empty">
        <span>暂无会员</span>
      </div>
    </div>

    <!-- Sheet 弹窗 -->
    <Sheet v-model:open="sheetOpen">
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{{ isEditMode ? '编辑会员' : '新建会员' }}</SheetTitle>
          <SheetDescription v-if="isEditMode">
            编辑中：{{ editingMember?.phone }}
          </SheetDescription>
          <SheetDescription v-else> 创建后即可使用手机号登录收银台 </SheetDescription>
        </SheetHeader>

        <form class="mt-8 space-y-5" @submit.prevent="submitForm">
          <div class="form-field">
            <label class="form-label">手机号</label>
            <input
              v-model="form.phone"
              type="text"
              placeholder="11 位手机号"
              :disabled="isEditMode"
              class="form-input"
              :class="{ 'is-disabled': isEditMode }"
            />
          </div>

          <div class="form-field">
            <label class="form-label">姓名</label>
            <input v-model="form.name" type="text" placeholder="可选" class="form-input" />
          </div>

          <div class="form-field">
            <label class="form-label">会员等级</label>
            <select v-model="form.level" class="form-input form-select">
              <option value="NORMAL">普通会员</option>
              <option value="SILVER">白银会员</option>
              <option value="GOLD">黄金会员</option>
            </select>
          </div>

          <p v-if="formError" class="form-error">{{ formError }}</p>

          <SheetFooter>
            <button type="button" class="btn-cancel" :disabled="submitting" @click="closeSheet">
              取消
            </button>
            <button type="submit" class="btn-submit" :disabled="submitting">
              <LoaderCircle v-if="submitting" class="spin icon" />
              <span v-else>{{ isEditMode ? '保存修改' : '创建会员' }}</span>
            </button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  </div>
</template>

<style scoped>
/* ===== 整体布局 ===== */
.page-root {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-height: 0;
  flex: 1;
}

/* ===== 顶部标题栏 ===== */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}

.header-title {
  font-size: 1.375rem;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.01em;
  margin: 0;
}

.header-count {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.btn-new {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  height: 2.25rem;
  padding: 0 0.875rem;
  background: var(--btn-primary-bg);
  color: var(--btn-primary-text);
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-new:hover {
  background: var(--btn-primary-hover);
}

/* ===== 搜索栏 ===== */
.search-bar {
  display: flex;
  gap: 0.5rem;
}

.search-wrap {
  flex: 1;
  position: relative;
}

.search-icon {
  position: absolute;
  left: 0.625rem;
  top: 50%;
  transform: translateY(-50%);
  width: 0.875rem;
  height: 0.875rem;
  color: var(--text-muted);
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 2.25rem;
  padding: 0 0.625rem 0 2rem;
  border: 1px solid var(--border-default);
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  background: var(--bg-input);
  outline: none;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
  box-sizing: border-box;
}
.search-input:focus {
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px var(--ring-focus);
}
.search-input::placeholder {
  color: var(--btn-disabled-bg);
}

.level-select {
  height: 2.25rem;
  padding: 0 0.625rem;
  border: 1px solid var(--border-default);
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: var(--text-medium);
  background: var(--bg-input);
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s;
}
.level-select:focus {
  border-color: var(--border-focus);
}

/* ===== 会员列表面板 ===== */
.member-panel {
  background: var(--bg-page);
  border: 1px solid var(--border-default);
  border-radius: 1rem;
  padding: 1.25rem;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) transparent;
}

.member-panel::-webkit-scrollbar {
  width: 4px;
}
.member-panel::-webkit-scrollbar-track {
  background: transparent;
}
.member-panel::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 999px;
}

/* ===== 错误提示 ===== */
.error-banner {
  padding: 0.625rem 0.875rem;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  color: var(--color-error);
  background: var(--bg-error);
  border: 1px solid var(--border-error);
  margin-bottom: 0.875rem;
}

/* ===== 会员卡片 ===== */
.member-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.member-card {
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: 0.625rem;
  padding: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.member-card:hover {
  border-color: var(--border-strong);
  box-shadow: 0 2px 8px rgba(28, 25, 23, 0.05);
}

.member-card.is-deleting {
  border-color: var(--border-error);
  background: var(--bg-error);
}

/* 会员信息 */
.member-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
}

.member-avatar {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background: var(--bg-input-disabled);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-icon {
  width: 1rem;
  height: 1rem;
  color: var(--text-muted);
}

.member-detail {
  flex: 1;
  min-width: 0;
}

.member-top {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.125rem;
}

.member-name {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--text-primary);
}

.level-badge {
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  letter-spacing: 0.04em;
}

.member-phone {
  font-size: 0.8125rem;
  color: var(--text-medium);
  margin: 0;
}

.member-meta {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin: 0.125rem 0 0;
}

/* 操作按钮 */
.member-actions {
  display: flex;
  gap: 0.375rem;
  flex-shrink: 0;
}

.btn-icon {
  width: 1.875rem;
  height: 1.875rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-default);
  border-radius: 0.375rem;
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    border-color 0.15s,
    color 0.15s,
    background 0.15s;
}
.btn-icon:hover {
  border-color: var(--border-focus);
  color: var(--text-primary);
  background: var(--bg-page);
}
.btn-icon-danger:hover {
  border-color: var(--border-error);
  color: var(--color-error);
  background: var(--bg-error);
}

/* 删除确认态 */
.delete-confirm {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 0.75rem;
}

.delete-text {
  font-size: 0.875rem;
  color: var(--color-error);
  margin: 0;
}

.delete-actions {
  display: flex;
  gap: 0.375rem;
}

.btn-confirm-yes,
.btn-confirm-no {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  height: 1.75rem;
  padding: 0 0.625rem;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-confirm-yes {
  background: #be123c;
  color: white;
  border: none;
}
.btn-confirm-yes:hover {
  background: #9f1239;
}

.btn-confirm-no {
  background: var(--bg-card);
  color: var(--text-medium);
  border: 1px solid var(--border-strong);
}
.btn-confirm-no:hover {
  background: var(--bg-input-disabled);
}

/* ===== Sheet 表单 ===== */
.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-medium);
}

.form-input {
  width: 100%;
  height: 2.375rem;
  padding: 0 0.75rem;
  border: 1px solid var(--border-default);
  border-radius: 0.375rem;
  font-size: 0.9375rem;
  color: var(--text-primary);
  background: var(--bg-input);
  outline: none;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
  box-sizing: border-box;
}
.form-input:focus {
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px var(--ring-focus);
}
.form-input::placeholder {
  color: var(--btn-disabled-bg);
}
.form-input.is-disabled {
  background: var(--bg-input-disabled);
  color: var(--text-muted);
  cursor: not-allowed;
}

.form-select {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a8a29e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  padding-right: 2.25rem;
}

.form-error {
  font-size: 0.8125rem;
  color: var(--color-error);
  margin: 0;
}

.btn-cancel {
  flex: 1;
  height: 2.5rem;
  border: 1px solid var(--border-strong);
  border-radius: 0.375rem;
  background: var(--bg-card);
  font-size: 0.9375rem;
  color: var(--text-medium);
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s;
}
.btn-cancel:hover {
  background: var(--bg-input-disabled);
  border-color: var(--border-focus);
}

.btn-submit {
  flex: 1;
  height: 2.5rem;
  background: var(--btn-primary-bg);
  color: var(--btn-primary-text);
  border: none;
  border-radius: 0.375rem;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  transition: background 0.15s;
}
.btn-submit:hover:not(:disabled) {
  background: var(--btn-primary-hover);
}
.btn-submit:disabled {
  background: var(--btn-disabled-bg);
  cursor: not-allowed;
}

/* ===== 通用 ===== */
.state-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2.5rem 0;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.icon {
  width: 0.875rem;
  height: 0.875rem;
}
.icon-sm {
  width: 0.8125rem;
  height: 0.8125rem;
}
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
