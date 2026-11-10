import { useEffect, useId, useRef, useState } from "react";
import type { SearchResult } from "../../src/types";
import { searchPlaces } from "./api";

type Props = {
  label: string;
  query: string;
  selectedLabel: string | null;
  placeholder: string;
  onQuery: (value: string) => void;
  onPick: (place: SearchResult) => void;
};

export function SearchBox({ label, query, selectedLabel, placeholder, onQuery, onPick }: Props) {
  const listId = useId();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const request = useRef(0);

  useEffect(() => {
    if (query.trim().length < 2 || query === selectedLabel) {
      setResults([]);
      setError(null);
      setBusy(false);
      return;
    }
    const controller = new AbortController();
    const ticket = ++request.current;
    const timer = window.setTimeout(() => {
      setBusy(true);
      searchPlaces(query.trim(), controller.signal)
        .then((places) => {
          if (ticket !== request.current) return;
          setResults(places);
          setError(null);
          setOpen(true);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setResults([]);
          setError(err instanceof Error ? err.message : "Place search failed.");
          setOpen(true);
        })
        .finally(() => {
          if (ticket === request.current) setBusy(false);
        });
    }, 320);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, selectedLabel]);

  return (
    <label className="field">
      <span>{label}</span>
      <input
        value={query}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open && (results.length > 0 || error !== null)}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        onChange={(event) => {
          onQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && results[0]) {
            event.preventDefault();
            onPick(results[0]);
            setOpen(false);
          }
          if (event.key === "Escape") setOpen(false);
        }}
      />
      {busy ? <em className="field-status">Searching…</em> : null}
      {open && error ? <p className="field-error">{error}</p> : null}
      {open && results.length > 0 ? (
        <ul id={listId} role="listbox" className="suggestions">
          {results.map((place) => (
            <li key={`${place.lat},${place.lon},${place.label}`} role="option">
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onPick(place);
                  setOpen(false);
                }}
              >
                {place.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </label>
  );
}
