export async function fetchExternal(
  url: string,
  init: {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
    timeoutMs: number;
    userAgent: string;
    accept?: string;
  },
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("user-agent", init.userAgent);
  headers.set("accept", init.accept ?? "application/json");
  return fetch(url, {
    method: init.method ?? "GET",
    body: init.body,
    headers,
    signal: AbortSignal.timeout(init.timeoutMs),
  });
}
