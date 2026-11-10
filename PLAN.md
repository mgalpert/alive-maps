# Alive Maps plan

This file is the status source of truth. Update your own row when you start, hand off, or finish. Do not edit another workstream's files.

Last coordinated by the lead on 2026-11-10 (Pacific Time).

## Status

| ID | Workstream | Owner | Status | Last update (PT) |
| --- | --- | --- | --- | --- |
| foundation | v1 walking app | lead | done | 2026-11-10 |
| routing | Richer detours and scoring | unassigned | ready | 2026-11-10 |
| poi | Place data and caching | unassigned | ready | 2026-11-10 |
| ui | Map and route cards | unassigned | ready | 2026-11-10 |
| deploy | Cloudflare deploy and CI | unassigned | ready | 2026-11-10 |

## How to claim a workstream

1. Set **Owner** to your agent id and **Status** to `in-progress`.
2. Set **Last update (PT)** to today's date in America/Los_Angeles.
3. Stay inside the files you own. `src/types.ts` may gain optional fields only. Record any field you add in your section. Do not rename or remove fields.
4. Set **Status** to `done` only when the definition of done below is true, and note the command you ran.
5. If you are blocked by another workstream, leave Status as `blocked`, name the blocker, and stop. Do not do their work.

Ship against the current API. Do not wait for another stream, and do not start a second app.

## What v1 already does

- `GET /api/search?q=` geocodes with Nominatim.
- `GET /api/routes?originLat&originLon&destLat&destLon` returns the fastest walk plus up to three alive alternatives.
- Alive routes are waypoint detours through parks, landmarks, and cafés that sit 50–380 m off the direct walk. Extra time is capped at about 40% of the direct walk, and always between 4 and 12 minutes. Walking time comes from the FOSSGIS foot router. A result is only accepted when the pace is between 2 and 9 km/h.
- Cards use summaries like `+2 min, past a park and 6 cafés`. The map highlights the selected walk and the named places along it.
- Preset chips: South Bank (Tate Modern → Covent Garden) and Lisbon hills.
- Unit coverage lives in `src/**/*.test.ts`. `npm test` does not call the network.

## Shared files

Anyone may read these. Treat them as a contract. Small bugfixes are fine; say so in your section. Do not reformat them.

- `src/types.ts`
- `src/config.ts`
- `src/geo.ts`
- `src/http.ts`
- `src/api/handle.ts` (thin HTTP glue for both endpoints)
- `package.json`, `tsconfig.json`, `tsconfig.node.json`

## routing

**Goal:** Make detours feel like a chosen walk rather than a single pin the router snapped to. A good alive route should be able to pass a park and then a café street, without doubling back, and the extra minutes should stay honest.

**Owns:** `src/routing/**`

**Do not edit:** `web/**`, `src/poi/**`, `src/worker.ts`, `wrangler.jsonc`

**Done when:**

- A route can visit two waypoints (a park and a café cluster, or similar) and still beat a single-pin detour in `chooseRoutes` when it adds more new places without blowing the time budget.
- Backtracking is penalized: a via-route that returns along the same streets ranks below a shorter arc with the same places.
- `npm test` covers that ranking with an in-repo fixture (no live OSRM call in the test).
- The South Bank preset, hit by hand against `npm run dev`, still returns at least one alive route whose `extraMin` is between 1 and 8 and whose `places` list is non-empty. Write the result in this section.

**Already in v1:** one waypoint per candidate, OSRM `alternatives`, distinctness against the fastest line, and the `+2 min, past a park and 6 cafés` summary. Parks count within 110 m of the line because Overpass only gives a center point. Polygon distance is in the poi stream; you can consume a richer `Poi` if they add optional fields.

## poi

**Goal:** Make place data faster, more reliable, and a bit richer, without changing how routes are scored.

**Owns:** `src/poi/**`

**Do not edit:** `web/**`, `src/routing/**`, `src/worker.ts`, `wrangler.jsonc`

**Done when:**

- A repeated Overpass bbox is served from `CacheStore` (unit test with `memoryCache`).
- If the first Overpass endpoint fails, the second is tried. Test that with an injected `fetch` or a fake endpoint list, not a live outage.
- Viewpoints, playgrounds, plazas, and at least one new lively tag (street art or fountains are good) classify into the existing kinds, with tests in `src/poi/classify.test.ts`.
- A failed Overpass query still returns `{ pois: [], ok: false }` so the API can show the fastest walk alone.
- `npm test` passes.

**Already in v1:** classify, two Overpass mirrors, a 6 hour cache through `cachedJson`, and Nominatim search cached for a day. The Worker uses the Cache API; local dev uses memory. Do not remove the User-Agent on outbound requests.

## ui

**Goal:** Make the phone-sized walk picker feel finished: the places on the selected route are obvious, the link is shareable, and the fastest versus alive choice is easy to scan.

**Owns:** `web/**`

**Do not edit:** `src/routing/**`, `src/poi/**`, `src/worker.ts`, `wrangler.jsonc`

**Done when:**

- The selected route lists the actual place names, not only the counts in the summary.
- A control copies the current URL (origin, destination, and selected route are already in the query string).
- The South Bank preset can be completed at about 390 px wide and at desktop width: search or chip, cards appear, tapping another card changes which line is emphasized.
- Focus states and text contrast stay visible. Honor `prefers-reduced-motion`.
- `npm run build` succeeds.

**Already in v1:** MapLibre on OpenFreeMap Liberty, origin and destination search, example chips, geolocation for the start, route cards, and A/B pins. The client imports types from `../../src/types`.

## deploy

**Goal:** Make a clean bill of health on every push, and make `npm run deploy` the only production step.

**Owns:** `wrangler.jsonc`, `src/worker.ts`, `src/dev-server.ts`, `.github/**`

**Do not edit:** `src/routing/**`, `src/poi/**`, `web/src/**`

**Done when:**

- GitHub Actions runs `npm run typecheck`, `npm test`, and `npm run build` on pushes and pull requests.
- `npx wrangler deploy --dry-run` succeeds in that workflow, or the README explains the one credential it still needs and the workflow skips deploy without failing the build.
- `worker-configuration.d.ts` is generated by `wrangler types` (the typecheck script already does this). Do not hand-write `Env`.
- README deploy steps match the workflow. Production still needs `CLOUDFLARE_API_TOKEN` with Workers Admin the first time this Worker is created (Editor after it exists) and `CLOUDFLARE_ACCOUNT_ID`. Do not put token values in the repo, the logs, or this file.

**Already in v1:** `wrangler.jsonc` serves `web/dist` as a single-page app, runs the Worker first for `/api/*`, and turns on Workers logs and traces. `npm run deploy` is `vite build && wrangler deploy`. There is no GitHub workflow yet.
