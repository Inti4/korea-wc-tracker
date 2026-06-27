# korea-wc-tracker

A single-page tracker for whether South Korea would qualify for the 2026 World Cup
Round of 32 as one of the eight best third-place teams. Built to run live during the
final group-stage matches (June 26–27, 2026).

Qualifying as a best-third-place team hinged on results across many other groups at
once: a large set of possible scorelines could move Korea above or below the top-8
cut line. The tracker recomputes the full cross-group third-place table and a
Monte-Carlo qualification probability every time a score changes.

## What it does

- Live top-8 third-place tracker that re-ranks as scores come in
- Plain-English verdict (`THROUGH` / `OUT` / `still alive`) with the exact cushion
- Monte-Carlo qualification probability, with a sparkline of its trajectory
- Two scoreline models: uniform 0–4 (conservative) and strength-weighted Poisson
- Round-of-32 preview (Korea's slot meets the Group G winner)
- Auto-fetch of live scores from `worldcup26.ir`, with optional browser notifications

## Stack

Vanilla TypeScript + HTML/CSS, no framework. The app logic lives in
[`src/app.ts`](src/app.ts) and compiles to a single global `app.js` that
[`index.html`](index.html) loads with `<script src="app.js">`.

## Build

```sh
npm install
npm run build      # tsc → app.js (git-ignored; CI rebuilds it)
npm run watch      # rebuild on change
```

`app.js` is a build artifact and is **not** committed — GitHub Actions compiles it
on every push (see Deploy). Build locally only when you want to preview.

## Deploy

Pushing to `main` triggers [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml),
which runs `npm ci && npm run build` and publishes `index.html` plus the freshly built
`app.js` to GitHub Pages.

One-time setup: in the repo's **Settings → Pages → Build and deployment**, set
**Source** to **GitHub Actions**.

```sh
git push    # build + deploy then happen in CI
```
