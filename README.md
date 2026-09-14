# ChatAI

ChatAI is a starter AI chat product built with Vue 3, Vite, Fastify, TypeScript, Prisma, and MySQL.

## Stack

- Web: Vue 3, Vite, Pinia, Vue Router
- API: Fastify, TypeScript
- Database: MySQL with Prisma
- AI: mock streaming by default, OpenAI-compatible streaming when configured

## Quick Start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create environment files:

   ```bash
   copy apps\api\.env.example apps\api\.env
   copy apps\web\.env.example apps\web\.env
   ```

3. Start MySQL:

   ```bash
   docker compose up -d mysql
   ```

4. Create Prisma's development shadow database:

   ```bash
   docker compose exec -T mysql mysql -uroot -pchatai_root -e "CREATE DATABASE IF NOT EXISTS chatai_shadow;"
   ```

5. Generate Prisma Client and run migrations:

   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

6. Start the app:

   ```bash
   npm run dev
   ```

The web app runs at `http://localhost:5173`, and the API runs at `http://localhost:4000`.

### LAN access

The development server listens on all interfaces. From another device on the same network, open:

`http://192.168.1.249:5173`

The browser automatically uses the host name from the page URL for API requests, so no machine-specific API URL is required. If Windows Firewall blocks access, allow inbound TCP ports `5173` and `4000` for Node.js (or add rules for those ports).

## AI Provider

The API starts with `AI_PROVIDER=mock`, so the chat interface can stream replies without a model key.

To connect an OpenAI-compatible model API, update `apps/api/.env`:

```env
AI_PROVIDER=openai-compatible
AI_BASE_URL="https://api.openai.com/v1"
AI_API_KEY="your_api_key"
AI_MODEL="gpt-4o-mini"
```
