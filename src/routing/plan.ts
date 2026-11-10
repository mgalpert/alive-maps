import { MAX_WALK_M, MIN_WALK_M } from "../config";
import { bboxOf, haversineM, toLine } from "../geo";
import type { CacheStore } from "../poi/cache";
import { fetchPois } from "../poi/overpass";
import type { LatLng, RoutesResponse } from "../types";
import { pickWaypoints } from "./candidates";
import { chooseRoutes, type CandidateRoute } from "./choose";
import { osrmFoot } from "./osrm";

export class PlanError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PlanError";
  }
}

export async function planWalk(input: {
  origin: LatLng;
  destination: LatLng;
  cache: CacheStore;
  userAgent: string;
}): Promise<RoutesResponse> {
  const apart = haversineM(input.origin, input.destination);
  if (apart < MIN_WALK_M) {
    throw new PlanError("Those two places are already next to each other.", 400);
  }
  if (apart > MAX_WALK_M) {
    throw new PlanError(
      "Alive Maps is for walks. Those places are more than 6 km apart in a straight line.",
      400,
    );
  }

  const started = Date.now();
  try {
    const direct = await osrmFoot([input.origin, input.destination], {
      alternatives: true,
      cache: input.cache,
      userAgent: input.userAgent,
    });
    const base = direct[0];
    if (!base) throw new PlanError("No walking route between those places.", 404);

    const pois = await fetchPois(bboxOf(toLine(base.geometry), 450), {
      cache: input.cache,
      userAgent: input.userAgent,
    });
    const waypoints = pois.ok
      ? pickWaypoints(pois.pois, base.geometry, input.origin, input.destination)
      : [];
    const via = await viaRoutes(input.origin, input.destination, waypoints, input);

    const candidates: CandidateRoute[] = [
      ...direct.map((route, index) => ({
        id: index === 0 ? "direct" : `alt-${index}`,
        durationSec: route.durationSec,
        distanceM: route.distanceM,
        geometry: route.geometry,
      })),
      ...via,
    ];
    const choice = chooseRoutes(candidates, pois.pois);
    const notes: string[] = [];
    if (!pois.ok) {
      notes.push("Parks and cafés could not be loaded, so this is only the fastest walk.");
    } else if (!choice.routes.some((route) => route.kind === "alive")) {
      notes.push("No slightly longer walk nearby looked more alive than the direct route.");
    }

    console.log(
      JSON.stringify({
        event: "routes_planned",
        direct: direct.length,
        waypoints: waypoints.length,
        pois: pois.pois.length,
        alive: choice.routes.filter((route) => route.kind === "alive").length,
        rejectedLong: choice.rejectedLong,
        rejectedSame: choice.rejectedSame,
        rejectedQuiet: choice.rejectedQuiet,
        ms: Date.now() - started,
      }),
    );

    return {
      origin: input.origin,
      destination: input.destination,
      routes: choice.routes,
      notes,
    };
  } catch (err) {
    if (err instanceof PlanError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ event: "plan_failed", message }));
    if (message === "No walking route between those places.") {
      throw new PlanError(message, 404);
    }
    throw new PlanError("Walking directions are unavailable right now. Try again in a moment.", 502);
  }
}

async function viaRoutes(
  origin: LatLng,
  destination: LatLng,
  waypoints: { id: string; name: string; lat: number; lon: number }[],
  input: { cache: CacheStore; userAgent: string },
): Promise<CandidateRoute[]> {
  const routes: CandidateRoute[] = [];
  for (let index = 0; index < waypoints.length; index++) {
    const poi = waypoints[index];
    if (!poi) continue;
    if (index > 0) await sleep(200);
    try {
      const result = await osrmFoot([origin, poi, destination], {
        alternatives: false,
        cache: input.cache,
        userAgent: input.userAgent,
      });
      const best = result[0];
      if (!best) continue;
      routes.push({
        id: `via-${poi.id}`,
        durationSec: best.durationSec,
        distanceM: best.distanceM,
        geometry: best.geometry,
        viaName: poi.name,
      });
    } catch (err) {
      console.warn(
        JSON.stringify({
          event: "via_failed",
          waypoint: poi.id,
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
  return routes;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
