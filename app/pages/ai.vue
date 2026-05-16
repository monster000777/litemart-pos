<script setup lang="ts">
import {
  Send,
  User,
  Loader2,
  Trash2,
  Sparkles,
  ChevronRight,
  MessageSquarePlus,
  MessageSquare
} from 'lucide-vue-next'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

type PurifyInstance = {
  sanitize: (input: string) => string
}

// 从全局 composable 获取状态 —— 这些状态独立于组件生命周期
const {
  sessions,
  activeSessionId,
  chatPending,
  chatInput,
  activeSession,
  chatHistory,
  initialize,
  createNewSession,
  deleteSession,
  clearChat,
  sendMessage,
  switchToSession
} = useCopilot()

const chatContainer = ref<HTMLElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const presetQuestions = [
  '分析今日销售情况与客流趋势',
  '帮我查一下哪几款商品需要补货了',
  '上周销量最好和退款最多的商品是什么？',
  '查看最近的系统操作日志'
]

const resizeTextarea = () => {
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
    textareaRef.value.style.height = `${Math.min(textareaRef.value.scrollHeight, 150)}px`
  }
}

watch(chatInput, () => {
  nextTick(() => resizeTextarea())
})

const scrollToBottom = () => {
  setTimeout(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  }, 50)
}

// 监听消息数量变化自动滚动到底部
watch(
  () => chatHistory.value.length,
  () => {
    scrollToBottom()
  }
)

// 监听加载状态变化自动滚动到底部
watch(chatPending, () => {
  scrollToBottom()
})

const handleSendMessage = async () => {
  const text = chatInput.value.trim()
  if (!text) return

  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
  }
  scrollToBottom()

  // sendMessage 在 composable 作用域执行，路由切换不会中断
  await sendMessage(text)
  scrollToBottom()
}

const handlePresetClick = (q: string) => {
  chatInput.value = q
  handleSendMessage()
}

const handleClearChat = async () => {
  await clearChat()
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
  }
}

const formatChatMessage = (msg: { role: string; content: string }) => {
  if (msg.role === 'user') {
    return msg.content.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')
  }

  if (import.meta.client) {
    const rawHtml = marked.parse(msg.content, { breaks: true }) as string
    const source = DOMPurify as unknown
    const purify =
      typeof source === 'function'
        ? (source as (inputWindow: Window) => PurifyInstance)(window)
        : (source as PurifyInstance)
    return purify.sanitize(rawHtml)
  }
  return msg.content
}

onMounted(async () => {
  await initialize()
  setTimeout(() => scrollToBottom(), 100)
})
</script>

