# LLM Proxy

## 描述

LLM Proxy 是一个用 TypeScript 和 Hono 构建的轻量级代理服务器。它为多个大型语言模型（LLM）提供商（如 OpenAI、Google Gemini、Anthropic Claude 和 Qwen）提供统一的 API 接口。

该代理能够接收一种格式的请求（例如 OpenAI 的格式），将其转换为目标提供商的原生格式，然后将响应转换回原始请求的格式。这使得在不同的 LLM 提供商之间切换变得轻而易举，而无需更改客户端代码。

## 功能

*   **统一 API**: 为多个 LLM 提供商提供单一的、一致的 API 端点。
*   **协议转换**: 在 OpenAI、Gemini 和 Claude API 格式之间自动转换请求和响应负载。
*   **流式支持**: 完全支持通过服务器发送事件（SSE）进行流式响应。
*   **可扩展的提供商架构**: 通过 `src/providers` 目录中的模块化提供商，可以轻松添加新的 LLM 提供商。
*   **动态提供商选择**: 根据请求中指定的模型名称自动路由到相应的 LLM 提供商。
*   **配置**: 通过 `config.json` 文件或KV数据库存储配置和密钥相关信息。
*   ***转换***: 使用Rust打包的WASM进行请求和响应负载的高效转换。

## 快速入门

### 先决条件

