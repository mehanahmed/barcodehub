"use server";

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  // No SVG: it can carry scripts that run on our origin when the file is opened.
]);

/**
 * Validates actual binary image headers (magic bytes) to prevent disguised files.
 */
function detectImageExtension(buffer: Buffer): string | null {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpg";
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return "webp";
  }
  if (buffer.length >= 6 && (buffer.toString("ascii", 0, 6) === "GIF87a" || buffer.toString("ascii", 0, 6) === "GIF89a")) {
    return "gif";
  }
  return null;
}

export async function uploadFile(formData: FormData) {
  const file = formData.get("file") as File;
  if (!file || file.size === 0) {
    return { error: "No file selected" };
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return { error: "File exceeds maximum size limit of 10MB" };
  }

  // Validate declared MIME type
  const mimeType = (file.type || "").toLowerCase().trim();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return { error: "Invalid file type. Only PNG, JPEG, WebP, and GIF images are allowed." };
  }

  // Convert File to Buffer
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Validate actual binary content matches image magic bytes
  const detectedExt = detectImageExtension(buffer);
  if (!detectedExt) {
    return { error: "File content does not match a valid image format." };
  }

  // Ensure uploads directory is strictly inside project root
  const uploadsDir = path.resolve(process.cwd(), "public/uploads");
  await mkdir(uploadsDir, { recursive: true });

  // Generate safe server-side filename with UUID
  const safeFilename = `${Date.now()}-${crypto.randomUUID().slice(0, 12)}.${detectedExt}`;
  const filePath = path.resolve(uploadsDir, safeFilename);

  // Guard against path traversal: ensure target is strictly inside uploads directory
  if (!filePath.startsWith(uploadsDir + path.sep)) {
    return { error: "Invalid file destination" };
  }

  await writeFile(filePath, buffer);

  return { success: true, fileName: safeFilename, url: `/uploads/${safeFilename}` };
}
