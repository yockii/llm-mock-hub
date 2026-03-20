# LLM Mock Hub

🤖 统一的 LLM API 模拟服务，基于 Cloudflare Workers 构建，支持 OpenAI、Anthropic 和 Ollama 等主流 LLM 接口。

## 项目简介

LLM Mock Hub 是一个专为开发者设计的工具，用于在开发和测试过程中模拟各种 LLM API 的响应，无需消耗真实的 API 令牌。通过这个服务，你可以：

- 测试不同 LLM 提供商的集成代码
- 模拟各种错误场景（认证失败、限流、服务器错误、超时）
- 快速验证你的应用在不同响应情况下的表现
- 开发过程中无需依赖真实的 LLM 服务

## 功能特点

- **多提供商支持**：兼容 OpenAI、Anthropic (Claude) 和 Ollama 的 API 格式
- **流式响应**：支持流式输出，模拟真实 LLM 的打字效果
- **错误模拟**：提供多种错误场景的模拟，帮助测试错误处理
- **易于部署**：基于 Cloudflare Workers，部署简单快捷
- **自定义响应**：可以根据需要修改响应内容和行为

## 如何使用

### 1. 部署服务

首先，你需要将此项目部署到 Cloudflare Workers：

1. 克隆本仓库
2. 安装依赖：`npm install`
3. 登录 Cloudflare：`npx wrangler login`
4. 部署服务：`npx wrangler deploy`

### 2. 配置你的应用

在你的应用代码中，将 LLM SDK 的 `base_url` 替换为部署后的 Workers 地址：

#### OpenAI 示例

```python
from openai import OpenAI

# 正常调用
client = OpenAI(base_url="https://your-worker.your-subdomain.workers.dev/openai/v1", api_key="anything")

# 模拟 429 限流
client = OpenAI(base_url="https://your-worker.your-subdomain.workers.dev/openai/429/v1", api_key="anything")
```

#### Anthropic 示例

```python
from anthropic import Anthropic

# 正常调用
client = Anthropic(base_url="https://your-worker.your-subdomain.workers.dev/anthropic/v1", api_key="anything")

# 模拟 401 认证失败
client = Anthropic(base_url="https://your-worker.your-subdomain.workers.dev/anthropic/401/v1", api_key="anything")
```

#### Ollama 示例

```python
import requests

# 正常调用
response = requests.post(
    "https://your-worker.your-subdomain.workers.dev/ollama/api/chat",
    json={
        "model": "llama3",
        "messages": [{"role": "user", "content": "Hello!"}],
        "stream": True
    }
)
```

### 3. 可用端点

#### OpenAI 兼容
- ✅ 成功: `/openai/v1/chat/completions`
- ❌ 401 认证失败: `/openai/401/v1/chat/completions`
- ❌ 429 限流: `/openai/429/v1/chat/completions`
- ❌ 500 服务器错误: `/openai/500/v1/chat/completions`
- ⏳ 超时: `/openai/timeout/v1/chat/completions`

#### Anthropic (Claude) 兼容
- ✅ 成功: `/anthropic/v1/messages`
- ❌ 401 认证失败: `/anthropic/401/v1/messages`
- ❌ 429 限流: `/anthropic/429/v1/messages`

#### Ollama 兼容
- ✅ 成功: `/ollama/api/chat`
- ❌ 401 认证失败: `/ollama/401/api/chat`
- ❌ 429 限流: `/ollama/429/api/chat`
- ⏳ 超时: `/ollama/timeout/api/chat`

## 使用我提供的免费服务
可以使用该url作为测试，无需部署

https://llm.mocker.top

## 自定义与扩展

这个项目设计为易于修改和扩展，你可以：

1. **修改响应内容**：编辑 `MOCK_RESPONSE_TEXT` 和 `MOCK_RESPONSE_TEXT_FOR_STREAM` 变量
2. **调整响应延迟**：修改 `sleep` 函数的参数
3. **添加新的错误场景**：在 `ERROR_RESPONSES` 对象中添加新的错误类型
4. **支持更多 LLM 提供商**：添加新的路由和响应处理逻辑

## 本地开发

1. 安装依赖：`npm install`
2. 启动开发服务器：`npm run dev`
3. 访问本地地址：`http://localhost:8787`

## 部署到 Cloudflare Workers

1. 确保你有 Cloudflare 账户
2. 登录 Cloudflare：`npx wrangler login`
3. 部署服务：`npx wrangler deploy`
4. 获取部署后的 URL 并在你的应用中使用

## 鼓励参与

这个项目是开源的，欢迎大家：

-  Fork 本仓库并根据自己的需求进行修改
-  添加对更多 LLM 提供商的支持
-  改进错误处理和响应模拟
-  分享你的使用经验和改进建议

## 许可证

ISC License

## 作者

Yockii

---

**提示**：部署后，你可以通过访问根路径 (`/`) 查看详细的使用文档和示例代码。