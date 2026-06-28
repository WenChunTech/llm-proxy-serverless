# LLM Proxy

[English](./README.md)

LLM Proxy 是一个面向多模型接入场景的统一代理服务。它提供 OpenAI Chat、OpenAI
Responses、Anthropic Claude 和 Google Gemini
兼容接口，帮助你用一个统一入口接入多个模型提供方。

当前代码已经支持以下 provider：

- `gemini_cli`
- `gemini`
- `openai_chat`
- `openai_responses`
- `claude`
- `qwen`
- `iflow`
- `codex`

服务内置模型到 provider 的动态路由、跨配置重试、Gemini CLI 多项目轮询、fallback
model、全局 API Key 校验，以及可直接在浏览器里维护配置的设置页。

## 适合什么场景

- 你希望客户端只对接一套接口，但后端模型来源很多。
- 你需要把 Gemini、Claude、OpenAI 风格接口统一为一个入口。
- 你需要按模型名动态切换 provider，而不是让客户端写死上游地址。
- 你需要在 provider 故障、限流或模型下线时自动重试和回退。
- 你希望直接在网页里维护 provider、优先级和 fallback，而不是每次都手改 JSON。

## 核心能力

- 统一入口：同一个服务同时暴露 OpenAI、Gemini、Claude 兼容端点。
- 协议转换：请求和响应会在 provider 适配层与 WASM 转换层之间完成格式互转。
- 流式响应：完整支持 SSE，能把不同 provider 的流式输出转换成目标协议。
- 动态路由：根据 `model` 自动匹配已配置 provider，并按照 `model_priority` 排序。
- 重试策略：支持跨 provider、跨配置、Gemini CLI 跨项目的顺序重试。
- 模型回退：`fallback_models` 可定义模型失败后的回退链，并检测循环引用。
- 在线配置：`/settings.html` 可管理 provider、模型优先级、fallback 和全局 API
  Key。
- 共享存储：Cloudflare Worker 与 Vercel 指向同一组 Vercel Redis/KV
  REST URL/token 时，会共用 Redis 中的 `APP_CONFIG`。
- 定时维护：通过 Cloudflare Workers Cron Triggers 定期刷新 OAuth token。

## 支持的兼容端点

### OpenAI 兼容

- `POST /v1/chat/completions`
- `POST /v1/responses`
- `GET /v1/models`

### Anthropic Claude 兼容

- `POST /v1/messages`

### Google Gemini 兼容

- `POST /v1beta/models/:modelName`

Gemini 端点通过路径后缀区分调用类型：

- `:generateContent`
- `:streamGenerateContent?alt=sse`

例如：

```text
/v1beta/models/gemini-2.5-pro:generateContent
/v1beta/models/gemini-2.5-pro:streamGenerateContent?alt=sse
```

### 设置页接口

- `GET /api/settings/verify`
- `GET /api/settings`
- `POST /api/settings`
- `POST /api/settings/provider/add`
- `POST /api/settings/provider/models`
- `POST /api/settings/provider/test`
- `POST /api/settings/provider/remove`
- `POST /api/settings/model-priority`
- `POST /api/settings/fallback-model`

## 配置方式

服务启动时会按下面的优先级读取配置：

1. 共享 Vercel Redis/KV 中的 `APP_CONFIG`
2. 仅本地、非 Cloudflare/Vercel 运行时的根目录 `config.json`
3. 只读启动配置绑定 `APP_CONFIG_JSON` 或 `APP_CONFIG`
4. 内置空配置

Cloudflare Worker 与 Vercel 需要配置同一组 Vercel Redis/KV REST URL/token。
只要存在 Redis 凭据，运行时和设置页保存都会优先写入 Redis。代码只使用 `.env` 中的 Vercel 变量 `KV_REST_API_URL` 和
`KV_REST_API_TOKEN` 作为 Cloudflare 与 Vercel 的同一套 Redis 配置。

### 配置示例

```json
{
  "api_key": "your-global-api-key",
  "model_priority": [
    "gemini_cli",
    "iflow",
    "openai_chat",
    "openai_responses",
    "qwen",
    "claude",
    "gemini",
    "codex"
  ],
  "fallback_models": {
    "gpt-4": "gemini-2.5-pro"
  },
  "gemini_cli": [
    {
      "projects": ["your-gcp-project"],
      "enabled": true,
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
      "enabled": false,
      "models": ["gpt-4o", "gpt-4.1"]
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
      "models": ["gpt-5.4"]
    }
  ]
}
```

### 字段说明

- `api_key`：服务自己的全局认证密钥，用来保护代理接口和设置页接口。
- `model_priority`：provider 优先级排序，不写时会使用内置默认顺序。
- `fallback_models`：模型失败后的回退映射，例如 `gpt-4 -> gemini-2.5-pro`。
- 各 provider 数组：支持配置多组凭证或多套上游地址，同一模型会按顺序尝试。
- `enabled`：provider 配置级别的开关，可选，默认 `true`。设为 `false`
  后会在运行时临时禁用该配置，无需删除。
- `gemini_cli.projects`：同一份 Gemini CLI OAuth 凭证可绑定多个 GCP
  项目，服务会逐个轮询。

## 认证行为

如果配置了全局 `api_key`，所有 `/v1/*` 和 `/v1beta/*`
请求都会校验以下任一请求头：

- `Authorization: Bearer <api_key>`
- `x-api-key: <api_key>`
- `x-goog-api-key: <api_key>`

设置页接口在有全局 `api_key` 时也会复用同一套校验逻辑。

