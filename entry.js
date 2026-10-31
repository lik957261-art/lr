export const manifestSchema = "lr-public-entry-v1";
export const allowedHostname = "lkf1975-lr.synology.me";
export const leaseMilliseconds = 4 * 60 * 60 * 1000;

export function destinationFromManifest(manifest, now = Date.now()) {
  const fields = ["schema", "ready", "url", "verifiedAt", "expiresAt"];
  if (!manifest || Object.keys(manifest).some(key => !fields.includes(key))
    || manifest.schema !== manifestSchema || manifest.ready !== true
    || typeof manifest.url !== "string") throw new Error("entry_unavailable");
  const verified = Date.parse(manifest.verifiedAt);
  const expires = Date.parse(manifest.expiresAt);
  if (!Number.isFinite(verified) || !Number.isFinite(expires)
    || verified > now + 300000 || expires <= now || expires <= verified
    || expires - verified > leaseMilliseconds) throw new Error("entry_expired");
  const url = new URL(manifest.url);
  const port = Number(url.port);
  if (url.protocol !== "https:" || url.hostname !== allowedHostname
    || url.username || url.password || url.pathname !== "/" || url.search || url.hash
    || url.href !== manifest.url || !Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error("entry_invalid");
  }
  return url.href;
}

export function startRedirect({ doc = document, navigate = url => location.replace(url),
  fetchManifest = fetch, now = Date.now, schedule = setTimeout, cancel = clearTimeout,
  manifestUrl = new URL("./route.json", import.meta.url) } = {}) {
  const status = doc.getElementById("status");
  const retry = doc.getElementById("retry");
  const spinner = doc.getElementById("spinner");
  let pending = false;
  let timer;
  let stopped = false;
  async function connect() {
    if (pending || stopped) return;
    cancel(timer);
    pending = true;
    retry.hidden = true;
    spinner.hidden = false;
    status.textContent = "\u6b63\u5728\u8fde\u63a5\u2026";
    const controller = new AbortController();
    const timeout = schedule(() => controller.abort(), 8000);
    try {
      const url = new URL(manifestUrl);
      url.searchParams.set("v", String(now()));
      const response = await fetchManifest(url, { cache: "no-store", credentials: "omit",
        referrerPolicy: "no-referrer", signal: controller.signal });
      if (!response.ok) throw new Error("entry_unavailable");
      const destination = destinationFromManifest(await response.json(), now());
      if (!stopped) navigate(destination);
    } catch {
      if (!stopped) {
        status.textContent = "LR \u5165\u53e3\u6682\u65f6\u65e0\u6cd5\u8fde\u63a5\uff0c\u6b63\u5728\u91cd\u8bd5\u2026";
        spinner.hidden = true;
        retry.hidden = false;
        timer = schedule(connect, 15000);
      }
    } finally {
      cancel(timeout);
      pending = false;
    }
  }
  retry.addEventListener("click", connect);
  void connect();
  return () => { stopped = true; cancel(timer); retry.removeEventListener("click", connect); };
}

if (typeof document !== "undefined") startRedirect();
