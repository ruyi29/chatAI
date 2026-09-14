import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/", async () => ({
    ok: true,
    service: "chatai-api"
  }));

  app.get("/db", async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        ok: true,
        database: "connected"
      };
    } catch (error) {
      requestLogError(reply, error);
      return reply.code(503).send({
        ok: false,
        database: "unavailable"
      });
    }
  });
}

function requestLogError(reply: { log?: { error: (error: unknown) => void } }, error: unknown) {
  reply.log?.error(error);
}

