export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const data = await response.json().catch(() => ({
    error: "The local collaboration service is unavailable.",
  }));
  if (!response.ok)
    throw new Error(data.error ?? data.message ?? "Request failed.");
  return data as T;
}
export function post<T>(path: string, body: unknown = {}) {
  if (
    [
      "/api/auth/sign-out",
      "/api/auth/delete-user",
      "/api/auth/sign-in/email",
      "/api/auth/sign-up/email",
    ].includes(path)
  )
    imageCache.clear();
  return api<T>(path, { method: "POST", body: JSON.stringify(body) });
}
export type SessionUser = { id: string; name: string; email: string };
export type Session = { user: SessionUser } | null;
const imageCache = new Map<string, Promise<string>>();
export function imageData(src: string): Promise<string> {
  if (src.startsWith("data:")) return Promise.resolve(src);
  let cached = imageCache.get(src);
  if (!cached) {
    cached = fetch(src, { credentials: "same-origin" }).then(async (r) => {
      if (!r.ok) throw new Error("Image access was denied.");
      const blob = await r.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    });
    imageCache.set(src, cached);
    if (imageCache.size > 40)
      imageCache.delete(imageCache.keys().next().value!);
    cached.catch(() => imageCache.delete(src));
  }
  return cached;
}
