import { open, stat } from "node:fs/promises";
import path from "node:path";

const formats: Record<string, { type: string; limit: number }> = {
  ".png": { type: "image/png", limit: 5 * 1024 * 1024 },
  ".jpg": { type: "image/jpeg", limit: 5 * 1024 * 1024 },
  ".jpeg": { type: "image/jpeg", limit: 5 * 1024 * 1024 },
  ".webp": { type: "image/webp", limit: 5 * 1024 * 1024 },
  ".json": { type: "application/json", limit: 2_000_000 },
};
export type CompletedDownload = {
  path: string;
  name: string;
  type: string;
  limit: number;
  size: number;
  modified: number;
  device: number;
  inode: number;
};

// Called only for a completed DownloadItem saved through Chromium's dialog.
// No directory scanning, file watchers, renderer paths or persistent records.
export async function recordDownload(
  filePath: string,
): Promise<CompletedDownload> {
  const format = formats[path.extname(filePath).toLowerCase()];
  if (!format)
    throw new Error(
      "This file was saved. Choose a PNG, JPG, WebP or JSON result to import into Ranga.",
    );
  const info = await stat(filePath).catch(() => {
    // Filesystem errors may contain the full save path. Only a public message
    // is appropriate for the toolbar.
    throw new Error(
      "The saved download is unavailable. Choose it in Ranga to preview it again.",
    );
  });
  if (!info.isFile() || info.size < 1 || info.size > format.limit)
    throw new Error(
      "This file was saved but is too large to import. Use an image under 5 MB or a recipe under 2 MB.",
    );
  return {
    path: filePath,
    name:
      path
        .basename(filePath)
        .replace(/[\p{Cc}\p{Cf}]/gu, "")
        .slice(0, 120) || "Downloaded result",
    ...format,
    size: info.size,
    modified: info.mtimeMs,
    device: info.dev,
    inode: info.ino,
  };
}

// Only the explicit toolbar Import download command calls this function.
export async function readCompletedDownload(record: CompletedDownload) {
  const file = await open(record.path, "r");
  try {
    const info = await file.stat();
    if (
      !info.isFile() ||
      info.size !== record.size ||
      info.size > record.limit ||
      info.mtimeMs !== record.modified ||
      info.dev !== record.device ||
      info.ino !== record.inode
    )
      throw new Error(
        "The downloaded file changed. Choose the file in Ranga to preview it again.",
      );
    const buffer = Buffer.alloc(record.size);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await file.read(
        buffer,
        offset,
        buffer.length - offset,
        offset,
      );
      if (!bytesRead)
        throw new Error(
          "The downloaded file could not be read completely. Choose it in Ranga to try again.",
        );
      offset += bytesRead;
    }
    const after = await file.stat();
    if (after.size !== info.size || after.mtimeMs !== info.mtimeMs)
      throw new Error(
        "The downloaded file changed while reading. Choose it in Ranga to try again.",
      );
    return {
      name: record.name,
      type: record.type,
      data: buffer.toString("base64"),
    };
  } finally {
    await file.close();
  }
}
