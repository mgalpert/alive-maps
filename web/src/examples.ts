import type { SearchResult } from "../../src/types";

export const EXAMPLES: {
  title: string;
  origin: SearchResult;
  destination: SearchResult;
}[] = [
  {
    title: "South Bank",
    origin: { label: "Tate Modern, London", lat: 51.5076, lon: -0.0994 },
    destination: { label: "Covent Garden, London", lat: 51.5117, lon: -0.1228 },
  },
  {
    title: "Lisbon hills",
    origin: { label: "Time Out Market, Lisbon", lat: 38.7071, lon: -9.1458 },
    destination: { label: "Miradouro da Senhora do Monte, Lisbon", lat: 38.7192, lon: -9.133 },
  },
];
