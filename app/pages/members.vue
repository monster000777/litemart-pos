<script setup lang="ts">
import { LoaderCircle, Pencil, Plus, Search, Trash2, Check, X, UserRound } from 'lucide-vue-next'
import type { MemberDto, MemberListResponse } from '~/types/member'

const search = ref('')
const level = ref('')
const submitting = ref(false)
const deletingId = ref<string | null>(null)
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
  editingId.value = ''
  formError.value = ''
}

const startCreate = () => {
  resetForm()
}

const startEdit = (member: MemberDto) => {
  editingId.value = member.id
  form.phone = member.phone
  form.name = member.name ?? ''
  form.level = member.level
  formError.value = ''
}

const cancelEdit = () => {
  resetForm()
}

const submitForm = async () => {
  if (submitting.value) return
  submitting.value = true
  formError.value = ''

  try {
    if (isEditMode.value) {
      await $fetch(`/api/customers/${editingId.value}`, {
        method: 'PATCH',
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
    resetForm()
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
  try {
    await $fetch(`/api/customers/${member.id}`, { method: 'DELETE' })
    toast({ title: '会员已删除', variant: 'success', duration: 2500 })
    await refresh()
    if (editingId.value === member.id) {
      resetForm()
    }
  } catch (err) {
    toast({ title: getApiErrorMessage(err, '删除失败'), variant: 'error', duration: 2500 })
  } finally {
    deletingId.value = null
  }
}

const LEVEL_CONFIG = {
  NORMAL: { label: '普通', color: '#78716c', bg: '#f5f4f2' },
  SILVER: { label: '白银', color: '#64748b', bg: '#f1f5f9' },
  GOLD: { label: '黄金', color: '#b45309', bg: '#fef3c7' }
} as const
</script>

<template>
  <div class="page-root">
    <!-- 顶部标题栏 -->
    <header class="page-header">
      <div class="header-left">
        <h1 class="header-title">会员管理</h1>
        <span class="header-count">{{ members.length }} 位会员</span>
      </div>
      <button type="button" class="btn-new" @click="startCreate">
        <Plus class="icon" />
        新建会员
      </button>
    </header>

    <div class="page-body">
      <!-- 左侧会员列表 -->
      <div class="panel panel-list">
        <!-- 搜索筛选 -->
        <div class="search-bar">
          <div class="search-wrap">
            <Search class="search-icon" />
            <input
              v-model="search"
              type="text"
              placeholder="搜索手机号或姓名"
              class="search-input"
            />
          </div>
          <select v-model="level" class="level-select">
            <option value="">全部等级</option>
            <option value="NORMAL">普通</option>
            <option value="SILVER">白银</option>
            <option value="GOLD">黄金</option>
          </select>
        </div>

        <!-- 错误提示 -->
        <div v-if="errorMsg" class="error-banner">
          {{ errorMsg }}
        </div>

        <!-- 加载态 -->
        <div v-if="pending" class="state-empty">
          <LoaderCircle class="spin" />
          <span>加载中...</span>
        </div>

        <!-- 会员列表 -->
        <div v-else-if="members.length" class="member-list-wrap">
          <div class="member-list">
            <div
              v-for="member in members"
              :key="member.id"
              class="member-card"
              :class="{
                'is-editing': editingId === member.id,
                'is-deleting': deletingId === member.id
              }"
            >
              <!-- 删除确认态 -->
              <template v-if="deletingId === member.id">
                <div class="delete-confirm">
                  <p class="delete-text">删除 {{ member.phone }}？</p>
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
                      <span
                        class="level-badge"
                        :style="{
                          color: LEVEL_CONFIG[member.level].color,
                          background: LEVEL_CONFIG[member.level].bg
                        }"
                      >
                        {{ LEVEL_CONFIG[member.level].label }}
                      </span>
                    </div>
                    <p class="member-phone">{{ member.phone }}</p>
                    <p class="member-meta">
                      {{ member.points }} 积分 · {{ formatDate(member.createdAt) }}
                    </p>
                  </div>
                </div>

                <div class="member-actions">
                  <button
                    type="button"
                    class="btn-icon"
                    :class="{ 'is-active': editingId === member.id }"
                    @click="startEdit(member)"
                  >
                    <Pencil class="icon" />
                  </button>
                  <button
                    type="button"
                    class="btn-icon btn-icon-danger"
                    @click="confirmDelete(member)"
                  >
                    <Trash2 class="icon" />
                  </button>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- 空态 -->
        <div v-else class="state-empty">
          <span>暂无会员</span>
        </div>
      </div>

      <!-- 右侧表单 -->
      <div class="panel panel-form" :class="{ 'has-editing': isEditMode }">
        <div class="form-header">
          <h2 class="form-title">
            {{ isEditMode ? '编辑会员' : '新建会员' }}
          </h2>
          <p v-if="isEditMode" class="form-sub">编辑中：{{ editingMember?.phone }}</p>
        </div>

        <div class="form-body">
          <div class="form-field">
            <input
              v-model="form.phone"
              type="text"
              placeholder="手机号"
              :disabled="isEditMode"
              class="form-input"
              :class="{ 'is-disabled': isEditMode }"
            />
          </div>
          <div class="form-field">
            <input v-model="form.name" type="text" placeholder="姓名（可选）" class="form-input" />
          </div>
          <div class="form-field">
            <select v-model="form.level" class="form-input form-select">
              <option value="NORMAL">普通会员</option>
              <option value="SILVER">白银会员</option>
              <option value="GOLD">黄金会员</option>
            </select>
          </div>
        </div>

        <p v-if="formError" class="form-error">{{ formError }}</p>

        <div class="form-footer">
          <button
            v-if="isEditMode"
            type="button"
            class="btn-cancel"
            :disabled="submitting"
            @click="cancelEdit"
          >
            取消
          </button>
          <button type="button" class="btn-submit" :disabled="submitting" @click="submitForm">
            <LoaderCircle v-if="submitting" class="spin icon" />
            <span v-else>{{ isEditMode ? '保存修改' : '创建会员' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ===== 整体布局 ===== */
.page-root {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  height: 100%;
}

/* ===== 顶部标题栏 ===== */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.25rem;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}

.header-title {
  font-size: 1.375rem;
  font-weight: 600;
  color: #1c1917;
  letter-spacing: -0.01em;
  margin: 0;
}

.header-count {
  font-size: 0.8125rem;
  color: #a8a29e;
}

.btn-new {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  height: 2.25rem;
  padding: 0 0.875rem;
  background: #1c1917;
  color: #fafaf9;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-new:hover {
  background: #292524;
}

/* ===== 页面主体 ===== */
.page-body {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 1.25rem;
  align-items: stretch;
  height: 100%;
  min-height: 0;
}

@media (max-width: 900px) {
  .page-body {
    grid-template-columns: 1fr;
  }
}

/* ===== 面板 ===== */
.panel {
  background: #fafaf9;
  border: 1px solid rgba(28, 25, 23, 0.07);
  border-radius: 1rem;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* 会员列表区：有最大高度，超出可滚动 */
.member-list-wrap {
  flex: 1;
  max-height: calc(100vh - 13rem);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #d6d3d1 transparent;
}

.member-list-wrap::-webkit-scrollbar {
  width: 4px;
}
.member-list-wrap::-webkit-scrollbar-track {
  background: transparent;
}
.member-list-wrap::-webkit-scrollbar-thumb {
  background: #d6d3d1;
  border-radius: 999px;
}

/* ===== 搜索栏 ===== */
.search-bar {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
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
  color: #a8a29e;
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 2.25rem;
  padding: 0 0.625rem 0 2rem;
  border: 1px solid rgba(28, 25, 23, 0.1);
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: #1c1917;
  background: white;
  outline: none;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
  box-sizing: border-box;
}
.search-input:focus {
  border-color: rgba(28, 25, 23, 0.2);
  box-shadow: 0 0 0 3px rgba(28, 25, 23, 0.04);
}
.search-input::placeholder {
  color: #d6d3d1;
}

.level-select {
  height: 2.25rem;
  padding: 0 0.625rem;
  border: 1px solid rgba(28, 25, 23, 0.1);
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: #57534e;
  background: white;
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s;
}
.level-select:focus {
  border-color: rgba(28, 25, 23, 0.2);
}

/* ===== 错误提示 ===== */
.error-banner {
  padding: 0.625rem 0.875rem;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  color: #be123c;
  background: #fff1f2;
  border: 1px solid #fecdd3;
  margin-bottom: 0.875rem;
}

/* ===== 会员列表 ===== */
.member-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.member-card {
  background: white;
  border: 1px solid rgba(28, 25, 23, 0.07);
  border-radius: 0.625rem;
  padding: 0.875rem;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.member-card:hover {
  border-color: rgba(28, 25, 23, 0.14);
  box-shadow: 0 2px 8px rgba(28, 25, 23, 0.05);
}

.member-card.is-editing {
  border-color: rgba(28, 25, 23, 0.2);
  background: #fafaf9;
  box-shadow: 0 2px 12px rgba(28, 25, 23, 0.08);
}

.member-card.is-deleting {
  border-color: #fecdd3;
  background: #fff1f2;
}

/* 会员信息行 */
.member-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.member-avatar {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background: #f5f4f2;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-icon {
  width: 1rem;
  height: 1rem;
  color: #a8a29e;
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
  color: #1c1917;
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
  color: #57534e;
  margin: 0;
}

.member-meta {
  font-size: 0.75rem;
  color: #a8a29e;
  margin: 0.125rem 0 0;
}

/* 操作按钮 */
.member-actions {
  display: flex;
  gap: 0.375rem;
  margin-left: auto;
  flex-shrink: 0;
}

.btn-icon {
  width: 1.875rem;
  height: 1.875rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(28, 25, 23, 0.1);
  border-radius: 0.375rem;
  background: white;
  color: #78716c;
  cursor: pointer;
  transition:
    border-color 0.15s,
    color 0.15s,
    background 0.15s;
}
.btn-icon:hover {
  border-color: rgba(28, 25, 23, 0.2);
  color: #1c1917;
  background: #fafaf9;
}
.btn-icon.is-active {
  border-color: #1c1917;
  background: #1c1917;
  color: white;
}
.btn-icon-danger:hover {
  border-color: #fecdd3;
  color: #be123c;
  background: #fff1f2;
}

/* 删除确认态 */
.delete-confirm {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.delete-text {
  font-size: 0.875rem;
  color: #be123c;
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
  background: white;
  color: #57534e;
  border: 1px solid rgba(28, 25, 23, 0.12);
}
.btn-confirm-no:hover {
  background: #f5f4f2;
}

/* 空态 / 加载态 */
.state-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2.5rem 0;
  font-size: 0.875rem;
  color: #a8a29e;
}

/* ===== 右侧表单 ===== */
.panel-form {
  position: sticky;
  top: 1.5rem;
  transition: box-shadow 0.2s;
}

.panel-form.has-editing {
  border-color: rgba(28, 25, 23, 0.15);
  box-shadow: 0 4px 20px rgba(28, 25, 23, 0.08);
}

.form-header {
  margin-bottom: 1.25rem;
}

.form-title {
  font-size: 1.0625rem;
  font-weight: 600;
  color: #1c1917;
  margin: 0 0 0.25rem;
}

.form-sub {
  font-size: 0.8125rem;
  color: #a8a29e;
  margin: 0;
}

.form-body {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  margin-bottom: 1rem;
}

.form-field {
  display: flex;
  flex-direction: column;
}

.form-input {
  width: 100%;
  height: 2.375rem;
  padding: 0 0.75rem;
  border: 1px solid rgba(28, 25, 23, 0.1);
  border-radius: 0.375rem;
  font-size: 0.9375rem;
  color: #1c1917;
  background: white;
  outline: none;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
  box-sizing: border-box;
}
.form-input:focus {
  border-color: rgba(28, 25, 23, 0.2);
  box-shadow: 0 0 0 3px rgba(28, 25, 23, 0.04);
}
.form-input::placeholder {
  color: #d6d3d1;
}
.form-input.is-disabled {
  background: #f5f4f2;
  color: #a8a29e;
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
  color: #be123c;
  margin: 0 0 0.75rem;
}

.form-footer {
  display: flex;
  gap: 0.5rem;
}

.btn-cancel {
  flex-shrink: 0;
  height: 2.5rem;
  padding: 0 1rem;
  border: 1px solid rgba(28, 25, 23, 0.12);
  border-radius: 0.375rem;
  background: white;
  font-size: 0.9375rem;
  color: #57534e;
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s;
}
.btn-cancel:hover:not(:disabled) {
  background: #f5f4f2;
  border-color: rgba(28, 25, 23, 0.2);
}

.btn-submit {
  flex: 1;
  height: 2.5rem;
  background: #1c1917;
  color: #fafaf9;
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
  background: #292524;
}
.btn-submit:disabled {
  background: #d6d3d1;
  cursor: not-allowed;
}

/* ===== 图标 ===== */
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
