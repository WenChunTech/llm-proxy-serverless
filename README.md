# LLM Proxy

## 描述

LLM Proxy 是一个用 TypeScript 和 Hono 构建的轻量级代理服务器，运行在 Deno
运行时上。它为多个大型语言模型（LLM）提供商提供统一的 API
接口，支持在不同提供商之间透明切换，无需更改客户端代码。

支持的提供商：OpenAI Chat、OpenAI Responses、Google Gemini、Gemini CLI（OAuth）、Anthropic
Claude、Qwen、iFlow、Codex。

## 功能

- **统一 API**: 为多个 LLM 提供商提供单一的、一致的 API 端点。
- **协议转换**: 在 OpenAI、Gemini、Claude、OpenAI Responses 等 API
  格式之间自动转换请求和响应负载。
- **流式支持**: 完全支持通过服务器发送事件（SSE）进行流式响应。
- **可扩展的提供商架构**: 通过 `src/providers`
  目录中的模块化提供商和 `Provider` 接口，可以轻松添加新的 LLM 提供商。
- **动态提供商选择**: 根据请求中指定的模型名称自动路由到相应的 LLM 提供商。
- **重试与回退**: 支持跨提供商、跨配置的自动重试，以及模型级别的回退（fallback）策略。
- **配置**: 通过 `config.json` 文件或 Deno KV 数据库存储配置和密钥信息。
- **协议转换**: 使用 Rust 打包的 WASM 进行请求和响应负载的高效转换。

## 快速入门

### 先决条件

