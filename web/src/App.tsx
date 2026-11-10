import { useEffect, useMemo, useState } from "react";
import type { RouteOption, SearchResult } from "../../src/types";
import { fetchRoutes } from "./api";
import { EXAMPLES } from "./examples";
import { formatDistance, formatMinutes } from "./format";
import { MapCanvas } from "./MapCanvas";
import { SearchBox } from "./SearchBox";

type Phase = "idle" | "planning" | "ready" | "error";

export function App() {
  const initial = useMemo(() => readUrl(), []);
  const [originQuery, setOriginQuery] = useState(initial.origin?.label ?? "");
  const [destinationQuery, setDestinationQuery] = useState(initial.destination?.label ?? "");
  const [origin, setOrigin] = useState<SearchResult | null>(initial.origin);
  const [destination, setDestination] = useState<SearchResult | null>(initial.destination);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initial.routeId);
  const [phase, setPhase] = useState<Phase>(initial.origin && initial.destination ? "planning" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!origin || !destination) return;
    const controller = new AbortController();
    const slowTimer = window.setTimeout(() => setSlow(true), 1800);
    setPhase("planning");
    setError(null);
    setSlow(false);
    fetchRoutes(origin, destination, controller.signal)
      .then((result) => {
        setRoutes(result.routes);
        setNotes(result.notes);
        setSelectedId((current) => {
          if (current && result.routes.some((route) => route.id === current)) return current;
          return result.routes.find((route) => route.kind === "alive")?.id ?? result.routes[0]?.id ?? null;
        });
        setPhase("ready");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setRoutes([]);
        setNotes([]);
        setError(err instanceof Error ? err.message : "Could not plan that walk.");
        setPhase("error");
      })
      .finally(() => window.clearTimeout(slowTimer));
    return () => {
      controller.abort();
      window.clearTimeout(slowTimer);
    };
  }, [origin, destination]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (origin) {
      params.set("olat", origin.lat.toFixed(5));
      params.set("olon", origin.lon.toFixed(5));
      params.set("olabel", origin.label);
    }
    if (destination) {
      params.set("dlat", destination.lat.toFixed(5));
      params.set("dlon", destination.lon.toFixed(5));
      params.set("dlabel", destination.label);
    }
    if (selectedId) params.set("route", selectedId);
    const next = params.toString();
    const path = next ? `/?${next}` : "/";
    if (`${window.location.pathname}${window.location.search}` !== path) {
      window.history.replaceState(null, "", path);
    }
  }, [origin, destination, selectedId]);

  function useExample(example: (typeof EXAMPLES)[number]) {
    setOrigin(example.origin);
    setDestination(example.destination);
    setOriginQuery(example.origin.label);
    setDestinationQuery(example.destination.label);
  }

  function swap() {
    setOrigin(destination);
    setDestination(origin);
    setOriginQuery(destinationQuery);
    setDestinationQuery(originQuery);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("This browser cannot share your location.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const place = {
          label: "My location",
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        };
        setOrigin(place);
        setOriginQuery(place.label);
        setLocating(false);
      },
      () => {
        setError("Location is unavailable. Search for a start instead.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  const selected = routes.find((route) => route.id === selectedId) ?? null;

  return (
    <main className="app">
      <MapCanvas origin={origin} destination={destination} routes={routes} selectedId={selectedId} />
      <aside className="panel">
        <header className="brand">
          <p className="eyebrow">Walking, the long way</p>
          <h1>Alive Maps</h1>
        </header>
        <form
          className="search"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <SearchBox
            label="From"
            query={originQuery}
            selectedLabel={origin?.label ?? null}
            placeholder="A station, a café, an address"
            onQuery={(value) => {
              setOriginQuery(value);
              setOrigin(null);
            }}
            onPick={(place) => {
              setOrigin(place);
              setOriginQuery(place.label);
            }}
          />
          <div className="search-actions">
            <button type="button" className="text-button" onClick={swap} disabled={!originQuery && !destinationQuery}>
              Swap
            </button>
            <button type="button" className="text-button" onClick={useMyLocation} disabled={locating}>
              {locating ? "Finding you…" : "Use my location"}
            </button>
          </div>
          <SearchBox
            label="To"
            query={destinationQuery}
            selectedLabel={destination?.label ?? null}
            placeholder="Where you're headed"
            onQuery={(value) => {
              setDestinationQuery(value);
              setDestination(null);
            }}
            onPick={(place) => {
              setDestination(place);
              setDestinationQuery(place.label);
            }}
          />
        </form>
        <div className="examples">
          {EXAMPLES.map((example) => (
            <button key={example.title} type="button" className="chip" onClick={() => useExample(example)}>
              Try {example.title}
            </button>
          ))}
        </div>
        <section className="routes" aria-live="polite">
          {phase === "idle" ? (
            <p className="lede">
              The fastest walk is rarely the one you remember. Pick two places and Alive Maps will
              show the direct route plus a few slightly longer ones that pass parks, beautiful
              buildings, and streets with cafés.
            </p>
          ) : null}
          {phase === "planning" ? (
            <p className="status">{slow ? "Checking parks and cafés along the way…" : "Finding the walk…"}</p>
          ) : null}
          {phase === "error" && error ? <p className="field-error">{error}</p> : null}
          {phase === "ready"
            ? routes.map((route) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  selected={route.id === selectedId}
                  onSelect={() => setSelectedId(route.id)}
                />
              ))
            : null}
          {phase === "ready" && selected?.places.length ? (
            <p className="places">
              <span>Along this walk</span>
              {selected.places.join(" · ")}
            </p>
          ) : null}
          {phase === "ready"
            ? notes.map((note) => (
                <p key={note} className="note">
                  {note}
                </p>
              ))
            : null}
        </section>
      </aside>
    </main>
  );
}

function RouteCard({
  route,
  selected,
  onSelect,
}: {
  route: RouteOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={selected ? "route selected" : "route"}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className="pip" style={{ background: route.color }} aria-hidden="true" />
      <span className="route-copy">
        <span className="route-name">{route.name}</span>
        <span className="summary">{route.summary}</span>
        <span className="why">{route.why}</span>
      </span>
      <span className="route-time">
        <strong>{formatMinutes(route.durationSec)}</strong>
        <small>{formatDistance(route.distanceM)}</small>
      </span>
    </button>
  );
}

function readUrl(): { origin: SearchResult | null; destination: SearchResult | null; routeId: string | null } {
  const params = new URLSearchParams(window.location.search);
  return {
    origin: readPlace(params, "o"),
    destination: readPlace(params, "d"),
    routeId: params.get("route"),
  };
}

function readPlace(params: URLSearchParams, prefix: "o" | "d"): SearchResult | null {
  const lat = Number(params.get(`${prefix}lat`));
  const lon = Number(params.get(`${prefix}lon`));
  const label = params.get(`${prefix}label`);
  if (!label || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { label, lat, lon };
}
