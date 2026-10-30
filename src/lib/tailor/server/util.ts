export const nowMs = () => Date.now();
export const toIso = (ms: number) => new Date(ms).toISOString();

export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
    .join(",")}}`;
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export const hashPayload = (value: unknown) => sha256Hex(canonical(value));

export function randomToken(bytes = 32): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...raw))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function hashSecret(secret: string): Promise<string> {
  const salt = randomToken(16);
  return `${salt}:${await sha256Hex(`${salt}:${secret}`)}`;
}
export async function verifySecret(secret: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  return (await sha256Hex(`${salt}:${secret}`)) === hash;
}
