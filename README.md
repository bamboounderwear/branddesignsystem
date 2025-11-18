# BDS Bootstrap Tokens – Cloudflare Workers Example

This project shows how to:
- Use **Bootstrap 5** for layout and components
- Put all brand styling in **`brand-tokens.css`**
- Let a **Cloudflare Worker** inject `<head>`, `<body>`, and a shared navbar
  around HTML component fragments.

## Structure

- `wrangler.jsonc` – Cloudflare Workers config.
- `src/worker.js` – Module Worker that wraps fragments with the full HTML shell (head + body) but does NOT inject any navbar or layout container.
- `public/brand-tokens.css` – Brand tokens + Bootstrap variable mapping.
  - Non-coders only edit the `:root` BDS token values at the top.
- `public/components/*.html` – Content-only HTML fragments (no `<html>`, `<head>`, `<body>`):
  - `index.html`
  - `slide-typography.html`
  - `email-campaign.html`

## How it works

- When you hit `/`, `/slide-typography`, or `/email-campaign`:
  - The Worker reads the matching fragment from `public/components/`.
  - It wraps that fragment in a shared layout (doctype, head with Bootstrap CDN,
    `brand-tokens.css`, navbar, `<main class="container my-5">...</main>`).
- Requests for anything else (like `/brand-tokens.css`) are served directly
  from the `public/` directory via the `ASSETS` binding.

## Usage

```bash
# Install wrangler if needed
npm install -g wrangler

# Preview locally
wrangler dev

# Deploy to Cloudflare Workers
wrangler publish
```

To add a new page:

1. Create a new fragment in `public/components/your-page.html`
   containing only the main content (no `<html>`, `<head>`, `<body>`).
2. Add a route to `ROUTES` in `src/worker.js` pointing to that file.
3. Redeploy with `wrangler publish`.

To rebrand everything:

- Edit the token values in `public/brand-tokens.css` under the `/* BDS TOKENS */` section.
- All pages and layouts will inherit the new styling automatically.

Note:
- The Worker shell does not include any navbar or `.container` wrappers.
- Each component fragment in `public/components/` is responsible for its own
  Bootstrap structure (e.g. `container`, `row`, `col-*`, navbars if needed).
