# BDS Bootstrap Tokens – Cloudflare Workers Example

This project shows how to:
- Use **Bootstrap 5** for layout and components (compiled from SCSS)
- Put all brand styling in a single **`src/styles/bootstrap.scss`** entrypoint
- Let a **Cloudflare Worker** inject `<head>`, `<body>`, and a shared navbar
  around HTML component fragments.

## Structure

- `wrangler.jsonc` – Cloudflare Workers config.
- `src/index.ts` – Module Worker that wraps fragments with the full HTML shell (head + body) but does NOT inject any navbar or layout container.
- `src/styles/bootstrap.scss` – Bootstrap entrypoint with brand token defaults and overrides you can tweak before compiling to CSS.
- `public/components/*.html` – Content-only HTML fragments (no `<html>`, `<head>`, `<body>`):
  - `index.html`
  - `slide-typography.html`
  - `email-campaign.html`

## How it works

- When you hit `/`, `/slide-typography`, or `/email-campaign`:
  - The Worker reads the matching fragment from `public/components/`.
  - It wraps that fragment in a shared layout (doctype, head with compiled `bootstrap.css`,
    navbar, `<main class="container my-5">...</main>`).
- Requests for anything else are served directly from the `public/` directory via the `ASSETS` binding.

## Usage

```bash
# Install wrangler if needed
npm install -g wrangler

# Install dependencies and build Bootstrap from SCSS
npm install
npm run build:css

# Preview locally
wrangler dev

# Deploy to Cloudflare Workers
wrangler publish
```

To add a new page:

1. Create a new fragment in `public/components/your-page.html`
   containing only the main content (no `<html>`, `<head>`, `<body>`).
2. Redeploy with `wrangler publish`.

The index page automatically lists every component fragment it discovers in
`public/components/`, so new pages show up as soon as they are deployed.

To rebrand everything:

- Edit the token values in `src/styles/bootstrap.scss`, then re-run `npm run build:css`.
- All pages and layouts will inherit the new styling automatically.

Note:
- The Worker shell does not include any navbar or `.container` wrappers.
- Each component fragment in `public/components/` is responsible for its own
  Bootstrap structure (e.g. `container`, `row`, `col-*`, navbars if needed).
