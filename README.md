# BDS Bootstrap Tokens – Cloudflare Workers Example

This project shows how to:
- Use **Bootstrap 5** for layout and components compiled from SCSS
- Keep all brand styling in **`src/styles/bootstrap.scss`** so overrides live next to the build
- Let a **Cloudflare Worker** inject `<head>`, `<body>`, and a shared navbar
  around HTML component fragments.

## Structure

- `wrangler.jsonc` – Cloudflare Workers config.
- `src/index.ts` – Module Worker that wraps fragments with the full HTML shell (head + body) but does NOT inject any navbar or layout container.
- `src/styles/bootstrap.scss` – Bootstrap entry point with active SCSS variable overrides mapped to brand tokens.
- `public/components/*.html` – Content-only HTML fragments (no `<html>`, `<head>`, `<body>`):
  - `index.html`
  - `slide-typography.html`
  - `email-campaign.html`

## How it works

- When you hit `/`, `/slide-typography`, or `/email-campaign`:
  - The Worker reads the matching fragment from `public/components/`.
  - It wraps that fragment in a shared layout (doctype, head with compiled Bootstrap,
    navbar, `<main class="container my-5">...</main>`).
- Requests for anything else are served directly
  from the `public/` directory via the `ASSETS` binding.

## Usage

```bash
# Install wrangler if needed
npm install -g wrangler

# Install local dependencies (Bootstrap + Sass)
npm install

# Preview locally (builds SCSS + component index)
wrangler dev

# Deploy to Cloudflare Workers
wrangler publish

# The SCSS build resolves Bootstrap from `node_modules`, so make sure
# dependencies are installed before running `npm run build` or `wrangler dev`.
```

To add a new page:

1. Create a new fragment in `public/components/your-page.html`
   containing only the main content (no `<html>`, `<head>`, `<body>`).
2. Redeploy with `wrangler publish`.

The index page automatically lists every component fragment it discovers in
`public/components/`, so new pages show up as soon as they are deployed.

To rebrand everything:

- Edit the token values and Bootstrap overrides in `src/styles/bootstrap.scss`.
- All pages and layouts will inherit the new styling automatically.
- You can expose the CSS variables block at the top of the file for
  non-SCSS consumers, but Bootstrap itself pulls directly from the SCSS overrides.

Note:
- The Worker shell does not include any navbar or `.container` wrappers.
- Each component fragment in `public/components/` is responsible for its own
  Bootstrap structure (e.g. `container`, `row`, `col-*`, navbars if needed).
