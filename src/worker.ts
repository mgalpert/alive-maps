import { handleApi } from "./api/handle";
import { workersCache } from "./poi/cache";

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, {
        cache: workersCache(),
        userAgent: env.USER_AGENT,
      });
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
