import { createServer } from "node:http";
import { handleApi } from "./api/handle";
import { DEFAULT_USER_AGENT } from "./config";
import { memoryCache } from "./poi/cache";

const port = Number(process.env.PORT ?? 8787);
const cache = memoryCache();

const server = createServer((req, res) => {
  void (async () => {
    const path = req.url ?? "/";
    const request = new Request(`http://127.0.0.1:${port}${path}`, {
      method: req.method ?? "GET",
    });
    try {
      const response = await handleApi(request, {
        cache,
        userAgent: process.env.USER_AGENT || DEFAULT_USER_AGENT,
      });
      res.statusCode = response.status;
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });
      const body = Buffer.from(await response.arrayBuffer());
      console.log(JSON.stringify({ event: "request", method: req.method, path, status: response.status }));
      res.end(body);
    } catch (err) {
      console.error(
        JSON.stringify({
          event: "dev_server_crash",
          message: err instanceof Error ? err.message : String(err),
        }),
      );
      res.statusCode = 500;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "Something went wrong planning that walk." }));
    }
  })();
});

server.listen(port, "0.0.0.0", () => {
  console.log(JSON.stringify({ event: "api_listening", url: `http://127.0.0.1:${port}` }));
});
