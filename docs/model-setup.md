# 模型配置与快速测试

本文件说明如何将项目从本地 `mock` 模式切换到真实的 OpenAI-compatible 模型，并验证流式聊天接口是否可用。

1. 在项目根创建 `.env`（或复制 `.env.example`）：

```env
# 将提供者切换为真实提供者
AI_PROVIDER="openai-compatible"
AI_BASE_URL="https://api.openai.com/v1"
AI_API_KEY="<你的_API_KEY>"
AI_MODEL="gpt-4o-mini"

# 其他示例：
# 如果你使用 Azure OpenAI，请按对应 Azure 文档设置 AI_BASE_URL 和 API Key
```

2. 启动后端（仅 API）：

```bash
npm run dev -w @chatai/api
```

或同时启动前后端：

```bash
npm run dev
```

3. 使用 curl 测试流式聊天接口（SSE）：

```bash
curl -N -H "Content-Type: application/json" -X POST \
  -d '{"message":"你好，帮我介绍一下你自己"}' \
  http://localhost:4000/api/chat/stream
```

该命令会输出 `text/event-stream`（SSE）格式的流式事件。若看到 `message_delta` 事件，说明流式返回正常。

4. 常见问题排查
- 如果后端返回 500 或请求失败：检查控制台日志（运行 `npm run dev -w @chatai/api` 的终端）。
- 确认 `.env` 中 `AI_API_KEY` 非空并且 `AI_BASE_URL` 可访问。
- 如果使用公司网络/代理，请在服务器上直接用 `curl` 访问 `${AI_BASE_URL}/chat/completions` 以排除网络问题。
- 使用非 OpenAI 平台（例如 Azure）时，注意认证头与路径格式是否兼容；当前实现发送 `Authorization: Bearer`，如有差异需修改 `apps/api/src/modules/ai/ai.service.ts`。

5. 后续改进建议
- 支持多种认证方式（如 `api-key` header、query param），并在 `env` 配置中提供切换项。
- 将模型配置放入数据库或管理界面，便于在运行时切换模型与密钥。

### Google Gemini 使用说明

如果你打算使用 Google Gemini（Generative Language API），请参考示例：

1. 在 `.env` 中设置：

```env
AI_PROVIDER="gemini"
AI_BASE_URL="https://generativelanguage.googleapis.com/v1"
AI_API_KEY="<YOUR_GOOGLE_API_KEY_OR_ACCESS_TOKEN>"
AI_MODEL="text-bison-001"
```

2. 如果你的网络环境需要代理访问外部 API，请在 `.env` 中同时配置：

```env
HTTPS_PROXY="http://127.0.0.1:7890"
HTTP_PROXY="http://127.0.0.1:7890"
```

3. 当前后端会把 `AI_API_KEY`（若存在）作为查询参数 `?key=...` 发送到 `${AI_BASE_URL}/models/${AI_MODEL}:generate`。
  - 如果你使用 OAuth2 access token，请把令牌放入 `AI_API_KEY`，或告诉我需要改为 `Authorization: Bearer` 形式。
  - Gemini 的返回格式与 OpenAI 不同，后端会尝试解析常见字段并把文本分块返回以模拟流式输出。


---

如需我代为修改 `ai.service.ts` 以适配特定提供商（例如 Azure 的 `api-key` header 或自定义路径），请告诉我目标提供商和认证方式，我可以实现并演示一次完整请求流程。
