import manifestData from '__STATIC_CONTENT_MANIFEST' assert { type: 'json' };

function toManifestArray(data) {
  if (!data) return [];
  const parsed = typeof data === 'string' ? JSON.parse(data) : data;
  return Array.isArray(parsed) ? parsed : Object.keys(parsed);
}

function buildTree(paths) {
  const root = {};
  for (const path of paths) {
    const parts = path.split('/').filter(Boolean);
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      if (!node[part]) {
        node[part] = isFile ? null : {};
      }
      if (!isFile) {
        node = node[part];
      }
    }
  }
  return root;
}

function renderList(node, basePath = '') {
  const entries = Object.keys(node).sort((a, b) => a.localeCompare(b));
  return entries
    .map((entry) => {
      const child = node[entry];
      const path = `${basePath}/${entry}`;
      if (child === null) {
        return `<li><a href="${path}">${entry}</a></li>`;
      }
      return `<li><strong>${entry}/</strong><ul>${renderList(child, path)}</ul></li>`;
    })
    .join('');
}

const manifestPaths = toManifestArray(manifestData);
const tree = buildTree(manifestPaths);

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);

    if (pathname === '/') {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Brand Design System Directory</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; padding: 2rem; }
    h1 { margin-bottom: 0.25rem; }
    p { color: #444; margin-top: 0; }
    ul { list-style: none; padding-left: 1.25rem; }
    li { margin: 0.35rem 0; }
    a { color: #0f62fe; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>Brand Design System</h1>
  <p>Browse the available folders and files.</p>
  <ul>${renderList(tree)}</ul>
</body>
</html>`;

      return new Response(html, {
        headers: { 'content-type': 'text/html; charset=UTF-8' },
      });
    }

    return env.ASSETS.fetch(request, env, ctx);
  },
};