- [Deno](https://deno.com/) (v2.x+)

### 安装

1. 克隆仓库：
   ```bash
   git clone <your-repo-url>
   cd llm-proxy
   ```

2. 安装依赖（Deno 会自动处理，如需手动安装）：
   ```bash
   deno install
   ```

### 配置

1. 在项目的根目录中创建一个 `config.json` 文件。
2. 添加您的 LLM 提供商的 API 密钥和任何其他配置。该文件应遵循以下结构：

   ```json
   {
     "api_key": "your-global-api-key",
     "model_priority": ["gemini_cli", "iflow", "openai_chat", "qwen", "claude"],
     "fallback_models": {
       "gpt-4": "gemini-2.5-pro"
     },
     "gemini_cli": [
       {
         "projects": ["project-id-1"],
         "auth": {
           "access_token": "",
           "scope": "",
           "token_type": "",
           "expiry_date": 0,
           "refresh_token": ""
         },
         "models": ["gemini-2.5-pro"]
       }
     ],
     "gemini": [
       {
         "base_url": "https://generativelanguage.googleapis.com",
         "api_key": "your-gemini-api-key",
         "models": ["gemini-2.5-pro"]
       }
     ],
     "openai_chat": [
       {
         "base_url": "https://api.openai.com/v1",
         "api_key": "your-openai-api-key",
         "models": ["gpt-4", "gpt-4o"]
       }
     ],
     "openai_responses": [
       {
         "base_url": "https://api.openai.com/v1",
         "api_key": "your-openai-api-key",
         "models": ["o3", "o4-mini"]
       }
     ],
     "claude": [
       {
         "base_url": "https://api.anthropic.com",
         "api_key": "your-claude-api-key",
         "models": ["claude-sonnet-4-20250514"]
       }
     ],
     "qwen": [
       {
         "auth": {
           "access_token": "",
           "refresh_token": "",
           "expiry_date": 0,
           "status": "",
           "token_type": "",
           "expires_in": 0,
           "scope": "",
           "resource_url": ""
         },
         "models": ["qwen-max"]
       }
     ],
     "iflow": [
       {
         "auth": {
           "access_token": "",
           "token_type": "",
           "refresh_token": "",
           "expires_in": 0,
           "scope": "",
           "expiry_date": 0,
           "userId": "",
           "userName": "",
           "avatar": "",
           "email": null,
           "phone": "",
           "apiKey": "",
           "cookie": null
         },
         "models": ["model-name"]
       }
     ],
     "codex": [
       {
         "auth": {
           "id_token": "",
           "access_token": "",
           "refresh_token": "",
           "account_id": "",
           "email": "",
           "plan_type": "",
           "expiry_date": 0
         },
         "models": ["o3"]
       }
     ]
   }
   ```

### 认证

配置了全局 `api_key` 后，所有 `/v1/*` 和 `/v1beta/*` 请求都会校验以下任一请求头：

- `Authorization: Bearer <api_key>`
- `x-api-key: <api_key>`
- `x-goog-api-key: <api_key>`

如果未配置全局 `api_key`，则不会拦截请求。

### 运行服务器

```bash
deno task dev
```

或生产环境：

```bash
deno task serve
```

服务器将在 `http://localhost:3000` 上运行。

## API 端点

代理服务器公开了与各种 LLM 提供商的 API 格式相对应的多个端点。

### OpenAI 兼容端点

- `POST /v1/chat/completions` — Chat Completions API
- `POST /v1/responses` — Responses API
- `GET /v1/models` — 列出所有可用模型

**示例请求:**

```bash
curl --request POST \
  --url http://localhost:3000/v1/chat/completions \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "gemini-2.5-pro",
    "temperature": 0,
    "messages": [
        {
            "role": "user",
            "content": "你是什么大模型？"
        }
    ],
    "stream": true
  }'
```

### Google Gemini 兼容端点

- `POST /v1beta/models/:modelName`

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

- `POST /v1/messages`

**示例请求:**

```bash
curl --request POST \
  --url http://localhost:3000/v1/messages \
  --header 'Content-Type: application/json' \
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
    "temperature": 0
  }'
```

## 项目结构

```
src/
├── index.ts                        # 入口点，Deno 服务配置和 Cron 任务
├── server.ts                       # Hono 路由定义
├── config.ts                       # 配置加载与管理
├── types/
│   └── config.ts                   # 配置和提供商类型定义
├── middleware/
│   ├── init.ts                     # WASM 和配置初始化中间件
│   └── auth.ts                     # API Key 认证中间件（时序安全比较）
├── providers/
│   ├── _base/
│   │   ├── index.ts                # 提供商名称常量
│   │   └── interface.ts            # Provider 通用接口定义
│   ├── factory.ts                  # 提供商工厂，模型路由与实例缓存
│   ├── openai_chat/                # OpenAI Chat Completions 提供商
│   │   ├── index.ts
│   │   └── adapter.ts
│   ├── openai_responses/           # OpenAI Responses API 提供商
│   │   ├── index.ts
│   │   └── adapter.ts
│   ├── gemini/                     # Google Gemini API 提供商
│   │   ├── index.ts
│   │   └── adapter.ts
│   ├── gemini_cli/                 # Gemini CLI (OAuth) 提供商
│   │   ├── index.ts
│   │   ├── adapter.ts
│   │   └── auth.ts
│   ├── claude/                     # Anthropic Claude 提供商
│   │   ├── index.ts
│   │   └── adapter.ts
│   ├── qwen/                       # Qwen 提供商
│   │   ├── index.ts
│   │   ├── adapter.ts
│   │   └── auth.ts
│   ├── iflow/                      # iFlow 提供商
│   │   ├── index.ts
│   │   ├── adapter.ts
│   │   └── auth.ts
│   └── codex/                      # Codex (ChatGPT OAuth) 提供商
│       ├── index.ts
│       ├── adapter.ts
│       └── auth.ts
├── utils/
│   ├── routeHandlers.ts            # 请求处理与重试逻辑
│   ├── retryStrategy.ts            # 重试策略工具函数
│   ├── logger.ts                   # 日志系统与请求日志记录
│   └── fetch.ts                    # (已弃用)
├── streaming/
│   └── sse.ts                      # SSE 流式响应转换
├── services/
│   ├── credentials.ts              # Deno KV 凭据存取
│   ├── models.ts                   # 模型列表服务
│   ├── polling.ts                  # 配置轮询器
│   └── tokenRefresher.ts           # 令牌刷新调度器
└── pkg/
    ├── converter_wasm.js           # WASM 转换模块 JS 绑定
    └── converter_wasm_bg.wasm      # Rust 编译的 WASM 转换模块
```

## 转换实现原理

LLM Proxy 的核心价值在于其强大的协议转换能力。其基本原理是：**以 OpenAI 的 API
格式作为统一的中间表示层**。所有来自不同厂商的请求都会先被适配器转换为 OpenAI
格式，再转发给相应的 LLM 提供商。响应也会被转换回原始请求所期望的格式。

这种策略带来的优势：

- **简化适配**: 只需为每个 LLM 提供商编写两个转换器（A -> OpenAI 和 OpenAI ->
  A），大大减少适配器数量。
- **高度兼容**: OpenAI API 已成为行业事实标准，LLM Proxy 能无缝兼容现有应用。
- **未来可扩展**: 添加新的 LLM 提供商时，只需实现其与 OpenAI
  格式之间的转换逻辑即可。

所有请求和响应负载转换通过 **Rust 编写并编译为 WebAssembly (WASM)**
的模块来高效完成，确保在高并发流式请求下也能保持高性能。

## 核心实现逻辑

### 1. 服务器初始化

- 入口点 `src/index.ts` 配置 Deno 服务，导出 Hono 应用。
- `src/server.ts` 定义所有 API 路由，配置 CORS、静态文件服务和认证中间件。
- `src/middleware/init.ts` 确保 WASM 模块和配置在首次请求时完成初始化。

### 2. 请求处理流程

所有模型相关的请求都由 `src/utils/routeHandlers.ts` 中的 `handleModelRequest`
统一处理：

1. **解析请求** — 从请求体中提取模型名称、是否流式等信息。
2. **提供商选择** — `src/providers/factory.ts` 中的 `getProvider`
   根据模型名称查找可用提供商，按 `model_priority` 配置选择优先级最高的。
3. **请求转换** — 通过提供商的 `convertRequestTo` 方法和 WASM
   模块将请求转换为目标格式。
4. **API 调用** — `fetchResponse` 方法将转换后的请求发送到 LLM 提供商。
5. **重试与回退**
   — 如果请求失败，自动切换同一提供商的不同配置或不同提供商重试。支持通过
   `fallback_models` 配置模型级别的回退。
6. **响应转换**
   — 流式响应通过 SSE 实时转换；非流式响应一次性转换后返回。

### 3. 凭据和配置管理

- **Deno KV**: `src/services/credentials.ts` 使用 Deno KV
  数据库存储和管理敏感凭据。
- **自动令牌刷新**: `src/index.ts` 中的 Deno Cron
  作业每 6 小时自动刷新 iFlow 和 Qwen 的身份验证令牌。
- **配置加载**: 启动时从 `config.json` 文件或 Deno KV
  加载配置。配置更新时通过 `invalidateModelMap()`
  自动清除内部路由缓存。

## 请求转换能力

WASM 模块提供了以下请求转换：

| 源格式 | 目标格式 | 支持内容 |
|--------|---------|---------|
| Gemini | OpenAI | 文本、图片（多模态）、函数调用 |
| Claude | OpenAI | 文本、函数调用 |
| Qwen | OpenAI | 文本、图片（多模态） |
| OpenAI Responses | OpenAI | 文本 |

## 响应转换能力

| 源格式 | 目标格式 | 支持内容 |
|--------|---------|---------|
| OpenAI | Gemini | 文本、函数调用 |
| OpenAI | Claude | 文本、函数调用 |
| OpenAI | Qwen | 文本 |

## 日志系统

项目内置了分级日志系统（`src/utils/logger.ts`）：

- 日志级别：`ERROR`、`WARN`、`INFO`、`DEBUG`
- 通过环境变量 `LOG_LEVEL` 控制（默认 `info`）
- `DEBUG` 级别下自动将请求体、SSE 数据、原始响应写入 `logs/` 目录
- 自动检测只读文件系统，禁用文件日志