*   [Bun](https://bun.sh/)

### 安装

1.  克隆仓库：
    ```bash
    git clone <your-repo-url>
    cd llm-proxy
    ```

2.  安装依赖：
    ```bash
    bun install
    ```

### 配置

1.  在项目的根目录中创建一个 `config.json` 文件。
2.  添加您的 LLM 提供商的 API 密钥和任何其他配置。该文件应遵循以下结构：

    ```json
{
    "gemini_cli": [
        {
            "projects": [],
            "auth": {
                "access_token": "",
                "scope": "",
                "token_type": "",
                "expiry_date": 0,
                "refresh_token": ""
            },
            "models": []
        }
    ],
    "qwen": [
        {
            "auth": {},
            "models": []
        }
    ],
    "openai": [
        {
            "base_url": "",
            "api_key": "",
            "models": []
        }
    ],
    "claude": [
        {
            "base_url": "",
            "api_key": "",
            "models": []
        }
    ],
    "model_priority": []
}
    ```

### 运行服务器

使用以下命令以热重载模式启动开发服务器：

```bash
bun run dev
```

服务器将在 `http://localhost:3000` 上运行。

## API 端点

代理服务器公开了与各种 LLM 提供商的 API 格式相对应的多个端点。

### OpenAI 兼容端点

*   `POST /v1/chat/completions`

此端点接受标准 OpenAI `chat/completions` API 请求。您可以通过在请求正文中指定 `model` 参数来使用任何受支持的提供商的模型。

**示例请求:**
```bash
curl --request POST \
  --url http://localhost:3000/v1/chat/completions \
  --header 'content-type: application/json' \
  --data '{
    "model": "gemini-2.5-pro",
    "temperature": 0,
    "messages": [
        {
            "role": "user",
            "content": "你是什么大模型？"
        }
    ],
    "stream": false,
    "stream_options": {
        "include_usage": true
    }
```

### Google Gemini 兼容端点

*   `POST /v1beta/models/:modelName`

此端点模仿 Gemini API。

**示例请求:**
```bash
curl --request POST \
  --url 'http://localhost:3000/v1beta/models/gemini-2.5-pro:streamGenerateContent?alt=sse' \
  --header 'Content-Type: application/json' \
  --header 'x-goog-api-key: ABCD-1234' \
  --data '{
    "contents": [
        {
            "parts": [
                {
                    "text": "你是什么大模型？"
                }
            ]
        }
    ]
}'
```

### Anthropic Claude 兼容端点

*   `POST /v1/messages`

此端点与 Claude 的 `messages` API 兼容。

**示例请求:**
```bash
curl --request POST \
  --url http://localhost:3000/v1/messages \
  --header 'content-type: application/json' \
  --data '{
    "max_tokens": 512,
    "messages": [
        {
            "content": "你是什么大模型?",
            "role": "user"
        }
    ],
    "model": "gemini-2.5-pro",
    "stream": true,
    "system": [
        {
            "text": "Analyze if this message indicates a new conversation topic. If it does, extract a 2-3 word title that captures the new topic. Format your response as a JSON object with two fields: '\''isNewTopic'\'' (boolean) and '\''title'\'' (string, or null if isNewTopic is false). Only include these fields, no other text.",
            "type": "text"
        }
    ],
    "temperature": 0
}'
```

## 项目结构

```
src
|____middleware
| |____init.ts
|____types
| |____config.ts
|____providers
| |____claude
| | |____adapter.ts
| | |____index.ts
| |____qwen
| | |____adapter.ts
| | |____index.ts
| |____factory.ts
| |____gemini_cli
| | |____adapter.ts
| | |____index.ts
| | |____auth.ts
| |_____base
| | |____index.ts
| |____openai
| | |____adapter.ts
| | |____index.ts
|____utils
| |____routeHandlers.ts
| |____fetch.ts
|____streaming
| |____sse.ts
|____index.ts
|____config.ts
|____server.ts
|____services
| |____polling.ts
| |____credentials.ts
| |____models.ts
```

## 转换实现原理

LLM Proxy 的核心价值在于其强大的协议转换能力。其基本原理是：**以 OpenAI 的 API 格式作为统一的中间表示层**。这意味着所有来自不同厂商（如 Google Gemini 或 Anthropic Claude）的请求都会首先被适配器转换为 OpenAI 格式，然后再转发给相应的 LLM 提供商。同样，从 LLM 提供商返回的响应也会被转换回原始请求所期望的格式（如果原始请求是 OpenAI 格式，则直接返回；如果是其他厂商格式，则先转换为该厂商的原生格式）。

这种“OpenAI 居中”的策略带来了以下优势：
*   **简化适配**: 只需为每个 LLM 提供商编写两个转换器（A -> OpenAI 和 OpenAI -> A），而不是为每对提供商之间编写独立的转换器，这大大减少了所需的适配器数量。
*   **高度兼容**: OpenAI API 已成为行业事实标准，许多现有应用和工具都基于此。LLM Proxy 能够无缝兼容这些应用。
*   **未来可扩展**: 添加新的 LLM 提供商时，只需实现其与 OpenAI 格式之间的转换逻辑即可。

所有这些复杂的请求和响应负载转换，都通过 **Rust 编写并编译为 WebAssembly (WASM)** 的模块来高效完成。WASM 的使用确保了转换过程在高性能、低延迟的环境下运行，即使面对高并发的流式请求也能保持卓越表现。这种设计将计算密集型任务从 Node.js 主线程卸载，提供了接近原生的执行速度。

## 核心实现逻辑

LLM Proxy 的核心实现逻辑围绕 `Hono` Web 框架和模块化的提供商架构构建。以下是请求处理的主要流程：

1.  **服务器初始化**:
    *   项目入口点是 `src/index.ts`，它使用 `Hono` 创建了一个 Web 服务器实例。
    *   `src/server.ts` 文件定义了所有 API 路由，包括：
        *   `POST /v1/chat/completions` (OpenAI 兼容)
        *   `POST /v1beta/models/:modelName` (Google Gemini 兼容)
        *   `POST /v1/messages` (Anthropic Claude 兼容)
        *   `GET /v1/models` (列出所有可用模型)
    *   服务器还配置了 CORS 中间件和用于提供静态文件的 `serveStatic`。

2.  **请求处理 (`handleModelRequest`)**:
    *   所有模型相关的请求都由 `src/utils/routeHandlers.ts` 中的 `handleModelRequest` 函数统一处理。
    *   该函数首先从请求中解析出模型名称、是否流式传输等信息。
    *   **提供者选择**:
        *   它调用 `src/providers/factory.ts` 中的 `getProvider` 函数，根据模型名称获取相应的提供者实例。
        *   `getProvider` 会构建一个从模型到提供者的映射关系。如果一个模型被多个提供者支持，它会根据 `config.json` 中 `model_priority` 数组定义的优先级来选择提供者。如果未指定，则默认为 OpenAI。
    *   **请求转换**:
        *   获取到提供者后，请求体会被传递给该提供者的 `convertRequestTo` 方法，该方法通过 `pkg/converter_wasm.js` 中的 WASM 模块将请求负载转换为目标提供商（如 OpenAI、Gemini 或 Claude）的原生格式。
    *   **API 调用**:
        *   转换后的请求通过 `provider.fetchResponse` 方法发送到相应的 LLM 提供商。
    *   **响应转换**:
        *   如果响应是流式的，`provider.convertStreamResponseTo` 会将提供商返回的 Server-Sent Events (SSE) 流实时转换为原始请求所需的格式，并流式传输回客户端。
        *   如果响应是非流式的，`provider.convertResponseTo` 会在返回给客户端之前，一次性将完整的响应负载转换为所需的格式。

3.  **凭据和配置管理**:
    *   **Deno KV**: 项目使用 `Deno KV` 数据库来安全地存储和管理敏感的凭据信息。`src/services/credentials.ts` 提供了 `getCredentials` 和 `updateCredentials` 函数来与 Deno KV 进行交互。
    *   **自动令牌刷新**: `src/index.ts` 中定义了一个 Deno Cron 作业 (`Deno.cron`)，该作业会定期（每6小时）运行，自动刷新 `iFlow` 提供商的身份验证令牌，并将更新后的凭据存回 Deno KV。
    *   **配置加载**: 项目启动时，会从 `local.json` 文件和 Deno KV 加载配置。这些配置信息被合并到 `appConfig` 对象中，供整个应用程序使用。

通过这种方式，LLM Proxy 实现了一个灵活、可扩展的架构，能够轻松地在多个 LLM 提供商之间进行路由和转换，同时通过 Deno 的原生功能实现了安全的凭据管理和后台任务自动化。

## 请求转换适配

WASM 模块提供了以下请求转换能力：
1.  **Gemini -> OpenAI**:
    *   文本内容
    *   图片内容 (多模态)
    *   函数调用 (将 Gemini 的函数调用转换为 OpenAI 格式)
2.  **Claude -> OpenAI**:
    *   文本内容
    *   函数调用 (将 Claude 的函数调用转换为 OpenAI 格式)
3.  **Qwen -> OpenAI**:
    *   文本内容
    *   图片内容 (多模态)

## 响应转换适配

WASM 模块提供了以下响应转换能力：
1.  **OpenAI -> Gemini**:
    *   文本内容
    *   函数调用
2.  **OpenAI -> Claude**:
    *   文本内容
    *   函数调用
3.  **OpenAI -> Qwen**:
    *   文本内容