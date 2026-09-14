import type { FastifyInstance } from "fastify";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";
import { resolveUser } from "../../lib/identity.js";
import { prisma } from "../../lib/prisma.js";

const scrypt = promisify(scryptCallback);
const credentialsSchema = z.object({
  email: z.string().trim().email().max(191).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(80).optional()
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (request, reply) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "请输入有效邮箱，密码至少需要 8 位。" });
    if (await prisma.user.findUnique({ where: { email: parsed.data.email } })) {
      return reply.code(409).send({ error: "该邮箱已经注册。" });
    }
    const user = await prisma.user.create({
      data: { email: parsed.data.email, name: parsed.data.name || parsed.data.email.split("@")[0], passwordHash: await hashPassword(parsed.data.password) }
    });
    await mergeGuestWorkspace(request.headers["x-user-id"], user.id);
    return reply.code(201).send(await createSession(user));
  });

  app.post("/auth/login", async (request, reply) => {
    const parsed = credentialsSchema.omit({ name: true }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "邮箱或密码格式无效。" });
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user?.passwordHash || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return reply.code(401).send({ error: "邮箱或密码不正确。" });
    }
    await mergeGuestWorkspace(request.headers["x-user-id"], user.id);
    return createSession(user);
  });

  app.get("/auth/me", async (request) => {
    const user = await resolveUser(request);
    return { user: publicUser(user) };
  });

  app.delete("/auth/session", async (request, reply) => {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (token) await prisma.userSession.deleteMany({ where: { tokenHash: hashToken(token) } });
    return reply.code(204).send();
  });
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}
async function verifyPassword(password: string, stored: string) {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const actual = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
async function createSession(user: { id: string; name: string | null; email: string | null }) {
  const token = randomBytes(32).toString("base64url");
  await prisma.userSession.create({
    data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
  });
  return { token, user: publicUser(user) };
}
function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
function publicUser(user: { id: string; name: string | null; email: string | null }) {
  return { id: user.id, name: user.name, email: user.email };
}

async function mergeGuestWorkspace(rawGuestId: string | string[] | undefined, userId: string) {
  const guestId = (Array.isArray(rawGuestId) ? rawGuestId[0] : rawGuestId)?.trim();
  if (!guestId || guestId === userId) return;
  const guest = await prisma.user.findUnique({ where: { id: guestId }, select: { email: true } });
  if (!guest || guest.email) return;
  await prisma.$transaction([
    prisma.conversation.updateMany({ where: { userId: guestId }, data: { userId } }),
    prisma.conversationGroup.updateMany({ where: { userId: guestId }, data: { userId } }),
    prisma.promptTemplate.updateMany({ where: { userId: guestId }, data: { userId } }),
    prisma.attachment.updateMany({ where: { userId: guestId }, data: { userId } })
  ]);
}
