import { H3Error } from 'h3'
import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from 'ai'
import { prisma } from '~~/server/lib/prisma'
import {
  persistChatExchange,
  requireOwnedChatSession
} from '~~/server/services/chat-session-service'
import { getBiProvider } from '~~/server/ai/providers'
import {
  buildBiAssistantSystemPrompt,
  getBiAssistantSystemRules
} from '~~/server/ai/prompts/bi-assistant'
import { buildBiContext } from '~~/server/ai/prompts/bi-context'
import { lookupOrderTool } from '~~/server/ai/tools/lookup-order'
import { listOrdersByDateTool } from '~~/server/ai/tools/list-orders-by-date'

const extractLastUserText = (messages: UIMessage[]): string => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (message?.role !== 'user') continue
    const textPart = (message.parts ?? []).find(
      (part): part is { type: 'text'; text: string } => part.type === 'text'
    )
    if (textPart?.text) return textPart.text
  }
  return ''
}

// 客户端 Chat 类始终消费 UI Message Stream，无 stream 标记
export default defineEventHandler(async (event) => {
  try {
    const body = (await readBody(event)) as {
      messages?: UIMessage[]
      sessionId?: string
      id?: string
    }
    const messages = Array.isArray(body.messages) ? body.messages : []
    const sessionId = body.sessionId
    const userId = event.context.auth?.user?.id

    if (messages.length === 0) {
      throw createError({ statusCode: 400, message: '消息不能为空' })
    }

    const config = useRuntimeConfig(event)
    const provider = getBiProvider(config)

    if (sessionId) {
      await requireOwnedChatSession(prisma, sessionId, userId)
    }

    if (!provider.isConfigured || !provider.model) {
      // 即使没配 key，也以 UI Message Stream 形式返错，让客户端 Chat 统一消费
      const errorText =
        '系统未配置 AI API Key，无法进行数据分析。请配置 `NUXT_AI_API_KEY`（任意 OpenAI 兼容端点）。'
      const messageId = `err-${Date.now()}`
      const stream = new ReadableStream({
        start(controller) {
          const enc = new TextEncoder()
          controller.enqueue(
            enc.encode(`data: ${JSON.stringify({ type: 'start', messageId })}\n\n`)
          )
          controller.enqueue(
            enc.encode(`data: ${JSON.stringify({ type: 'text-start', id: messageId })}\n\n`)
          )
          controller.enqueue(
            enc.encode(
              `data: ${JSON.stringify({ type: 'text-delta', id: messageId, delta: errorText })}\n\n`
            )
          )
          controller.enqueue(
            enc.encode(`data: ${JSON.stringify({ type: 'text-end', id: messageId })}\n\n`)
          )
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'finish' })}\n\n`))
          controller.close()
        }
      })
      return new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no'
        }
      })
    }

    const context = await buildBiContext(prisma)
    const system = buildBiAssistantSystemPrompt(context) + '\n\n' + getBiAssistantSystemRules()
    const lastUserText = extractLastUserText(messages)
    const tools = { lookupOrder: lookupOrderTool, listOrdersByDate: listOrdersByDateTool }

    const result = streamText({
      model: provider.model,
      system,
      messages: await convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(5),
      onFinish: async ({ text }) => {
        if (sessionId && userId && text.trim()) {
          const question = lastUserText || text
          await persistChatExchange(prisma, sessionId, userId, question, text)
        }
      }
    })

    return result.toUIMessageStreamResponse({
      onError: (error) => {
        if (error instanceof Error) return error.message
        return String(error ?? '对话处理失败')
      }
    })
  } catch (error: unknown) {
    console.error('Chat BI Error:', error)
    if (error instanceof H3Error) throw error
    const errMessage = error instanceof Error ? error.message : '对话处理失败'
    throw createError({ statusCode: 500, message: errMessage })
  }
})
