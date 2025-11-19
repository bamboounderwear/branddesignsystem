// src/worker.js
//
// Cloudflare Worker that wraps HTML fragments from /public/components
// with a shared <head> and <body>, but does NOT enforce any navbar or
// layout container. Each component controls its own layout.

let componentCache;

function discoverComponents(env) {
  if (componentCache) return componentCache;

  const manifest = readManifest(env);
  const components = Object.keys(manifest)
    .filter(
      (key) =>
        key.startsWith("components/") &&
        key.endsWith(".html") &&
        !key.includes("/."),
    )
    .map((file) => {
      const slug = file.replace(/^components\//, "").replace(/\.html$/, "");
      return {
        slug,
        path: slug === "index" ? "/" : `/${slug}`,
        title: slug === "index" ? "BDS Bootstrap Tokens – Overview" : slugToTitle(slug),
        // Always point to the canonical public path so we don't depend on
        // hashed asset names inside the manifest when serving the file.
        file: `/components/${slug}.html`,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  componentCache = components;
  return components;
}

function readManifest(env) {
  const manifestJSON = env?.__STATIC_CONTENT_MANIFEST || globalThis.__STATIC_CONTENT_MANIFEST;
  if (!manifestJSON) return {};

  try {
    return JSON.parse(manifestJSON);
  } catch (error) {
    console.warn("Failed to parse static content manifest", error);
    return {};
  }
}

function slugToTitle(slug) {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function renderHtml({ title, body }) {
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
<body>
${body}

  <script
    src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"
    integrity="sha384-pprn3073KE6tl6bjs2QrFaJGz5/SUsLqktiwsUTF55Jfv3qYSDhgCecCxMW52nD2"
    crossorigin="anonymous"
  ></script>
</body>
</html>`;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path =
      url.pathname.endsWith("/") && url.pathname !== "/"
        ? url.pathname.slice(0, -1)
        : url.pathname;

    const COMPONENTS = discoverComponents(env);

    // Route HTML pages
    const route = COMPONENTS.find(
      (component) =>
        component.path === path || (component.slug === "index" && path === "/"),
    );
    if (route) {
      const response = await serveComponent({
        route,
        request,
        env,
        components: COMPONENTS,
      });

      if (response) return response;
    }

    // Fallback: serve an index page even if the manifest is unavailable
    if (!hasFileExtension(path)) {
      const slug = path === "/" ? "index" : path.replace(/^\//, "");
      const fallbackRoute = {
        slug,
        path,
        title: slug === "index" ? "BDS Bootstrap Tokens – Overview" : slugToTitle(slug),
        file: `/components/${slug}.html`,
      };

      const response = await serveComponent({
        route: fallbackRoute,
        request,
        env,
        components: COMPONENTS,
      });

      if (response) return response;
    }

    // Everything else (CSS, images, etc.) is served directly from static assets
    return env.ASSETS.fetch(request);
  },
};

function renderComponentList(components) {
  if (!components.length) {
    return `<div class="alert alert-info" role="status">
      No components found yet. Add HTML fragments under <code>public/components/</code> to see them listed here.
    </div>`;
  }

  const links = components
    .sort((a, b) => a.title.localeCompare(b.title))
    .map(
      (component) => `
      <li class="list-group-item d-flex align-items-center justify-content-between">
        <div>
          <div class="fw-semibold">${component.title}</div>
          <div class="text-muted small">${component.path}</div>
        </div>
        <a class="btn btn-sm btn-outline-primary" href="${component.path}">View</a>
      </li>`,
    )
    .join("");

  return `
    <div class="card">
      <div class="card-body">
        <ul class="list-group list-group-flush">${links}</ul>
      </div>
    </div>`;
}

function injectComponentList(fragment, listHtml) {
  const marker = "<!-- COMPONENT_LIST -->";
  if (fragment.includes(marker)) {
    return fragment.replace(marker, listHtml);
  }
  return `${fragment}\n${listHtml}`;
}

async function serveComponent({ route, request, env, components }) {
  // Fetch the component HTML fragment from static assets
  const assetUrl = new URL(route.file, request.url);
  const assetRequest = new Request(assetUrl.toString(), request);
  const assetResponse = await env.ASSETS.fetch(assetRequest);

  if (!assetResponse.ok) {
    return new Response(
      `Component not found. Unable to load ${route.file}. Make sure it exists in public/components and rerun wrangler dev.`,
      {
        status: 404,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      },
    );
  }

  let fragment = await assetResponse.text();

  if (route.slug === "index") {
    const componentList = components.filter((component) => component.slug !== "index");
    fragment = injectComponentList(fragment, renderComponentList(componentList));
  }

  const html = renderHtml({ title: route.title, body: fragment });
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

function hasFileExtension(path) {
  return /\.[a-zA-Z0-9]+$/.test(path);
}
