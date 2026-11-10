# Alive Maps

Walking directions that offer the fastest route and one to three slightly longer walks past parks, notable buildings, and streets with cafés.

Pick a start and an end. The map draws the direct walk and the livelier alternatives, with the extra minutes in the card, for example `+2 min, past a park and 6 cafés`.

## Stack

- React and MapLibre in `web/`, built with Vite
- A Cloudflare Worker in `src/worker.ts` for `/api/*`, with the built site served as [static assets](https://developers.cloudflare.com/workers/static-assets/)
- [Nominatim](https://nominatim.org/) for search, the [FOSSGIS](https://routing.openstreetmap.de/) walking router for geometry (the public OSRM demo's foot profile is not walking pace, so it is only a fallback), and [Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API) for parks, cafés, landmarks, and lively shops
- [OpenFreeMap](https://openfreemap.org/) vector tiles, which do not need a key

No paid API key is required for v1. The Worker caches those public responses. Please don't point a tight loop at `npm run dev` against the live demo endpoints.

## Run locally

```bash
npm install
npm run dev
```

The site is at <http://127.0.0.1:5173> and the API at <http://127.0.0.1:8787>. Vite proxies `/api` to the API.

```bash
npm test
npm run check
```

`npm run check` generates Worker types, typechecks, runs the unit tests, and builds the site.

Try the **South Bank** chip (Tate Modern to Covent Garden) if you want a walk that already has a livelier option.

## Deploy

Build the site, then deploy the Worker and the static assets together:

```bash
npm run deploy
```

That runs `vite build` and `wrangler deploy`. Creating this Worker for the first time needs a `CLOUDFLARE_API_TOKEN` with **Workers Admin** at the Workers product scope, plus `CLOUDFLARE_ACCOUNT_ID`. Later deploys of the existing Worker need **Workers Editor**. v1 stores no secrets. See [Workers roles](https://developers.cloudflare.com/workers/authorization/workers/).

There is no Cloudflare credential in this environment, so production deploy is that one command. Wrangler 4.102 or newer can also publish an unauthenticated preview with `npx wrangler deploy --temporary` after `npm run build`. That preview lasts about an hour unless the account is claimed.

## Layout

`PLAN.md` is the status source of truth for the remaining workstreams. Shared types live in `src/types.ts`.
