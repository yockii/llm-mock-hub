import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type {ContentfulStatusCode} from 'hono/utils/http-status'

const app = new Hono()

app.use('/*', cors())

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const generateId = (prefix: string) => `${prefix}-${Math.random().toString(36).substring(2, 15)}`

const MOCK_RESPONSE_TEXT = "你好！这是由Yockii创作的基于Cloudflare Workers的LLM Mock服务。你的代码连接成功，无需消耗任何Token！🚀"
const MOCK_RESPONSE_TEXT_FOR_STREAM = "你好 ！ 这是 由 Yockii 创作 的 基于 Cloudflare Workers 的 LLM Mock 服务 。 你的 代码 连接 成功 ， 无需 消耗 任何 Token！ 🚀"

// --- 通用错误响应 ---
const ERROR_RESPONSES: Record<string, { status: ContentfulStatusCode; body: any }> = {
    '401': {
        status: 401,
        body: { error: { message: "Invalid API key provided", type: "invalid_request_error", code: "invalid_api_key" } }
    },
    '429': {
        status: 429,
        body: { error: { message: "Rate limit exceeded", type: "rate_limit_exceeded", code: "rate_limit_exceeded" } }
    },
    '500': {
        status: 500,
        body: { error: { message: "Internal server error", type: "internal_error", code: "internal_error" } }
    }
}

// --- 通用流式响应生成器 ---
async function createStreamResponse(
    c: any,
    provider: 'openai' | 'anthropic' | 'ollama',
    body: any,
    mockText: string
): Promise<Response> {
    const encoder = new TextEncoder()
    const streamResponse = new ReadableStream({
        async start(controller) {
            const words = mockText.split(' ')

            if (provider === 'openai') {
                for (const word of words) {
                    await sleep(50 + Math.random() * 50)
                    const chunk = {
                        id: generateId('chatcmpl'),
                        object: 'chat.completion.chunk',
                        created: Math.floor(Date.now() / 1000),
                        model: body.model || 'gpt-3.5-turbo-mock',
                        choices: [
                            {
                                index: 0,
                                delta: {
                                    role: 'assistant',
                                    content: word + ' '
                                },
                                finish_reason: null
                            }
                        ]
                    }
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
                }

                const finalChunk = {
                    id: generateId('chatcmpl'),
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: body.model || 'gpt-3.5-turbo-mock',
                    choices: [
                        {
                            index: 0,
                            delta: {},
                            finish_reason: 'stop'
                        }
                    ]
                }

                controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`))
                controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
            } else if (provider === 'anthropic') {
                controller.enqueue(encoder.encode(`event: message_start\ndata: {"type":"message_start","message":{"id":"${generateId('msg')}","type":"message","role":"assistant","content":[],"model":"${body.model || 'claude-3-haiku-mock'}","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":10,"output_tokens":0}}}\n\n`))
                controller.enqueue(encoder.encode(`event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n`))

                for (const word of words) {
                    await sleep(50 + Math.random() * 50)
                    const deltaEvent = {
                        type: 'content_block_delta',
                        index: 0,
                        delta: {
                            type: 'text_delta',
                            text: word + ' '
                        }
                    }

                    controller.enqueue(encoder.encode(`event: content_block_delta\ndata: ${JSON.stringify(deltaEvent)}\n\n`))
                }

                controller.enqueue(encoder.encode(`event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n`))
                controller.enqueue(encoder.encode(`event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":20}}\n\n`))
                controller.enqueue(encoder.encode(`event: message_stop\ndata: {"type":"message_stop"}\n\n`))
            } else if (provider === 'ollama') {
                for (const word of words) {
                    await sleep(50 + Math.random() * 50)
                    const chunk = {
                        model: body.model || 'llama3-mock',
                        created_at: new Date().toISOString(),
                        message: { role: 'assistant', content: word + ' ' },
                        done: false,
                    }
                    controller.enqueue(encoder.encode(`${JSON.stringify(chunk)}\n`))
                }

                const finalChunk = {
                    model: body.model || 'llama3-mock',
                    created_at: new Date().toISOString(),
                    message: { role: 'assistant', content: '' },
                    done: true,
                    total_duration: 1000000000,
                    load_duration: 100000000,
                    prompt_eval_count: 10,
                    eval_count: 20,
                }
                controller.enqueue(encoder.encode(`${JSON.stringify(finalChunk)}\n`))
            }

            controller.close()
        }
    })

    let contentType = 'application/json'
    if (provider === 'openai') {
        contentType = 'text/event-stream'
    } else if (provider === 'anthropic') {
        contentType = 'text/event-stream'
    } else if (provider === 'ollama') {
        contentType = 'application/x-ndjson'
    }

    return new Response(streamResponse, {
        headers: {
            'Content-Type': contentType,
            'Cache-Control': 'no-cache',
            ...(provider === 'openai' || provider === 'anthropic' ? { 'Connection': 'keep-alive'}: {}),
        }
    })
}



/**
 * OpenAI兼容接口
 * POST /openai/v1/chat/completions
 */
