import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import pdf from "pdf-parse/lib/pdf-parse.js";
import readXlsxFile, { readSheetNames } from "read-excel-file/node";
import { z } from "zod";
import { resolveUser } from "../../lib/identity.js";
import { prisma } from "../../lib/prisma.js";

const attachmentParams = z.object({ id: z.string().min(1).max(191) });
const uploadDirectory = path.resolve(process.cwd(), "uploads");
const supportedExtensions = new Set([".txt", ".md", ".csv", ".json", ".log", ".pdf", ".docx", ".xlsx"]);

export async function attachmentRoutes(app: FastifyInstance) {
  app.post("/attachments", async (request, reply) => {
    const user = await resolveUser(request);
    const part = await request.file();
    if (!part) return reply.code(400).send({ error: "请选择需要上传的文件。" });

    const extension = path.extname(part.filename).toLowerCase();
    if (!supportedExtensions.has(extension)) {
      return reply.code(415).send({ error: "支持 PDF、DOCX、XLSX、TXT、Markdown、CSV、JSON 和 LOG 文件。" });
    }

    const buffer = await part.toBuffer();
    if (!buffer.length) return reply.code(400).send({ error: "文件内容为空。" });
    await mkdir(uploadDirectory, { recursive: true });
    const storageName = `${randomUUID()}${extension}`;
    const storagePath = path.join(uploadDirectory, storageName);
    await writeFile(storagePath, buffer);

    try {
      const extractedText = await extractText(buffer, extension);
      const attachment = await prisma.attachment.create({
        data: {
          userId: user.id,
          name: sanitizeFilename(part.filename),
          mimeType: part.mimetype || "application/octet-stream",
          size: buffer.length,
          storagePath,
          extractedText: extractedText.slice(0, 500_000),
          status: "READY"
        }
      });
      return reply.code(201).send({ attachment: mapAttachment(attachment) });
    } catch (error) {
      await unlink(storagePath).catch(() => undefined);
      request.log.warn(error);
      return reply.code(422).send({ error: "无法解析该文件，请确认文件没有损坏或加密。" });
    }
  });

  app.delete("/attachments/:id", async (request, reply) => {
    const user = await resolveUser(request);
    const params = attachmentParams.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "附件参数无效。" });
    const attachment = await prisma.attachment.findFirst({ where: { id: params.data.id, userId: user.id, messageId: null } });
    if (!attachment) return reply.code(404).send({ error: "附件不存在或已经关联消息。" });
    await prisma.attachment.delete({ where: { id: attachment.id } });
    await unlink(attachment.storagePath).catch(() => undefined);
    return reply.code(204).send();
  });
}

async function extractText(buffer: Buffer, extension: string) {
  if ([".txt", ".md", ".csv", ".json", ".log"].includes(extension)) return buffer.toString("utf8");
  if (extension === ".pdf") return (await pdf(buffer)).text;
  if (extension === ".docx") return (await mammoth.extractRawText({ buffer })).value;
  if (extension === ".xlsx" || extension === ".xls") {
    if (extension === ".xls") throw new Error("Legacy XLS is not supported by the secure parser");
    const sheetNames = await readSheetNames(buffer);
    const sections: string[] = [];
    for (const sheet of sheetNames) {
      const rows = await readXlsxFile(buffer, { sheet });
      sections.push(`# ${sheet}\n${rows.map((row) => row.map((cell) => csvCell(cell == null ? "" : cell instanceof Date ? cell.toISOString() : String(cell))).join(",")).join("\n")}`);
    }
    return sections.join("\n\n");
  }
  return "";
}

function csvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function sanitizeFilename(filename: string) {
  return path.basename(filename).replace(/[\u0000-\u001f<>:"/\\|?*]/g, "_").slice(0, 191);
}

function mapAttachment(attachment: { id: string; name: string; mimeType: string; size: number; status: string; createdAt: Date }) {
  return {
    id: attachment.id,
    name: attachment.name,
    mimeType: attachment.mimeType,
    size: attachment.size,
    status: attachment.status,
    createdAt: attachment.createdAt.toISOString()
  };
}
