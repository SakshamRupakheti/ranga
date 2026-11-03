import Database from "better-sqlite3";
import { mkdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { randomBytes } from "node:crypto";
export const dataDirectory = resolve(
  process.env.RANGA_DATA_DIR ?? ".ranga-data",
);
mkdirSync(dataDirectory, { recursive: true });
export const origin = process.env.RANGA_ORIGIN ?? "http://127.0.0.1:3001";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname))
  throw new Error(
    "This local collaboration profile only accepts loopback origins. Configure a reviewed production profile before deployment.",
  );
const secretPath = join(dataDirectory, "session-secret");
if (!existsSync(secretPath))
  writeFileSync(secretPath, randomBytes(48).toString("base64url"), {
    mode: 0o600,
    flag: "wx",
  });
export const secret = readFileSync(secretPath, "utf8");
export const db = new Database(join(dataDirectory, "ranga.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");
db.exec(
  "CREATE TABLE IF NOT EXISTS ranga_migration (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
);
for (const migration of [
  "001-collaboration.sql",
  "002-thumbnails-comment-points.sql",
])
  if (
    !db.prepare("SELECT name FROM ranga_migration WHERE name=?").get(migration)
  ) {
    db.transaction(() => {
      db.exec(readFileSync(resolve("migrations", migration), "utf8"));
      db.prepare("INSERT INTO ranga_migration VALUES (?,?)").run(
        migration,
        new Date().toISOString(),
      );
    })();
  }
