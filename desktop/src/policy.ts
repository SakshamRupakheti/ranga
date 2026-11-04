export const sites = ["ranga", "chatgpt", "pinterest"] as const;
export type Site = (typeof sites)[number];
export const TOOLBAR_HEIGHT = 132;
export const defaultRangaUrl = "http://127.0.0.1:3001/projects";

const toolHosts: Record<Exclude<Site, "ranga">, string[]> = {
  chatgpt: ["chatgpt.com", "openai.com"],
  pinterest: ["pinterest.com"],
};
const authHosts = new Set([
  "accounts.google.com",
  "appleid.apple.com",
  "account.apple.com",
  "login.microsoftonline.com",
  "login.live.com",
]);

function parseUrl(value: string): URL | undefined {
  try {
    const url = new URL(value);
    if (url.username || url.password) return;
    return url;
  } catch {
    return;
  }
}

export function rangaUrl(value = defaultRangaUrl): string {
  const url = parseUrl(value);
  if (
    !url ||
    !["http:", "https:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
  ) {
    throw new Error("RANGA_DESKTOP_URL must be a local http(s) Ranga address.");
  }
  return url.href;
}

export function isSite(value: unknown): value is Site {
  return typeof value === "string" && sites.includes(value as Site);
}

export function allowedNavigation(
  site: Site,
  value: string,
  localUrl: string,
): boolean {
  const url = parseUrl(value);
  if (!url) return false;
  if (site === "ranga") return url.origin === new URL(localUrl).origin;
  if (url.protocol !== "https:" || url.port) return false;
  return (
    toolHosts[site].some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    ) || authHosts.has(url.hostname)
  );
}

// Only explicit clicks in trusted Ranga chrome can invoke the system browser.
// Never pass file:, javascript:, data:, or custom protocol handlers to the OS.
export function externalUrl(
  value: string,
  localUrl?: string,
): string | undefined {
  const url = parseUrl(value);
  if (!url) return;
  if (url.protocol === "https:") return url.href;
  if (localUrl && url.origin === new URL(localUrl).origin) return url.href;
}

export function originLabel(value: string): string {
  const url = parseUrl(value);
  return url && ["http:", "https:"].includes(url.protocol)
    ? url.host
    : "Loading…";
}

export type Bounds = { x: number; y: number; width: number; height: number };
export function paneBounds(
  width: number,
  height: number,
  split: boolean,
): Bounds[] {
  const available = Math.max(0, height - TOOLBAR_HEIGHT);
  if (!split) return [{ x: 0, y: TOOLBAR_HEIGHT, width, height: available }];
  const left = Math.floor((width - 2) * 0.57);
  return [
    { x: 0, y: TOOLBAR_HEIGHT, width: left, height: available },
    {
      x: left + 2,
      y: TOOLBAR_HEIGHT,
      width: width - left - 2,
      height: available,
    },
  ];
}

export const commands = [
  "back",
  "forward",
  "reload",
  "home",
  "split",
  "external",
  "open-link",
  "dismiss",
  "help",
] as const;
export type Command = (typeof commands)[number];
export function isCommand(value: unknown): value is Command {
  return typeof value === "string" && commands.includes(value as Command);
}

export type WorkspaceState = {
  selected: Site;
  focused: Site;
  split: boolean;
  origin: string;
  loading: boolean;
  back: boolean;
  forward: boolean;
  message: string;
  hasLink: boolean;
};
