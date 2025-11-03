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
*   **配置**: 通过 `config.json` 文件或环境变量进行简单的配置。

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
      "openai": {
        "apiKey": "sk-..."
      },
      "gemini": {
        "apiKey": "..."
      },
      "gemini_cli": {
        "auth": false
      },
      "claude": {
        "apiKey": "sk-ant-..."
      },
      "qwen": {
        "apiKey": "sk-..."
      }
    }
    ```
    * `gemini_cli.auth`: 如果设置为 `true`，代理将尝试使用 `gcloud` CLI 工具进行身份验证。

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
curl -X POST http://localhost:3000/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{
       "model": "gemini-1.5-pro-latest",
       "messages": [{"role": "user", "content": "你好！"}],
       "stream": false
     }'
```

### Google Gemini 兼容端点

*   `POST /v1beta/models/:modelName`

此端点模仿 Gemini API。

**示例请求:**
```bash
curl -X POST http://localhost:3000/v1beta/models/gemini-1.5-pro-latest:generateContent \
     -H "Content-Type: application/json" \
     -d '{
       "contents": [{"parts":[{"text":"你好！"}]}]
     }'
```

### Anthropic Claude 兼容端点

*   `POST /v1/messages`

此端点与 Claude 的 `messages` API 兼容。

**示例请求:**
```bash
curl -X POST http://localhost:3000/v1/messages \
     -H "Content-Type: application/json" \
     -d '{
       "model": "claude-3-opus-20240229",
       "max_tokens": 1024,
       "messages": [{"role": "user", "content": "你好！"}],
       "stream": false
     }'
```

## 项目结构

```
llm-proxy/
├── src/
│   ├── providers/
│   │   ├── _base/      # 基础提供商接口和模型映射
│   │   ├── claude/     # Claude 提供商实现
│   │   ├── gemini/     # Gemini 提供商实现
│   │   ├── openai/     # OpenAI 提供商实现
│   │   ├── qwen/       # Qwen 提供商实现
│   │   └── factory.ts  # 基于模型名称实例化提供商
│   ├── services/       # 用于凭据管理等服务的服务
│   ├── config.ts       # 配置加载
│   └── server.ts       # Hono 服务器和路由
├── package.json        # 项目依赖和脚本
└── tsconfig.json       # TypeScript 配置
```

## 主要依赖

*   [Hono](https://hono.dev/): 用于构建 Web 应用程序的快速、轻量级的 Web 框架。
*   [@upstash/redis](https://github.com/upstash/upstash-redis): 用于与 Upstash Redis 交互。
*   [google-auth-library](https://github.com/googleapis/google-auth-library-nodejs): 用于 Google API 的身份验证。
