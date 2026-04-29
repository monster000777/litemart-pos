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
  sendMessage
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

const handleClearChat = () => {
  clearChat()
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

onMounted(() => {
  initialize()
  setTimeout(() => scrollToBottom(), 100)
})
</script>

<template>
  <div class="w-full flex -m-6 md:-m-8 h-[calc(100vh-4rem)] bg-white overflow-hidden">
    <!-- Sidebar Session List -->
    <aside class="w-72 flex-shrink-0 flex flex-col bg-slate-50/50 border-r border-slate-200">
      <div class="p-6 border-b border-slate-200 bg-white z-10">
        <h2 class="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-4">
          <Sparkles class="w-5 h-5 text-indigo-600" />
          业务助理 Copilot
        </h2>
        <button
          :disabled="activeSession?.messages.length === 0"
          class="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-xl font-medium text-sm transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 hover:shadow"
          @click="createNewSession"
        >
          <MessageSquarePlus class="w-4 h-4" />
          开启新分析
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-1.5">
        <div
          v-for="session in sessions"
          :key="session.id"
          class="group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border border-transparent"
          :class="
            activeSessionId === session.id
              ? 'bg-white border-slate-200 shadow-sm text-indigo-700'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          "
          @click="activeSessionId = session.id"
        >
          <div class="flex-1 min-w-0 pr-2">
            <p class="text-sm font-medium truncate flex items-center gap-2" :title="session.title">
              <MessageSquare class="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
              {{ session.title }}
            </p>
            <p class="text-[10px] text-slate-400 mt-1.5 ml-5 font-mono">
              {{ new Date(session.updatedAt).toLocaleDateString() }}
            </p>
          </div>
          <button
            class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
            title="删除对话"
            @click.stop="deleteSession(session.id)"
          >
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>

    <!-- Chat Interface -->
    <article class="flex-1 flex flex-col bg-white">
      <header
        class="px-8 py-5 flex items-center justify-between border-b border-slate-100 z-10 bg-white"
      >
        <div>
          <h3 class="text-base font-semibold text-slate-800">
            {{ activeSession?.title || '业务分析' }}
          </h3>
          <p class="mt-1 text-xs text-slate-500">基于实时客流、销量与库存数据分析</p>
        </div>
        <div class="flex items-center gap-3">
          <span
            v-if="chatPending"
            class="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100 animate-pulse"
          >
            <Loader2 class="w-3 h-3 animate-spin" />
            分析中...
          </span>
          <button
            v-if="chatHistory.length > 0"
            class="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-rose-600 transition-colors px-3 py-2 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-100"
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
              class="w-16 h-16 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mb-2 shadow-sm transform -rotate-3"
            >
              <Sparkles class="w-8 h-8 text-indigo-600" />
            </div>
            <div>
              <h3 class="text-xl font-semibold text-slate-900">LiteMart 业务助理</h3>
              <p class="text-sm text-slate-500 max-w-md mt-2 leading-relaxed">
                您可以直接通过自然语言分析销售业绩、定位缺货商品，或排查异常的系统流水。今天需要查看什么数据？
              </p>
            </div>
          </div>

          <div class="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
            <button
              v-for="preset in presetQuestions"
              :key="preset"
              class="flex items-start gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-md hover:-translate-y-0.5 transition-all text-left group"
              @click="handlePresetClick(preset)"
            >
              <div
                class="mt-0.5 w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-50 transition-colors"
              >
                <ChevronRight class="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
              </div>
              <span
                class="text-sm text-slate-600 font-medium group-hover:text-slate-900 leading-snug"
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
            class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm border border-slate-100"
            :class="
              msg.role === 'user' ? 'bg-indigo-50 text-indigo-600' : 'bg-white text-slate-700'
            "
          >
            <User v-if="msg.role === 'user'" class="w-4 h-4" />
            <Sparkles v-else class="w-4 h-4" />
          </div>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div
            class="max-w-[85%] rounded-2xl px-5 py-3.5 text-[0.95rem] leading-relaxed break-words shadow-sm"
            :class="
              msg.role === 'user'
                ? 'bg-indigo-600 text-white rounded-tr-sm'
                : 'bg-white border border-slate-100 text-slate-700 rounded-tl-sm prose prose-sm prose-slate max-w-none prose-p:leading-relaxed prose-pre:bg-slate-50 prose-pre:text-slate-700 prose-pre:border prose-pre:border-slate-100 prose-a:text-indigo-600'
            "
            v-html="formatChatMessage(msg)"
          ></div>
        </div>

        <!-- Pending State -->
        <div v-if="chatPending" class="flex gap-4 animate-in fade-in duration-300">
          <div
            class="flex-shrink-0 w-8 h-8 rounded-full bg-white border border-slate-100 text-slate-700 flex items-center justify-center shadow-sm"
          >
            <Sparkles class="w-4 h-4" />
          </div>
          <div
            class="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-5 py-3.5 shadow-sm flex items-center gap-3"
          >
            <Loader2 class="w-4 h-4 animate-spin text-indigo-600" />
            <span class="text-sm text-slate-500 font-medium tracking-wide"
              >拉取数据源并分析中...</span
            >
          </div>
        </div>
      </div>

      <footer class="p-6 bg-white border-t border-slate-100">
        <form
          class="relative flex items-end bg-slate-50/50 border border-slate-200 rounded-xl focus-within:border-indigo-600 focus-within:ring-4 focus-within:ring-indigo-600/10 transition-all shadow-sm"
          @submit.prevent="handleSendMessage"
        >
          <textarea
            ref="textareaRef"
            v-model="chatInput"
            rows="1"
            placeholder="描述您想分析的业务数据... (Enter 发送，Shift + Enter 换行)"
            class="w-full bg-transparent border-none outline-none pl-5 pr-14 py-4 text-sm text-slate-700 placeholder:text-slate-400 resize-none min-h-[52px] max-h-[150px]"
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
                  : 'bg-slate-300 cursor-not-allowed'
              "
              :disabled="!chatInput.trim() || chatPending"
            >
              <Send class="w-4 h-4" />
            </button>
          </div>
        </form>
        <div class="text-center mt-3">
          <span class="text-[11px] text-slate-400 font-medium"
            >Copilot 分析结果由 AI 驱动，敏感数据请结合实际单据二次核对。</span
          >
        </div>
      </footer>
    </article>
  </div>
</template>