app.post("/openai/v1/chat/completions", async (c) => {
    const body = await c.req.json()
    const stream = body.stream ?? false

    if(!stream) {
        return c.json({
            id: generateId('chatcmpl'),
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: body.model || 'gpt-3.5-turbo-mock',
            choices: [{index:0,message:{role:'assistant',content:MOCK_RESPONSE_TEXT},finish_reason:'stop'}],
            usage: {prompt_tokens:10,output_tokens:20,total_tokens:30}
        })
    }

    return createStreamResponse(c, 'openai', body, MOCK_RESPONSE_TEXT_FOR_STREAM)
})

// --- OpenAI 错误响应 ---
app.post('/openai/401/v1/chat/completions', (c) => c.json(ERROR_RESPONSES['401']?.body, ERROR_RESPONSES['401']?.status))
app.post('/openai/429/v1/chat/completions', (c) => c.json(ERROR_RESPONSES['429']?.body, ERROR_RESPONSES['429']?.status))
app.post('/openai/500/v1/chat/completions', (c) => c.json(ERROR_RESPONSES['500']?.body, ERROR_RESPONSES['500']?.status))
app.post('/openai/timeout/v1/chat/completions', async (c) => {
    await sleep(1000)
    return c.json({
        error: {
            message: 'Request timed out',
        }
    }, 408)
})

// --- Anthropic 兼容接口 ---
app.post('/anthropic/v1/messages', async(c)=> {
    const body = await c.req.json()
    const stream = body.stream ?? false

    if (!stream) {
        return c.json({
            id: generateId('msg'),
            type: 'message',
            role: 'assistant',
            content: [{type:'text',text:MOCK_RESPONSE_TEXT}],
            model: body.model || 'claude-3-haiku-mock',
            stop_reason: 'end_turn',
            stop_sequence: null,
            usage: {
                input_tokens: 10, output_tokens:20
            }
        })
    }

    return createStreamResponse(c, 'anthropic', body, MOCK_RESPONSE_TEXT_FOR_STREAM)
})

// --- Anthropic 错误响应 ---
app.post('/anthropic/401/v1/messages', (c) => c.json(ERROR_RESPONSES['401']?.body, ERROR_RESPONSES['401']?.status))
app.post('/anthropic/429/v1/messages', (c) => c.json(ERROR_RESPONSES['429']?.body, ERROR_RESPONSES['429']?.status))

// --- Ollama 兼容接口 ---
app.post('/ollama/api/chat', async (c) => {
    const body = await c.req.json()
    const stream = body.stream ?? true

    if (!stream) {
        return c.json({
            model: body.model || 'llama3-mock',
            created_at: new Date().toISOString(),
            message: {role: 'assistant', content: MOCK_RESPONSE_TEXT},
            done: true,
            total_duration: 1000000000,
            load_duration: 100000000,
            prompt_eval_count: 10,
            eval_count: 20,
        })
    }

    return createStreamResponse(c, 'ollama', body, MOCK_RESPONSE_TEXT_FOR_STREAM)
})

// --- Ollama 错误响应 ---
app.post('/ollama/401/api/chat', (c) => c.json(ERROR_RESPONSES['401']?.body, ERROR_RESPONSES['401']?.status))
app.post('/ollama/429/api/chat', (c) => c.json(ERROR_RESPONSES['429']?.body, ERROR_RESPONSES['429']?.status))
app.post('/ollama/timeout/api/chat', async(c) => {
    await sleep(1000)
    return c.json({
        error: {
            message: 'Request timeout out',
        }
    }, 408)
})

// 首页文档
app.get('/', (c) => {
    return c.html(`
    <h1>🤖 LLM Mock Hub - 统一测试驱动</h1>
    <p>为 OpenAI, Anthropic, Ollama 等 LLM 提供统一的 Mock 接口，用于 Agent 开发测试。</p>

    <h3>如何使用:</h3>
    <ol>
      <li>在你的代码中，将 LLM SDK 的 <code>base_url</code> 替换为以下地址之一：</li>
    </ol>

    <h4>OpenAI 兼容:</h4>
    <ul>
      <li>✅ 成功: <code>/openai/v1</code></li>
      <li>❌ 401 认证失败: <code>/openai/401/v1</code></li>
      <li>❌ 429 限流: <code>/openai/429/v1</code></li>
      <li>❌ 500 服务器错误: <code>/openai/500/v1</code></li>
      <li>⏳ 超时: <code>/openai/timeout/v1</code></li>
    </ul>

    <h4>Anthropic (Claude) 兼容:</h4>
    <ul>
      <li>✅ 成功: <code>/anthropic/v1</code></li>
      <li>❌ 401 认证失败: <code>/anthropic/401/v1</code></li>
      <li>❌ 429 限流: <code>/anthropic/429/v1</code></li>
    </ul>

    <h4>Ollama 兼容:</h4>
    <ul>
      <li>✅ 成功: <code>/ollama/api</code></li>
      <li>❌ 401 认证失败: <code>/ollama/401/api</code></li>
      <li>❌ 429 限流: <code>/ollama/429/api</code></li>
      <li>⏳ 超时: <code>/ollama/timeout/api</code></li>
    </ul>

    <p>示例 Python 代码 (OpenAI):</p>
    <pre><code>
from openai import OpenAI

# 正常调用
client = OpenAI(base_url="https://your-worker.your-subdomain.workers.dev/openai/v1", api_key="anything")

# 模拟 429 限流
client = OpenAI(base_url="https://your-worker.your-subdomain.workers.dev/openai/429/v1", api_key="anything")
    </code></pre>
  `);
})

export default app;