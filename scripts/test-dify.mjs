/**
 * Dify 端到端连通性测试
 * 用法：
 *   npx tsx scripts/test-dify.mjs
 *   npx tsx scripts/test-dify.mjs 帮我看看今天的销售
 * 也支持从任何子目录调用，会自动定位项目根 .env
 */
import { config as loadEnv } from 'dotenv'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// 显式加载项目根的 .env（不依赖 cwd，避免在 scripts/ 目录下运行时漏读）
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
loadEnv({ path: path.join(projectRoot, '.env') })
loadEnv({ path: path.join(projectRoot, '.env.local'), override: true })

const { resolveAiConfig } = await import('../server/utils/ai-config.ts')
const { executeDifyTextStreamRequest, getAiErrorMessage } = await import(
  '../server/utils/ai-client.ts'
)

const config = {
  aiProvider: process.env.NUXT_AI_PROVIDER,
  aiApiKey: process.env.NUXT_AI_API_KEY,
  aiApiUrl: process.env.NUXT_AI_API_URL,
  aiModel: process.env.NUXT_AI_MODEL,
  minimaxApiKey: process.env.NUXT_MINIMAX_API_KEY,
  minimaxApiUrl: process.env.NUXT_MINIMAX_API_URL,
  minimaxModel: process.env.NUXT_MINIMAX_MODEL,
  difyApiKey: process.env.NUXT_DIFY_API_KEY,
  difyApiUrl: process.env.NUXT_DIFY_API_URL,
  difyAppId: process.env.NUXT_DIFY_APP_ID
}

const resolved = resolveAiConfig(config)
console.log('=== Dify 配置识别 ===')
console.log('isDifyProvider :', resolved.isDifyProvider)
console.log('difyApiUrl     :', resolved.difyApiUrl)
console.log('difyAppId      :', resolved.difyAppId || '(空)')
console.log()

if (!resolved.isDifyProvider) {
  console.log('❌ 当前 .env 没有识别为 Dify 模式，请检查 NUXT_DIFY_API_KEY')
  process.exit(1)
}

const difyUser = resolved.difyAppId
  ? `user_${resolved.difyAppId}:smoke-test`
  : 'user_smoke-test'

const query = process.argv.slice(2).join(' ') || '用一句话介绍你自己，告诉我你能帮店主做什么。'

const baseOptions = {
  difyApiKey: resolved.difyApiKey,
  difyApiUrl: resolved.difyApiUrl,
  query,
  user: difyUser,
  inputs: {
    context: { source: 'scripts/test-dify.mjs' },
    timestamp: new Date().toISOString()
  }
}

console.log('=== Test 1: 流式 (skipReasoning 默认 true) ===')
console.log('Q:', query)
console.log()
const deltas = []
const t0 = Date.now()
try {
  const { text, remoteFailures } = await executeDifyTextStreamRequest(baseOptions, {
    onText: async (delta) => {
      deltas.push(delta)
      process.stdout.write(delta)
    }
  })
  const ms = Date.now() - t0
  console.log()
  console.log()
  console.log(`✅ ${ms}ms · chunks=${deltas.length} · failures=${remoteFailures.length}`)
  console.log('   has <think>:', text.includes('<think>'))
  console.log('   full text  :', text)
} catch (e) {
  console.log('\n❌', getAiErrorMessage(e))
  process.exit(1)
}

console.log()
console.log('=== Test 2: 流式 (skipReasoning=false，保留推理) ===')
const deltas2 = []
try {
  const { text } = await executeDifyTextStreamRequest(
    { ...baseOptions, skipReasoning: false, query: '再说一句，简短一点。' },
    { onText: async (delta) => { deltas2.push(delta); process.stdout.write(delta) } }
  )
  console.log()
  console.log()
  console.log(`✅ chunks=${deltas2.length} · has <think>: ${text.includes('<think>')}`)
} catch (e) {
  console.log('\n❌', getAiErrorMessage(e))
}
