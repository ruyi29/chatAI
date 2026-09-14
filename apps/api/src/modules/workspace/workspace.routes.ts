import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { resolveUser } from "../../lib/identity.js";

const resourceParamsSchema = z.object({
  id: z.string().trim().min(1).max(191)
});

const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: z.string().trim().min(1).max(32).optional(),
  sortOrder: z.number().int().min(0).max(1_000_000).optional()
});

const updateGroupSchema = createGroupSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required"
  });

const createPromptSchema = z.object({
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(50_000),
  category: z.string().trim().min(1).max(80).optional()
});

const updatePromptSchema = createPromptSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required"
  });

export async function workspaceRoutes(app: FastifyInstance) {
  app.get("/groups", async (request, reply) => {
    const userId = await resolveUserId(request, reply);
    if (!userId) return;

    const groups = await prisma.conversationGroup.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });

    return { groups };
  });

  app.post("/groups", async (request, reply) => {
    const userId = await resolveUserId(request, reply);
    if (!userId) return;

    const body = createGroupSchema.safeParse(request.body);
    if (!body.success) return sendValidationError(reply, body.error.flatten());

    const group = await prisma.conversationGroup.create({
      data: {
        userId,
        name: body.data.name,
        color: body.data.color ?? "#64748b",
        sortOrder: body.data.sortOrder ?? 0
      }
    });

    return reply.code(201).send({ group });
  });

  app.patch("/groups/:id", async (request, reply) => {
    const userId = await resolveUserId(request, reply);
    if (!userId) return;

    const params = resourceParamsSchema.safeParse(request.params);
    const body = updateGroupSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendValidationError(reply, {
        params: params.success ? undefined : params.error.flatten(),
        body: body.success ? undefined : body.error.flatten()
      });
    }

    const result = await prisma.conversationGroup.updateMany({
      where: { id: params.data.id, userId },
      data: body.data
    });
    if (result.count === 0) return sendNotFound(reply, "Group");

    const group = await prisma.conversationGroup.findFirst({
      where: { id: params.data.id, userId }
    });
    return { group };
  });

  app.delete("/groups/:id", async (request, reply) => {
    const userId = await resolveUserId(request, reply);
    if (!userId) return;

    const params = resourceParamsSchema.safeParse(request.params);
    if (!params.success) return sendValidationError(reply, params.error.flatten());

    const result = await prisma.conversationGroup.deleteMany({
      where: { id: params.data.id, userId }
    });
    if (result.count === 0) return sendNotFound(reply, "Group");

    return reply.code(204).send();
  });

  app.get("/prompts", async (request, reply) => {
    const userId = await resolveUserId(request, reply);
    if (!userId) return;

    const prompts = await prisma.promptTemplate.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" }
    });

    return { prompts };
  });

  app.post("/prompts", async (request, reply) => {
    const userId = await resolveUserId(request, reply);
    if (!userId) return;

    const body = createPromptSchema.safeParse(request.body);
    if (!body.success) return sendValidationError(reply, body.error.flatten());

    const prompt = await prisma.promptTemplate.create({
      data: {
        userId,
        title: body.data.title,
        content: body.data.content,
        category: body.data.category ?? "自定义"
      }
    });

    return reply.code(201).send({ prompt });
  });

  app.patch("/prompts/:id", async (request, reply) => {
    const userId = await resolveUserId(request, reply);
    if (!userId) return;

    const params = resourceParamsSchema.safeParse(request.params);
    const body = updatePromptSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendValidationError(reply, {
        params: params.success ? undefined : params.error.flatten(),
        body: body.success ? undefined : body.error.flatten()
      });
    }

    const result = await prisma.promptTemplate.updateMany({
      where: { id: params.data.id, userId },
      data: body.data
    });
    if (result.count === 0) return sendNotFound(reply, "Prompt");

    const prompt = await prisma.promptTemplate.findFirst({
      where: { id: params.data.id, userId }
    });
    return { prompt };
  });

  app.delete("/prompts/:id", async (request, reply) => {
    const userId = await resolveUserId(request, reply);
    if (!userId) return;

    const params = resourceParamsSchema.safeParse(request.params);
    if (!params.success) return sendValidationError(reply, params.error.flatten());

    const result = await prisma.promptTemplate.deleteMany({
      where: { id: params.data.id, userId }
    });
    if (result.count === 0) return sendNotFound(reply, "Prompt");

    return reply.code(204).send();
  });
}

async function resolveUserId(request: FastifyRequest, reply: FastifyReply) {
  void reply;
  return (await resolveUser(request)).id;
}

function sendValidationError(reply: FastifyReply, error: unknown) {
  return reply.code(400).send({ error });
}

function sendNotFound(reply: FastifyReply, resource: string) {
  return reply.code(404).send({ error: `${resource} not found` });
}
