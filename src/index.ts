// src/index.ts
// ESM Worker that wraps HTML fragments under /public/components/*.html
// and serves other static files via the ASSETS binding.
// - Uses a lightweight index file (public/components/_index.json) to list components.
// - Adds security headers.
// - No external deps.

type Env = {
  ASSETS: Fetcher; // bound to /public
};

type ComponentMeta = {
  slug: string;
  path: string;
  title: string;
  file: string; // /components/<slug>.html
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = normalizePath(url.pathname);

      // Serve “wrapped” component pages (/, /email-campaign, etc.)
      if (!hasFileExtension(path)) {
        const slug = path === "/" ? "index" : path.slice(1);
        const components = await discoverComponents(env, request);
        const maybe = components.find((c) => c.slug === slug) ?? toMeta(slug);
        const response = await serveComponent({ route: maybe, env, request, components });
        if (response) return withSecurityHeaders(response);
      }

      // Otherwise hand off to static assets (CSS, images, raw fragments, etc.)
      const asset = await env.ASSETS.fetch(request);
      return withSecurityHeaders(asset);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal error";
      console.error("[unhandled error]", err);
      return withSecurityHeaders(
        new Response(`Internal Error\n\n${message}`, {
          status: 500,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        }),
      );
    }
  },
};

// ---------- routing & rendering ----------

function normalizePath(p: string): string {
  if (p.endsWith("/") && p !== "/") return p.slice(0, -1);
  return p;
}

function hasFileExtension(path: string): boolean {
  return /\.[a-zA-Z0-9]+$/.test(path);
}

function slugToTitle(slug: string): string {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toMeta(slug: string): ComponentMeta {
  return {
    slug,
    path: slug === "index" ? "/" : `/${slug}`,
    title: slug === "index" ? "BDS Bootstrap Tokens – Overview" : slugToTitle(slug),
    file: `/components/${slug}.html`,
  };
}

async function discoverComponents(env: Env, request: Request): Promise<ComponentMeta[]> {
  // Modern `assets` binding does NOT provide __STATIC_CONTENT_MANIFEST.
  // We use an optional JSON list at /components/_index.json
  try {
    const url = new URL("/components/_index.json", request.url);
    const res = await env.ASSETS.fetch(new Request(url, { method: "GET" }));
    if (res.ok) {
      const slugs: string[] = await res.json();
      return slugs.map(toMeta).sort((a, b) => a.title.localeCompare(b.title));
    }
  } catch (e) {
    // If _index.json is missing or invalid, we just fall through.
    console.warn("No /components/_index.json or failed to parse; homepage list may be empty.");
  }
  // No index available: return just "index" so the homepage still renders.
  return [toMeta("index")];
}

function renderHtml({ title, body }: { title: string; body: string }): string {
  // Note: allow Bootstrap CDN (CSS/JS) and our own assets in CSP (set in headers).
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <link
    href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
    rel="stylesheet"
    integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH"
    crossorigin="anonymous"
  />
  <link rel="stylesheet" href="/brand-tokens.css" />
</head>
<body class="container my-4">
${body}

  <script
    src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"
    integrity="sha384-pprn3073KE6tl6bjs2QrFaJGz5/SUsLqktiwsUTF55Jfv3qYSDhgCecCxMW52nD2"
    crossorigin="anonymous"
  ></script>
</body>
</html>`;
}

function renderComponentList(components: ComponentMeta[]): string {
  const list = components
    .filter((c) => c.slug !== "index")
    .sort((a, b) => a.title.localeCompare(b.title))
    .map(
      (c) => `
<li class="list-group-item d-flex align-items-center justify-content-between">
  <div>
    <div class="fw-semibold">${c.title}</div>
    <div class="text-muted small">${c.path}</div>
  </div>
  <a class="btn btn-sm btn-outline-primary" href="${c.path}">View</a>
</li>`,
    )
    .join("");

  if (!list) {
    return `<div class="alert alert-info" role="status">
      No components listed. Add slugs to <code>/components/_index.json</code>.
    </div>`;
  }

  return `<div class="card"><div class="card-body">
    <ul class="list-group list-group-flush">${list}</ul>
  </div></div>`;
}

function injectComponentList(fragment: string, listHtml: string): string {
  const marker = "<!-- COMPONENT_LIST -->";
  return fragment.includes(marker) ? fragment.replace(marker, listHtml) : `${fragment}\n${listHtml}`;
}

async function serveComponent(opts: {
  route: ComponentMeta;
  env: Env;
  request: Request;
  components: ComponentMeta[];
}): Promise<Response | null> {
  const { route, env, request, components } = opts;

  // Resolve the component fragment from static assets
  const fileUrl = new URL(route.file, request.url);
  const fragmentRes = await env.ASSETS.fetch(new Request(fileUrl, { method: "GET" }));

  if (!fragmentRes.ok) {
    return new Response(
      `Component not found. Unable to load ${route.file}.\n` +
        `Make sure it exists at public${route.file} and re-deploy.`,
      { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  let fragment = await fragmentRes.text();

  if (route.slug === "index") {
    fragment = injectComponentList(fragment, renderComponentList(components));
  }

  const html = renderHtml({ title: route.title, body: fragment });
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

// ---------- security headers ----------

function withSecurityHeaders(res: Response): Response {
  const csp =
    [
      "default-src 'self'",
      "script-src 'self' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      "img-src 'self' https: data:",
      "font-src 'self' https://cdn.jsdelivr.net",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

  const headers = new Headers(res.headers);
  headers.set("Content-Security-Policy", csp);
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  headers.set("Strict-Transport-Security", "max-age=15552000; includeSubDomains; preload");

  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
