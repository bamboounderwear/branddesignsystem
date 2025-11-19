// src/index.ts
// Wraps /public/components/*.html into full pages and lists components.
// Uses build-generated /components/_index.json; falls back to legacy manifest if present.

type Env = { ASSETS: Fetcher };
type ComponentMeta = { slug: string; path: string; title: string; file: string };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = normalizePath(url.pathname);

      if (!hasFileExtension(path)) {
        const slug = path === "/" ? "index" : path.slice(1);
        const components = await discoverComponents(env, request);
        const route = components.find((c) => c.slug === slug) ?? toMeta(slug);
        const page = await serveComponent({ route, env, request, components });
        if (page) return withSecurityHeaders(page);
      }

      const asset = await env.ASSETS.fetch(request);
      return withSecurityHeaders(asset);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Internal error";
      console.error("[unhandled]", err);
      return withSecurityHeaders(new Response(`Internal Error\n\n${msg}`, {
        status: 500,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      }));
    }
  },
};

// -------- helpers --------

function normalizePath(p: string): string { return p.endsWith("/") && p !== "/" ? p.slice(0, -1) : p; }
function hasFileExtension(path: string): boolean { return /\.[a-zA-Z0-9]+$/.test(path); }
function slugToTitle(slug: string): string {
  return slug.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
}
function toMeta(slug: string): ComponentMeta {
  return { slug, path: slug === "index" ? "/" : `/${slug}`, title: slug === "index" ? "BDS Bootstrap Tokens – Overview" : slugToTitle(slug), file: `/components/${slug}.html` };
}

async function discoverComponents(env: Env, request: Request): Promise<ComponentMeta[]> {
  // 1) Preferred: build-generated /components/_index.json (works with assets binding)
  try {
    const url = new URL("/components/_index.json", request.url);
    const res = await env.ASSETS.fetch(new Request(url));
    if (res.ok) {
      const slugs: string[] = await res.json();
      return slugs.map(toMeta).sort((a, b) => a.title.localeCompare(b.title));
    }
  } catch { /* ignore */ }

  // 2) Fallback: legacy KV Sites manifest if Wrangler ever exposes it
  try {
    const manifestJSON =
      (globalThis as unknown as { __STATIC_CONTENT_MANIFEST?: string }).__STATIC_CONTENT_MANIFEST ??
      (env as unknown as { __STATIC_CONTENT_MANIFEST?: string }).__STATIC_CONTENT_MANIFEST;
    if (manifestJSON) {
      const manifest = JSON.parse(manifestJSON) as Record<string, string>;
      const slugs = Object.keys(manifest)
        .filter((k) => k.startsWith("components/") && k.endsWith(".html") && !k.includes("/."))
        .map((k) => k.replace(/^components\//, "").replace(/\.html$/, ""))
        .sort((a, b) => a.localeCompare(b));
      if (slugs.length) return slugs.map(toMeta);
    }
  } catch { /* ignore */ }

  // 3) Always show homepage even if list is empty
  return [toMeta("index")];
}

function renderHtml({ title, body }: { title: string; body: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"
  integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous"/>
<link rel="stylesheet" href="/brand-tokens.css"/>
</head>
<body class="container my-4">
${body}
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"
  integrity="sha384-pprn3073KE6tl6bjs2QrFaJGz5/SUsLqktiwsUTF55Jfv3qYSDhgCecCxMW52nD2" crossorigin="anonymous"></script>
</body></html>`;
}

function renderComponentList(components: ComponentMeta[]): string {
  const items = components
    .filter((c) => c.slug !== "index")
    .map(
      (c) => `<li class="list-group-item d-flex align-items-center justify-content-between">
  <div><div class="fw-semibold">${c.title}</div><div class="text-muted small">${c.path}</div></div>
  <a class="btn btn-sm btn-outline-primary" href="${c.path}">View</a>
</li>`,
    )
    .join("");

  if (!items) {
    return `<div class="alert alert-info" role="status">
      No components listed yet. Add *.html under <code>/public/components</code>.
    </div>`;
  }
  return `<div class="card"><div class="card-body"><ul class="list-group list-group-flush">${items}</ul></div></div>`;
}

function injectComponentList(fragment: string, listHtml: string): string {
  const marker = "<!-- COMPONENT_LIST -->";
  return fragment.includes(marker) ? fragment.replace(marker, listHtml) : `${fragment}\n${listHtml}`;
}

async function serveComponent(opts: {
  route: ComponentMeta; env: Env; request: Request; components: ComponentMeta[];
}): Promise<Response | null> {
  const { route, env, request, components } = opts;
  const url = new URL(route.file, request.url);
  const res = await env.ASSETS.fetch(new Request(url));
  if (!res.ok) {
    return new Response(
      `Component not found. Unable to load ${route.file}.\n` +
      `Make sure it exists at public${route.file} and re-deploy.`,
      { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  let fragment = await res.text();
  if (route.slug === "index") fragment = injectComponentList(fragment, renderComponentList(components));
  const html = renderHtml({ title: route.title, body: fragment });
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function withSecurityHeaders(res: Response): Response {
  const csp = [
    "default-src 'self'",
    "script-src 'self' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "img-src 'self' https: data:",
    "font-src 'self' https://cdn.jsdelivr.net",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join("; ");
  const h = new Headers(res.headers);
  h.set("Content-Security-Policy", csp);
  h.set("Referrer-Policy", "no-referrer");
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "DENY");
  h.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  h.set("Strict-Transport-Security", "max-age=15552000; includeSubDomains; preload");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}
