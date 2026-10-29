import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import type { Plugin, ProxyOptions } from "vite";
import { DevConfig } from "./src/shared/dev-config.ts";

const EVENT_STREAM = "text/event-stream";

/**
 * Proxy for the dev server: API calls and the event stream go to Ode's server in Live, at the address it prints when
 * it starts (ODE_DEV_SERVER in .env), with the token from that address.
 */
function apiProxy(): ProxyOptions {
  const address = new URL(DevConfig.load().server);
  const token = address.searchParams.get("token") ?? "";
  return {
    target: address.origin,
    headers: { Cookie: `ode=${token}` },
    changeOrigin: true,
    timeout: 0,
    proxyTimeout: 0,
    configure: (proxy) => {
      proxy.on("proxyRes", (response) => {
        if (response.headers["content-type"]?.startsWith(EVENT_STREAM)) {
          response.headers["cache-control"] = "no-cache, no-transform";
          response.headers["x-accel-buffering"] = "no";
        }
      });
    },
  };
}

/** The dev server forwards /api for its own pages alone, so a page from another site reaches Ode through it in vain. */
function ownPagesOnly(): Plugin {
  return {
    name: "ode-own-pages-only",
    configureServer(server) {
      server.middlewares.use("/api", (request, response, next) => {
        const site = request.headers["sec-fetch-site"];
        if (site === undefined || site === "same-origin" || site === "none") return next();
        response.statusCode = 403;
        response.end("Ode's development server answers its own pages.");
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  root: fileURLToPath(new URL("./src/ui", import.meta.url)),
  base: "/",
  plugins: [react(), ownPagesOnly()],
  build: {
    outDir: "../../dist/ui",
    emptyOutDir: true,
  },
  server: command === "serve" ? { proxy: { "/api": apiProxy() } } : undefined,
}));
