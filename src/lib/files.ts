import "server-only";
import crypto from "crypto";
import path from "path";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";

// Local disk storage. Swap for S3/Azure Blob in production by replacing these functions.
const ROOT = path.join(process.cwd(), "uploads");

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/msword": ".doc",
};

export function validateUpload(file: File): string | null {
  if (!file || file.size === 0) return "Choose a file to upload.";
  if (file.size > MAX_UPLOAD_BYTES) return "File is larger than 10 MB.";
  if (!ALLOWED[file.type]) return "Allowed file types: PDF, PNG, JPG, Excel, Word.";
  return null;
}

export async function saveUpload(organizationId: string, file: File) {
  const dir = path.join(ROOT, organizationId);
  await mkdir(dir, { recursive: true });
  const storedName = crypto.randomBytes(16).toString("hex") + ALLOWED[file.type];
  await writeFile(path.join(dir, storedName), Buffer.from(await file.arrayBuffer()));
  return storedName;
}

function safePath(organizationId: string, storedName: string) {
  if (!/^[a-f0-9]{32}\.[a-z]{3,4}$/.test(storedName) || !/^[a-z0-9]+$/i.test(organizationId)) throw new Error("Invalid file");
  return path.join(ROOT, organizationId, storedName);
}

export const readUpload = (organizationId: string, storedName: string) => readFile(safePath(organizationId, storedName));
export const deleteUpload = (organizationId: string, storedName: string) => unlink(safePath(organizationId, storedName)).catch(() => {});
