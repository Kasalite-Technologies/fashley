// Single place that registers the offline service worker. Refuses in dev, iframes and Lovable previews.
const SW_PATH = "/sw.js";

function isRefusedContext(): boolean {
  if (!import.meta.env.PROD) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname.toLowerCase();
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  const label = host.split(".")[0] ?? "";
  const lovableHost = [".lovable.app", ".gpt-eng.com", ".gptengineer.run"].some((d) => host.endsWith(d));
  if (lovableHost && /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/.test(label)) return true;
  if (lovableHost && /^project--[a-z0-9-]+-dev$/.test(label)) return true;
  for (const d of ["lovableproject.com", "lovableproject-dev.com", "beta.lovable.dev"]) {
    if (host === d || host.endsWith(`.${d}`)) return true;
  }
  return false;
}

async function unregisterAppWorkers() {
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    regs.filter((r) => (r.active ?? r.installing ?? r.waiting)?.scriptURL.endsWith(SW_PATH)).map((r) => r.unregister()),
  );
}

export function registerPwa() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (isRefusedContext()) {
    void unregisterAppWorkers().catch(() => {});
    return;
  }
  void navigator.serviceWorker.register(SW_PATH, { scope: "/" }).catch(() => {});
}
