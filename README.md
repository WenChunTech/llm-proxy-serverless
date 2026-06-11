# LLM Proxy

[中文版本](./README.zh-CN.md)

LLM Proxy is a unified proxy service for multi-model access. It provides OpenAI
Chat, OpenAI Responses, Anthropic Claude, and Google Gemini compatible
endpoints, so you can connect multiple model providers behind a single entry
point.

The current codebase supports the following providers:

- `gemini_cli`
- `gemini`
- `openai_chat`
- `openai_responses`
- `claude`
- `qwen`
- `iflow`
- `codex`

The service includes model-to-provider routing, cross-config retries, Gemini CLI
multi-project polling, fallback models, global API key protection, and a
browser-based settings page for configuration management.

## Use Cases

- You want clients to use one API surface while the backend serves models from
  multiple providers.
- You want Gemini, Claude, and OpenAI-style APIs behind a single gateway.
- You want routing by model name instead of hardcoding upstream endpoints in
  clients.
- You want automatic retry and fallback when a provider fails, throttles, or
  takes a model offline.
- You want to manage providers, priority, and fallback rules in a web UI instead
  of editing JSON every time.

## Core Features

- Unified entry point: one service exposes OpenAI, Gemini, and Claude compatible
  endpoints.
- Protocol conversion: requests and responses are converted between provider
  adapters and the WASM conversion layer.
- Streaming support: full SSE support, including streaming conversion across
  different provider protocols.
- Dynamic routing: requests are matched to configured providers by `model` and
  ordered by `model_priority`.
- Retry strategy: sequential retry across providers, configs, and Gemini CLI
  projects.
- Model fallback: `fallback_models` defines fallback chains and prevents
  circular fallback references.
- Online settings: `/settings.html` manages providers, model priority, fallback
  models, and the global API key.
- Dual storage: configuration is loaded from `config.json` first, then from Deno
  KV `APP_CONFIG` if the file does not exist.
- Scheduled maintenance: Codex OAuth tokens are refreshed periodically with
  `Deno.cron`.

## Supported Compatible Endpoints

### OpenAI Compatible

- `POST /v1/chat/completions`
- `POST /v1/responses`
- `GET /v1/models`

### Anthropic Claude Compatible

- `POST /v1/messages`

### Google Gemini Compatible

- `POST /v1beta/models/:modelName`

Gemini endpoints use the path suffix to distinguish request types:

- `:generateContent`
- `:streamGenerateContent?alt=sse`

For example:

```text
/v1beta/models/gemini-2.5-pro:generateContent
/v1beta/models/gemini-2.5-pro:streamGenerateContent?alt=sse
```

### Settings APIs

- `GET /api/settings/verify`
- `GET /api/settings`
- `POST /api/settings`
- `POST /api/settings/provider/add`
- `POST /api/settings/provider/models`
- `POST /api/settings/provider/remove`
- `POST /api/settings/model-priority`
- `POST /api/settings/fallback-model`

## Configuration

The service loads configuration in the following order:

1. Root `config.json`
2. `APP_CONFIG` in Deno KV
3. Built-in empty config

In practice, if `config.json` exists, runtime updates and settings-page saves
will write back to that file. If it does not exist, configuration will be stored
in KV instead.

### Configuration Example

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

### Field Descriptions

- `api_key`: the proxy service's global authentication key used to protect proxy
  endpoints and settings APIs.
- `model_priority`: provider priority order. If omitted, the built-in default
  order is used.
- `fallback_models`: model fallback mappings such as `gpt-4 -> gemini-2.5-pro`.
- Provider arrays: each provider can have multiple credentials or upstream
  configs, and matching models are tried in order.
- `enabled`: optional provider-config switch. Defaults to `true`; set it to
  `false` to temporarily disable a config at runtime without deleting it.
- `gemini_cli.projects`: one Gemini CLI OAuth credential can be associated with
  multiple GCP projects, which are polled sequentially.

## Authentication

If a global `api_key` is configured, all `/v1/*` and `/v1beta/*` requests accept
any of the following headers:

- `Authorization: Bearer <api_key>`
- `x-api-key: <api_key>`
- `x-goog-api-key: <api_key>`

When a global `api_key` is configured, settings APIs use the same validation
logic.

If no global `api_key` is configured, these requests are not blocked.

## Settings Page

Available pages:

- `/`
- `/settings.html`

The settings page currently supports:

- Entering the management UI after validating the global API key
- Updating the global API key
- Adding, editing, and removing provider configs
- Loading model lists from `/models` for supported provider types based on
  `base_url`
- Reordering `model_priority` with drag and drop
- Adding and removing `fallback_models`
- Downloading the current config as JSON
- English and Chinese language switching
- Light and dark theme switching

The current model-loading feature applies to these provider types:

- `openai_chat`
- `openai_responses`
- `claude`
- `gemini`

## Running the Service

The current implementation relies on Deno APIs such as:

- `Deno.openKv()`
- `Deno.cron()`
- `deno serve`

### Local Development

```bash
deno serve \
  --allow-net \
  --allow-read \
  --allow-write \
  --allow-env \
  --unstable-kv \
  --unstable-cron \
  --watch \
  src/index.ts
```

### Normal Startup

```bash
deno serve \
  --allow-net \
  --allow-read \
  --allow-write \
  --allow-env \
  --unstable-kv \
  --unstable-cron \
  src/index.ts
```

Default address:

```text
http://localhost:3000
```

## Quick Usage Examples

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
        "content": "What model are you?"
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
    "input": "Briefly explain what this service does."
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
            "text": "What model are you?"
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
        "content": "What model are you?"
      }
    ]
  }'
```

## OAuth Helper Scripts

The repository includes helper scripts for obtaining third-party credentials
locally:

- `node cmd/gemini_cli.js`
- `node cmd/qwen_code.js`
- `node cmd/iflow.js`
- `node cmd/codex.js`

These scripts help you generate locally usable OAuth credential files. After
obtaining credentials, you can write them into `config.json` manually or fill
the corresponding provider settings in `/settings.html`.

## Implementation Notes

This section is intended for readers who want to understand the internal
structure and request handling flow.

### Request Flow

Requests are processed roughly in this order:

1. The routing layer identifies the target protocol from the endpoint.
2. `model` and streaming intent are parsed from the request body or Gemini route
   parameters.
3. All available providers for the model are collected and ordered by
   `model_priority`.
4. The adapter layer converts the request into the target provider's protocol.
5. The request executor tries providers in sequence.
6. If a provider has multiple configs, they are tried in order.
7. For `gemini_cli`, multiple `projects` under the same config are also polled
   in sequence.
8. If the current model fails entirely, the next model in `fallback_models` is
   tried.
9. If the upstream response protocol differs from the client-facing protocol,
   the response is converted before being returned.

Key retry behaviors:

- `4xx` responses switch directly to the next provider.
- Network errors and non-`4xx` responses continue to the next config, or the
  next Gemini CLI project.
- The maximum total number of attempts is controlled by `MAX_RETRIES`, currently
  `15`.

### Key Directories

```text
src/
  index.ts                  Service entry point and cron registration
  server.ts                 Hono routes and static asset serving
  config.ts                 Config loading, persistence, and poller initialization
  middleware/               Initialization and auth middleware
  services/                 Request execution, model listing, credential storage
  providers/                Provider implementations and registry
  utils/                    Route handlers, logging, settings backend, retry strategy
public/
  index.html                Home page
  settings.html             Settings page
pkg/
  converter_wasm.js         Rust-compiled protocol conversion layer
  converter_wasm_bg.wasm    WASM binary
cmd/
  *.js                      Third-party auth helper scripts
```
