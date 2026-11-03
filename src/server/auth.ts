import { betterAuth } from "better-auth";
import { db, secret, origin, dataDirectory } from "./store";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
export const auth = betterAuth({
  database: db,
  secret,
  baseURL: origin,
  trustedOrigins: [origin],
  advanced: { ipAddress: { ipAddressHeaders: ["x-ranga-client-ip"] } },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      const outbox = join(dataDirectory, "outbox");
      await mkdir(outbox, { recursive: true });
      await writeFile(
        join(outbox, `${crypto.randomUUID()}.json`),
        JSON.stringify({
          to: user.email,
          subject: "Reset your Ranga password",
          url,
          createdAt: new Date().toISOString(),
        }),
        { mode: 0o600 },
      );
    },
  },
  session: { expiresIn: 60 * 60 * 24 * 7, cookieCache: { enabled: false } },
  rateLimit: { enabled: true, window: 60, max: 40 },
  user: {
    deleteUser: {
      enabled: true,
      afterDelete: async (user) => {
        db.transaction(() => {
          db.prepare("DELETE FROM ranga_project WHERE owner_id=?").run(user.id);
          db.prepare("DELETE FROM ranga_member WHERE user_id=?").run(user.id);
          db.prepare(
            "UPDATE ranga_comment SET author_name='Deleted account',author_id='' WHERE author_id=?",
          ).run(user.id);
        })();
      },
    },
  },
});
