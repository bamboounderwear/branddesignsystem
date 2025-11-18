# Brand Design System (BDS) – Experiences Demo

Sequence: **Tokens → Elements → Blocks → Templates → Experiences**

This repo shows a minimal, HTML-first implementation of the BDS model,
starting from actual **experiences** and reverse-engineering down to tokens.

## Structure

- `tokens/` – Design tokens as CSS custom properties.
- `frameworks/` – Third-party CSS frameworks and libraries shared across layers.
- `elements/` – Reusable micro pieces (logo, headings, buttons, basic text).
- `blocks/` – Composed content blocks (hero, stats, feature, email header/footer).
- `templates/` – Six templates total:
  - 3 slide templates
  - 3 email templates
- `experiences/` – Two example experiences, each as sub-folders:
  - `slide-deck/` – 3-slide deck using the slide templates
  - `email-campaign/` – 3-email campaign using the email templates
- `assets/` – Shared logo SVG placeholder.

Each layer only uses the layer below it:
- Tokens are only CSS variables.
- Elements use tokens.
- Blocks use elements.
- Templates use blocks.
- Experiences use templates.

## Cloudflare Workers deployment

This repository is configured as a Cloudflare Workers project with static asset
binding. The `wrangler.jsonc` file binds all files in `public/` through the
`ASSETS` binding and serves them via the root `index.js` worker entry.

To develop locally or deploy:

1. Install the [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/get-started/).
2. Run `wrangler dev` to preview locally.
3. Run `wrangler deploy` to publish to Cloudflare Workers.

## Optional build idea

Right now everything is static HTML. If you want, you can later add a small
templating step (e.g. Nunjucks, Eleventy, or a simple script) that composes
the experience pages by including the template HTML partials from `templates/`.