如果没有配置全局 `api_key`，则不会拦截这些请求。

## 设置页能做什么

首页地址：

- `/`
- `/settings.html`

设置页不是只读页面，目前已经支持：

- 验证全局 API Key 后进入管理界面
- 修改全局 API Key
- 新增、编辑、删除 provider 配置
- 测试 provider 配置并展示原始流式或非流式响应，也可复制同等测试的 `curl` 命令
- 对部分 provider 根据 `base_url` 调用 `/models` 拉取模型列表
- 拖拽调整 `model_priority`
- 增删 `fallback_models`
- 下载当前配置为 JSON
- 中英文切换
- 深浅色切换

其中“从 provider 拉取模型”当前适用于这些配置类型：

- `openai_chat`
- `openai_responses`
- `claude`
- `gemini`

## 运行方式

### 本地开发

```bash
bun install
bun run dev
```

### 普通启动

```bash
bun run start
```

默认监听：

```text
http://localhost:3000
```

### Cloudflare Worker 部署

`wrangler.toml` 使用 `src/worker.ts` 作为入口，绑定 `public/` 静态资源，
打包 `pkg/converter_wasm_bg.wasm`，并配置每日定时刷新任务。这里需要把
Vercel Redis/KV 的同一组值复制到 Cloudflare Worker secrets。

```bash
bun install
bunx wrangler secret put KV_REST_API_URL
bunx wrangler secret put KV_REST_API_TOKEN
bun run deploy:dry-run
bun run deploy
```

### Vercel 部署

使用 Vercel Redis/KV 集成创建的变量。代码优先读取 `KV_REST_API_URL` 和
`KV_REST_API_TOKEN`。

```bash
vercel env add KV_REST_API_URL production
vercel env add KV_REST_API_TOKEN production
bun run build
```

`APP_CONFIG`/`APP_CONFIG_JSON` 仍可作为只读启动配置；一旦配置 Redis 凭据，
Vercel Redis/KV 就是 Cloudflare 和 Vercel 的配置来源。

## 快速调用示例

### OpenAI Chat

```bash
curl --request POST \
  --url http://localhost:3000/v1/chat/completions \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "gpt-5.5",
    "stream": true,
    "messages": [
      {
        "role": "user",
        "content": "你是什么模型？"
      }
    ]
  }'
```

### OpenAI Responses

```bash
curl --request POST \
  --url http://localhost:3000/v1/responses \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "gpt-5.5",
    "stream": true,
    "input": "请简述这个服务的作用"
  }'
```

### Gemini

```bash
curl --request POST \
  --url 'http://localhost:3000/v1beta/models/gemini-2.5-pro:streamGenerateContent?alt=sse' \
  --header 'Content-Type: application/json' \
  --data '{
    "contents": [
      {
        "parts": [
          {
            "text": "你是什么模型？"
          }
        ]
      }
    ]
  }'
```

### Claude

```bash
curl --request POST \
  --url http://localhost:3000/v1/messages \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "claude-opus-4-8",
    "max_tokens": 512,
    "stream": true,
    "messages": [
      {
        "role": "user",
        "content": "你是什么模型？"
      }
    ]
  }'
```

## OAuth 辅助脚本

仓库内提供了几个辅助脚本，用于在本地获取第三方认证信息：

- `node cmd/gemini_cli.js`
- `node cmd/qwen_code.js`
- `node cmd/iflow.js`
- `node cmd/codex.js`

这些脚本的职责是帮助你拿到本地可用的 OAuth 凭证文件。拿到凭证后，可以手动写入
`config.json`，也可以通过 `/settings.html` 填入对应 provider 配置。

## 实现说明

这一部分主要用于帮助你了解项目内部结构和请求处理方式。

### 请求处理流程

请求进入服务后，大致按下面的顺序处理：

1. 路由层根据端点类型识别目标协议。
2. 从请求体或 Gemini 路径参数中解析 `model` 和是否流式。
3. 根据 `model` 查出所有可用 provider，并按 `model_priority` 排序。
4. 适配层把当前请求转换成目标 provider 需要的协议格式。
5. 请求执行器按顺序尝试 provider。
6. 如果 provider 有多份配置，则按配置顺序继续尝试。
7. 如果是 `gemini_cli`，还会继续轮询该配置下的多个 `projects`。
8. 如果当前模型全部失败，会继续尝试 `fallback_models` 定义的下一个模型。
9. 如果上游响应协议与客户端请求协议不同，则在返回前再次完成响应转换。

当前重试逻辑的几个关键点：

- `4xx` 响应会直接切到下一个 provider。
- 网络错误或非 `4xx` 响应会继续尝试同 provider 的下一份配置，或 Gemini CLI
  的下一个项目。
- 最大总尝试次数由 `MAX_RETRIES` 控制，当前值为 `15`。

### 关键目录

```text
src/
  index.ts                  Bun 本地服务入口
  worker.ts                 Cloudflare Worker 入口与定时任务
  server.ts                 Hono 路由与静态资源
  config.ts                 配置加载、保存与 poller 初始化
  middleware/               初始化与鉴权中间件
  services/                 请求执行、模型列表、凭证存储
  providers/                各 provider 实现与注册表
  utils/                    路由处理、日志、设置页后端、重试策略
public/
  index.html                首页
  settings.html             设置页
pkg/
  converter_wasm.js         Rust 编译出的协议转换层
  converter_wasm_bg.wasm    WASM 二进制
cmd/
  *.js                      第三方认证辅助脚本
```
