import type { FastifyRequest } from "fastify";
import { prisma } from "./prisma.js";
import { createHash } from "node:crypto";

export const fallbackUserId = "local-workspace-user";

export async function resolveUser(request: FastifyRequest) {
  const authorization = request.headers.authorization;
  if (authorization?.startsWith("Bearer ")) {
    const tokenHash = createHash("sha256").update(authorization.slice(7)).digest("hex");
    const session = await prisma.userSession.findFirst({
      where: { tokenHash, expiresAt: { gt: new Date() } },
      include: { user: true }
    });
    if (session) return session.user;
  }
  const rawHeader = request.headers["x-user-id"];
  const userId = (Array.isArray(rawHeader) ? rawHeader[0] : rawHeader)?.trim() || fallbackUserId;
  const user = await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId, name: "本地用户" }
  });
  await prisma.conversation.updateMany({ where: { userId: null }, data: { userId: user.id } });
  return user;
}