<template>
  <div
    class="w-full flex -m-6 md:-m-8 h-[calc(100vh-4rem)] overflow-hidden bg-white dark:bg-zinc-950"
  >
    <!-- Sidebar Session List -->
    <aside
      class="flex w-72 flex-shrink-0 flex-col border-r border-slate-200 bg-slate-50/70 dark:border-zinc-800 dark:bg-zinc-900/80"
    >
      <div
        class="z-10 border-b border-slate-200 bg-white/90 p-6 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/95"
      >
        <h2
          class="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-zinc-50"
        >
          <Sparkles class="w-5 h-5 text-indigo-600" />
          业务助理 Copilot
        </h2>
        <button
          :disabled="activeSession?.messages.length === 0"
          class="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white transition-all shadow-sm hover:bg-indigo-700 hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
          @click="createNewSession"
        >
          <MessageSquarePlus class="w-4 h-4" />
          开启新分析
        </button>
      </div>

      <div class="flex-1 space-y-1.5 overflow-y-auto p-4">
        <div
          v-for="session in sessions"
          :key="session.id"
          class="group flex cursor-pointer items-center justify-between rounded-xl border border-transparent p-3 transition-all"
          :class="
            activeSessionId === session.id
              ? 'bg-white border-slate-200 shadow-sm text-indigo-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-indigo-300'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
          "
          @click="switchToSession(session.id)"
        >
          <div class="flex-1 min-w-0 pr-2">
            <p class="flex items-center gap-2 truncate text-sm font-medium" :title="session.title">
              <MessageSquare class="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
              {{ session.title }}
            </p>
            <p class="mt-1.5 ml-5 font-mono text-[10px] text-slate-400 dark:text-zinc-500">
              {{ new Date(session.updatedAt).toLocaleDateString() }}
            </p>
          </div>
          <button
            class="rounded-lg p-1.5 text-slate-400 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 dark:text-zinc-500 dark:hover:bg-rose-950/60 dark:hover:text-rose-300"
            title="删除对话"
            @click.stop="deleteSession(session.id)"
          >
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>

    <!-- Chat Interface -->
    <article class="flex flex-1 flex-col bg-white dark:bg-zinc-950">
      <header
        class="z-10 flex items-center justify-between border-b border-slate-100 bg-white px-8 py-5 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div>
          <h3 class="text-base font-semibold text-slate-800 dark:text-zinc-100">
            {{ activeSession?.title || '业务分析' }}
          </h3>
          <p class="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            基于实时客流、销量与库存数据分析
          </p>
        </div>
        <div class="flex items-center gap-3">
          <span
            v-if="chatPending"
            class="inline-flex animate-pulse items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300"
          >
            <Loader2 class="w-3 h-3 animate-spin" />
            分析中...
          </span>
          <button
            v-if="chatHistory.length > 0"
            class="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600 dark:text-zinc-400 dark:hover:border-rose-900 dark:hover:bg-rose-950/60 dark:hover:text-rose-300"
            title="清空当前对话内容"
            @click="handleClearChat"
          >
            <Trash2 class="w-3.5 h-3.5" />
            清空数据
          </button>
        </div>
      </header>

      <div ref="chatContainer" class="flex-1 overflow-y-auto p-8 space-y-6">
        <!-- Empty State & Presets -->
        <div
          v-if="chatHistory.length === 0"
          class="flex flex-col items-center justify-center h-full max-w-2xl mx-auto space-y-10 animate-in fade-in duration-500"
        >
          <div class="flex flex-col items-center text-center space-y-4">
            <div
              class="mb-2 flex h-16 w-16 -rotate-3 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 shadow-sm dark:border-indigo-900 dark:bg-indigo-950/60"
            >
              <Sparkles class="w-8 h-8 text-indigo-600" />
            </div>
            <div>
              <h3 class="text-xl font-semibold text-slate-900 dark:text-zinc-50">
                LiteMart 业务助理
              </h3>
              <p class="mt-2 max-w-md text-sm leading-relaxed text-slate-500 dark:text-zinc-400">
                您可以直接通过自然语言分析销售业绩、定位缺货商品，或排查异常的系统流水。今天需要查看什么数据？
              </p>
            </div>
          </div>

          <div class="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
            <button
              v-for="preset in presetQuestions"
              :key="preset"
              class="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-700"
              @click="handlePresetClick(preset)"
            >
              <div
                class="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-50 transition-colors group-hover:bg-indigo-50 dark:bg-zinc-800 dark:group-hover:bg-indigo-950/60"
              >
                <ChevronRight
                  class="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600 dark:text-zinc-500 dark:group-hover:text-indigo-300"
                />
              </div>
              <span
                class="text-sm font-medium leading-snug text-slate-600 group-hover:text-slate-900 dark:text-zinc-300 dark:group-hover:text-zinc-50"
                >{{ preset }}</span
              >
            </button>
          </div>
        </div>

        <!-- Chat Messages -->
        <div
          v-for="(msg, index) in chatHistory"
          :key="index"
          class="flex gap-4 animate-in slide-in-from-bottom-2 duration-300"
          :class="msg.role === 'user' ? 'flex-row-reverse' : ''"
        >
          <div
            class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-slate-100 shadow-sm dark:border-zinc-800"
            :class="
              msg.role === 'user'
                ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300'
                : 'bg-white text-slate-700 dark:bg-zinc-900 dark:text-zinc-300'
            "
          >
            <User v-if="msg.role === 'user'" class="w-4 h-4" />
            <Sparkles v-else class="w-4 h-4" />
          </div>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div
            class="max-w-[85%] break-words rounded-2xl px-5 py-3.5 text-[0.95rem] leading-relaxed shadow-sm"
            :class="
              msg.role === 'user'
                ? 'bg-indigo-600 text-white rounded-tr-sm'
                : 'max-w-none rounded-tl-sm border border-slate-100 bg-white text-slate-700 prose prose-sm prose-slate prose-p:leading-relaxed prose-pre:border prose-pre:border-slate-100 prose-pre:bg-slate-50 prose-pre:text-slate-700 prose-a:text-indigo-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:prose-invert dark:prose-pre:border-zinc-800 dark:prose-pre:bg-zinc-950 dark:prose-pre:text-zinc-200 dark:prose-a:text-indigo-300'
            "
            v-html="formatChatMessage(msg)"
          ></div>
        </div>

        <!-- Pending State -->
        <div v-if="chatPending" class="flex gap-4 animate-in fade-in duration-300">
          <div
            class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-slate-100 bg-white text-slate-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
          >
            <Sparkles class="w-4 h-4" />
          </div>
          <div
            class="flex items-center gap-3 rounded-2xl rounded-tl-sm border border-slate-100 bg-white px-5 py-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <Loader2 class="w-4 h-4 animate-spin text-indigo-600" />
            <span class="text-sm font-medium tracking-wide text-slate-500 dark:text-zinc-400"
              >拉取数据源并分析中...</span
            >
          </div>
        </div>
      </div>

      <footer class="border-t border-slate-100 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <form
          class="relative flex items-end rounded-xl border border-slate-200 bg-slate-50/50 shadow-sm transition-all focus-within:border-indigo-600 focus-within:ring-4 focus-within:ring-indigo-600/10 dark:border-zinc-800 dark:bg-zinc-900/80"
          @submit.prevent="handleSendMessage"
        >
          <textarea
            ref="textareaRef"
            v-model="chatInput"
            rows="1"
            placeholder="描述您想分析的业务数据... (Enter 发送，Shift + Enter 换行)"
            class="min-h-[52px] max-h-[150px] w-full resize-none border-none bg-transparent py-4 pl-5 pr-14 text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-zinc-200 dark:placeholder:text-zinc-500"
            :disabled="chatPending"
            @keydown.enter.exact.prevent="handleSendMessage"
          ></textarea>
          <div class="absolute right-2 bottom-2">
            <button
              type="submit"
              class="p-2.5 rounded-lg text-white transition-all transform"
              :class="
                chatInput.trim() && !chatPending
                  ? 'bg-indigo-600 hover:bg-indigo-700 hover:scale-105 active:scale-95 shadow-md'
                  : 'cursor-not-allowed bg-slate-300 dark:bg-zinc-700 dark:text-zinc-400'
              "
              :disabled="!chatInput.trim() || chatPending"
            >
              <Send class="w-4 h-4" />
            </button>
          </div>
        </form>
        <div class="text-center mt-3">
          <span class="text-[11px] font-medium text-slate-400 dark:text-zinc-500"
            >Copilot 分析结果由 AI 驱动，敏感数据请结合实际单据二次核对。</span
          >
        </div>
      </footer>
    </article>
  </div>
</template>
